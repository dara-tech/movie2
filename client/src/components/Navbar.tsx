import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  LogOut,
  Shield,
  Menu,
  X,
  Search,
  Bookmark
} from 'lucide-react';

// Used by commented-out category config; keep for future nav category typing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface NavCategory {
  label: string;
  path: string;
  isoCode?: string;
}

// const BASE_MOVIE_CATEGORIES: NavCategory[] = [
//   { label: 'Trending', path: '/movies?category=trending' },
//   { label: 'Popular', path: '/movies?category=popular' },
//   { label: 'Top Rated', path: '/movies?category=top-rated' },
//   { label: 'Upcoming', path: '/movies?category=upcoming' }
// ];

// const MOVIE_GENRE_PRIORITY = [
//   { name: 'Action', slug: 'action' },
//   { name: 'Comedy', slug: 'comedy' },
//   { name: 'Drama', slug: 'drama' },
//   { name: 'Horror', slug: 'horror' },
//   { name: 'Romance', slug: 'romance' },
//   { name: 'Science Fiction', slug: 'sci-fi' },
//   { name: 'Thriller', slug: 'thriller' }
// ];

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [logoData, setLogoData] = useState<{
    logoUrl: string | null; 
    type: string; 
    text: string;
    textFirst?: string;
    textSecond?: string;
    addSpace?: boolean;
  } | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch logo settings
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await api.get('/api/site-settings/logo');
        if (response.data.success) {
          setLogoData(response.data.data);
        }
      } catch (error) {
        // Silently fail and use default text logo
        setLogoData({ logoUrl: null, type: 'text', text: 'MOVIESTREAM', textFirst: 'MOVIE', textSecond: 'STREAM', addSpace: false });
      }
    };

    fetchLogo();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAuthenticated = Boolean(user);

  const navigationItems = isAuthenticated
    ? [
        { label: 'Movies', path: '/movies' },
        { label: 'TV Shows', path: '/tvshows' },
        { label: 'Latest', path: '/latest' },
        { label: 'History', path: '/history' },
      ]
    : [
        { label: 'Movies', path: '/movies' },
        { label: 'TV Shows', path: '/tvshows' },
        { label: 'Latest', path: '/latest' },
      ];

  const isActive = (path: string) => {
    if (path === '/movies') {
      return location.pathname.startsWith('/movies') || location.pathname.startsWith('/movie');
    }
    if (path === '/tvshows') {
      return location.pathname.startsWith('/tvshows') || location.pathname.startsWith('/tvshow');
    }
    if (path === '/latest') {
      return location.pathname === '/latest' || location.pathname.startsWith('/latest');
    }
    if (path === '/history') {
      return location.pathname.startsWith('/history');
    }
    if (path === '/search') {
      return location.pathname.startsWith('/search');
    }
    return location.pathname === path;
  };

  const preloadRoute = (path: string) => {
    if (path === '/movies') import('./MoviesPage');
    if (path === '/tvshows') import('./TVShowsPage');
    if (path === '/latest') import('./LatestPage');
    if (path === '/history') import('./HistoryPage');
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled 
        ? 'bg-black/95 backdrop-blur-md border-b border-white/10' 
        : 'bg-black/90 backdrop-blur-sm border-b border-white/5'
    }`}>
      <div className="flex h-16 md:h-20 items-center px-3 sm:px-4 md:px-6">
        {/* Logo */}
        <div 
          className="flex items-center cursor-pointer select-none flex-shrink-0" 
          onClick={() => navigate('/movies')}
          onMouseEnter={() => preloadRoute('/movies')}
        >
          {logoData?.logoUrl && logoData.type !== 'text' ? (
            <img 
              src={logoData.logoUrl.startsWith('http') 
                ? logoData.logoUrl 
                : `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}${logoData.logoUrl}`
              }
              alt="Logo"
              className="h-8 sm:h-10 md:h-12 max-w-[200px] object-contain"
              onError={() => {
                // Fallback to text logo if image fails to load
                setLogoData({ logoUrl: null, type: 'text', text: logoData.text || 'MOVIESTREAM', textFirst: logoData.textFirst || 'MOVIE', textSecond: logoData.textSecond || 'STREAM', addSpace: logoData.addSpace || false });
              }}
            />
          ) : (
            <div className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
              {(() => {
                let firstPart = 'MOVIE';
                let secondPart = '';
                let space = '';
                
                if (logoData?.textFirst !== undefined || logoData?.textSecond !== undefined) {
                  firstPart = logoData.textFirst || 'MOVIE';
                  secondPart = logoData.textSecond || '';
                  space = logoData.addSpace ? ' ' : '';
                } else {
                  const textParts = (logoData?.text || 'MOVIESTREAM').split(' ');
                  firstPart = textParts[0] || 'MOVIE';
                  secondPart = textParts.slice(1).join(' ') || '';
                }
                
                return (
                  <>
                    <span className="text-white">{firstPart}</span>
                    {secondPart && (
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                        {space}{secondPart}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1 ml-12">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={() => preloadRoute(item.path)}
              onTouchStart={() => preloadRoute(item.path)}
              className={`
                relative px-5 py-2 text-sm font-medium uppercase tracking-wider
                transition-all duration-300 ease-out h-10 flex items-center cursor-pointer active:scale-95 focus:outline-none
                ${isActive(item.path)
                  ? 'text-cyan-400 font-semibold'
                  : 'text-gray-400 hover:text-cyan-300'
                }
                group
              `}
            >
              <span className="relative z-10">{item.label}</span>
              {/* Active indicator line */}
              {isActive(item.path) && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] transition-all duration-300" />
              )}
            </Link>
          ))}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 ml-auto">
          {/* Search */}
          <button
            onClick={() => navigate('/search')}
            className={`relative p-2 sm:px-3 sm:py-2 text-sm font-medium uppercase tracking-wider transition-all duration-300 group h-9 sm:h-10 flex items-center justify-center cursor-pointer active:scale-95 focus:outline-none ${
              isActive('/search') ? 'text-cyan-400' : 'text-gray-400 hover:text-cyan-300'
            }`}
            aria-label="Search"
          >
            <span className="relative z-10">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            {/* Active indicator line */}
            {isActive('/search') && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] transition-all duration-300" />
            )}
            {/* Hover indicator line */}
            <span className={`absolute bottom-0 left-0 w-0 h-[1px] bg-cyan-400/50 transition-all duration-300 group-hover:w-full ${isActive('/search') ? 'hidden' : ''}`} />
          </button>

          {/* Profile or Auth Buttons */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 border border-blue-500/30 hover:border-cyan-400/60 shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all duration-300 flex-shrink-0"
                >
                  <Avatar className="h-full w-full">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-bold text-xs sm:text-sm border-0">
                      {user?.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-64 bg-neutral-950/95 backdrop-blur-2xl border border-blue-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.15)] p-1.5" 
                align="end"
                forceMount
              >
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-sm font-semibold text-white">{user?.username}</p>
                  <p className="text-xs text-cyan-300/80 mt-0.5">
                    {user?.email}
                  </p>
                </div>
                
                <DropdownMenuItem 
                  onClick={() => navigate('/watchlist')}
                  className="text-gray-300 hover:text-cyan-300 hover:bg-cyan-950/30 rounded-lg transition-all duration-200 cursor-pointer py-2.5 my-1"
                >
                  <Bookmark className="mr-3 h-4 w-4 text-cyan-400" />
                  <span className="text-sm uppercase tracking-wide">Watchlist</span>
                </DropdownMenuItem>
                
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem 
                      onClick={() => navigate('/admin')}
                      className="text-gray-300 hover:text-cyan-300 hover:bg-cyan-950/30 rounded-lg transition-all duration-200 cursor-pointer py-2.5 my-1"
                    >
                      <Shield className="mr-3 h-4 w-4 text-cyan-400" />
                      <span className="text-sm uppercase tracking-wide">Admin Panel</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                  </>
                )}
                
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 cursor-pointer py-2.5"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span className="text-sm uppercase tracking-wide">Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                className="hidden sm:inline-flex uppercase tracking-wide text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9 text-zinc-300 hover:text-cyan-300 hover:bg-cyan-950/30"
                onClick={() => navigate('/login')}
              >
                Log In
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white uppercase tracking-wide text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9 shadow-md shadow-blue-950/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                onClick={() => navigate('/register')}
              >
                <span className="hidden sm:inline">Sign Up</span>
                <span className="sm:hidden">Sign</span>
              </Button>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors duration-300 p-2 -mr-2 flex-shrink-0"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-blue-500/20 bg-neutral-950/95 backdrop-blur-2xl shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Mobile Navigation */}
            <div className="space-y-1.5 sm:space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.path}
                  onMouseEnter={() => preloadRoute(item.path)}
                  onTouchStart={() => preloadRoute(item.path)}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium uppercase tracking-wider
                    transition-all duration-300 rounded-lg border min-h-[44px] flex items-center cursor-pointer active:scale-[0.98]
                    ${isActive(item.path)
                      ? 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-semibold'
                      : 'text-gray-400 border-transparent hover:text-cyan-300 hover:border-cyan-500/20 hover:bg-cyan-950/20 active:bg-cyan-950/30'
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Mobile Auth Actions (if not authenticated) */}
            {!isAuthenticated && (
              <div className="pt-4 border-t border-white/10 space-y-2">
              <Button
                variant="ghost"
                className="w-full uppercase tracking-wide text-sm py-3 h-auto text-zinc-300 hover:text-cyan-300 hover:bg-cyan-950/30"
                onClick={() => {
                  navigate('/login');
                  setIsMobileMenuOpen(false);
                }}
              >
                Log In
              </Button>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white uppercase tracking-wide text-sm py-3 h-auto shadow-md shadow-blue-950/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                onClick={() => {
                  navigate('/register');
                  setIsMobileMenuOpen(false);
                }}
              >
                Sign Up
              </Button>
            </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
