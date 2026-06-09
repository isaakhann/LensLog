import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Camera, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.profile_picture_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email) {
      setError('Username and email are required.');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await updateProfile({
        username,
        email,
        ...(password ? { password } : {}),
      });
      setSuccess('Profile updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.detail || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    
    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', avatarFile);

    try {
      // In Phase 3, we will add this endpoint. For now, we simulate success or hit a stub
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/users/me/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lenslog_access_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar image');
      }

      await response.json();
      setSuccess('Profile picture updated!');
      setAvatarFile(null);
      // Wait, we should update the auth context as well. The easiest way is to let the user refresh, or update profile.
      // Since updatedUser contains profile_picture_url, let's refresh page or just trigger user update.
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account information and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Avatar Editing */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center text-center space-y-6">
          <h2 className="text-lg font-semibold w-full text-left border-b border-slate-800 pb-3">Profile Picture</h2>
          
          <div className="relative group">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={user?.username}
                className="w-32 h-32 rounded-full object-cover border-2 border-slate-700 group-hover:border-cyan-500 transition-colors"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-2 border-slate-700 bg-slate-800 flex items-center justify-center text-slate-500 group-hover:border-cyan-500 transition-colors">
                <User className="w-12 h-12" />
              </div>
            )}
            
            <label className="absolute bottom-0 right-0 p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full cursor-pointer shadow-lg shadow-cyan-500/20 hover:scale-105 transition-transform">
              <Camera className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-500">JPG, PNG or WEBP. Max size 2MB.</p>
            {avatarFile && (
              <button
                onClick={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 rounded-lg border border-slate-700/60 transition-colors flex items-center gap-2"
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Apply Picture'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Column - Profile Info form */}
        <div className="md:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Profile Details</h2>

          {error && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all duration-300"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all duration-300"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="h-px bg-slate-800" />
            
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                Change Password (optional)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all duration-300"
                    placeholder="Leave blank to keep current"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all duration-300"
                    placeholder="Leave blank to keep current"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/15 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving changes...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
