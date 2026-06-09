import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Camera, 
  Map, 
  Clock, 
  FolderHeart, 
  BarChart3, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  PlusCircle,
  Users as UsersIcon,
  Sun,
  Moon
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('lenslog_theme');
    if (saved === 'light') {
      document.documentElement.classList.add('light');
      return 'light';
    } else {
      document.documentElement.classList.remove('light');
      return 'dark';
    }
  });

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.add('light');
      localStorage.setItem('lenslog_theme', 'light');
      setTheme('light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('lenslog_theme', 'dark');
      setTheme('dark');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Gallery', path: '/', icon: Camera },
    { name: 'Map', path: '/map', icon: Map },
    { name: 'Timeline', path: '/timeline', icon: Clock },
    { name: 'Collections', path: '/collections', icon: FolderHeart },
    { name: 'Statistics', path: '/statistics', icon: BarChart3 },
    { name: 'Social', path: '/social', icon: UsersIcon },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-md shadow-cyan-500/10">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                LensLog
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      active
                        ? 'bg-slate-800/80 text-cyan-400 border border-slate-700/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-500" />}
            </button>

            <Link
              to="/upload"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/15 hover:scale-[1.01] transition-all duration-300"
            >
              <PlusCircle className="w-4 h-4" />
              Upload Photos
            </Link>

            <div className="h-6 w-px bg-slate-800" />

            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2 group">
                {user?.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-full border border-slate-700 object-cover group-hover:border-cyan-500 transition-colors"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center group-hover:border-cyan-500 transition-colors">
                    <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
                  </div>
                )}
                <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
                  {user?.username}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg border border-slate-800"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-cyan-500" />}
            </button>

            <Link
              to="/upload"
              className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white"
            >
              <PlusCircle className="w-5 h-5" />
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg border border-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden sticky top-16 z-30 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 p-4 space-y-4 animate-in slide-in-from-top duration-300">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-slate-800 text-cyan-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="h-px bg-slate-800" />

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              {user?.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt={user.username}
                  className="w-9 h-9 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <span className="text-sm font-medium text-slate-300">{user?.username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-slate-600 text-xs">
        &copy; {new Date().getFullYear()} LensLog. Built with passion for photography.
      </footer>
    </div>
  );
};
