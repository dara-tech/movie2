import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';
import SiteSEO from './components/SiteSEO';
import { useActivityTracking } from './hooks/useActivityTracking';
import ScrollToTop from './components/ScrollToTop';
import AdLoader from './components/AdLoader';
import TelegramJoinButton from './components/TelegramJoinButton';
import VpnBanner from './components/VpnBanner';

// Keep auth pages non-lazy for faster initial load
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
// SitemapRedirect removed - sitemaps are handled by Netlify redirects, not React routes

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Lazy load heavy components for better code splitting
const MoviesPage = lazy(() => import('./components/MoviesPage'));
const TVShowsPage = lazy(() => import('./components/TVShowsPage'));
const TVShowDetailPage = lazy(() => import('./components/TVShowDetailPage'));
const MovieDetailPage = lazy(() => import('./components/MovieDetailPage'));
const CastDetailPage = lazy(() => import('./components/CastDetailPage'));
const WatchlistPage = lazy(() => import('./components/WatchlistPage'));
const HistoryPage = lazy(() => import('./components/HistoryPage'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const SearchPage = lazy(() => import('./components/SearchPage'));
const LatestPage = lazy(() => import('./components/LatestPage'));
// import Settings from './components/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner />
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner />
      </div>
    );
  }
  
  return !user ? <>{children}</> : <Navigate to="/movies" />;
};

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  useActivityTracking();
  const isMovieEmbedRoute = location.pathname.startsWith('/movie/');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const showNavbar = !isMovieEmbedRoute && !isAdminRoute;

  // Track page views in Google Analytics
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'G-449FS2FPMX', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location.pathname, location.search]);

  // Preload primary route chunks on idle so tab switches are instant
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./components/MoviesPage');
      import('./components/TVShowsPage');
      import('./components/LatestPage');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="min-h-screen bg-[#060709] text-[#f8fafc] dark">
      <AdLoader />
      <SiteSEO />
      {showNavbar && <Navbar />}
      {showNavbar && <TelegramJoinButton />}
      {showNavbar && <VpnBanner variant="floating" />}
      <main className={showNavbar ? (user ? "pt-16 md:pt-20" : "pt-16 md:pt-20") : ""}>
        <Routes>
          <Route 
            path="/login" 
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              <PublicOnlyRoute>
                <ForgotPassword />
              </PublicOnlyRoute>
            } 
          />
          <Route 
            path="/reset-password" 
            element={
              <PublicOnlyRoute>
                <ResetPassword />
              </PublicOnlyRoute>
            } 
          />
          {/* Sitemap routes handled by Netlify redirects - not React routes */}
          <Route path="/" element={<Navigate to="/movies" replace />} />
          <Route path="/public" element={<Navigate to="/movies" replace />} />
          <Route path="/dashboard" element={<Navigate to="/movies" replace />} />
          <Route
            path="/latest"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <LatestPage />
              </Suspense>
            }
          />
          <Route
            path="/movies"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <MoviesPage />
              </Suspense>
            }
          />
          <Route
            path="/tvshows"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <TVShowsPage />
              </Suspense>
            }
          />
          <Route
            path="/movie/:id"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <MovieDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/cast/:id"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <CastDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/tvshow/:id"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <TVShowDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-screen bg-black">
                    <LoadingSpinner />
                  </div>
                }>
                  <WatchlistPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-screen bg-black">
                    <LoadingSpinner />
                  </div>
                }>
                  <HistoryPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-screen bg-black">
                    <LoadingSpinner />
                  </div>
                }>
                  <AdminLayout />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-black">
                  <LoadingSpinner />
                </div>
              }>
                <SearchPage />
              </Suspense>
            }
          />
          {/* <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          /> */}
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <ScrollToTop />
            <AppContent />
          </Router>
        </ToastProvider>
      </AuthProvider>
    </HelmetProvider>
  );
};

export default App;
