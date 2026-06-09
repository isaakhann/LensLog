import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: string;
  email: string;
  username: string;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { email?: string; username?: string; password?: string }) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      const access = localStorage.getItem('lenslog_access_token');
      if (access) {
        const currentUser = await api.get<User>('/users/me');
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      api.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    // Listen to global logout event triggered by the api client (e.g. on token expired)
    const handleGlobalLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth_logout', handleGlobalLogout);
    return () => {
      window.removeEventListener('auth_logout', handleGlobalLogout);
    };
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; refresh_token: string }>('/auth/login', {
        username_or_email: usernameOrEmail,
        password,
      });
      localStorage.setItem('lenslog_access_token', data.access_token);
      localStorage.setItem('lenslog_refresh_token', data.refresh_token);
      
      const currentUser = await api.get<User>('/users/me');
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string) => {
    await api.post('/auth/register', { email, username, password });
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
  };

  const updateProfile = async (data: { email?: string; username?: string; password?: string }) => {
    const updatedUser = await api.put<User>('/users/me', data);
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
