const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ApiError {
  detail: string;
}

class ApiClient {
  private getTokens() {
    const access = localStorage.getItem('lenslog_access_token');
    const refresh = localStorage.getItem('lenslog_refresh_token');
    return { access, refresh };
  }

  private setTokens(access: string, refresh: string) {
    localStorage.setItem('lenslog_access_token', access);
    localStorage.setItem('lenslog_refresh_token', refresh);
  }

  public clearTokens() {
    localStorage.removeItem('lenslog_access_token');
    localStorage.removeItem('lenslog_refresh_token');
  }

  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.map((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Refresh expired');
    }

    const data = await response.json();
    this.setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  }

  public async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { access } = this.getTokens();
    const headers = new Headers(options.headers || {});
    
    if (access) {
      headers.set('Authorization', `Bearer ${access}`);
    }

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const url = path.startsWith('http') ? path : `${API_URL}${path}`;
    const response = await fetch(url, config);

    if (response.status === 401) {
      const { refresh } = this.getTokens();
      if (!refresh) {
        this.clearTokens();
        window.dispatchEvent(new Event('auth_logout'));
        throw new Error('Unauthorized');
      }

      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const newAccessToken = await this.refreshAccessToken(refresh);
          this.isRefreshing = false;
          this.onRefreshed(newAccessToken);
        } catch (error) {
          this.isRefreshing = false;
          this.clearTokens();
          window.dispatchEvent(new Event('auth_logout'));
          throw new Error('Session expired. Please log in again.');
        }
      }

      return new Promise<T>((resolve, reject) => {
        this.subscribeTokenRefresh((token) => {
          headers.set('Authorization', `Bearer ${token}`);
          fetch(url, { ...options, headers })
            .then((res) => {
              if (!res.ok) {
                return res.json().then((err) => reject(err));
              }
              return res.json().then((data) => resolve(data as T));
            })
            .catch(reject);
        });
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
      throw errorData;
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  public get<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, body?: any, options: RequestInit = {}): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  public put<T>(path: string, body?: any, options: RequestInit = {}): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  public delete<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
