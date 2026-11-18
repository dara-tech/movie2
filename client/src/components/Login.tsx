import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { LogIn, Film } from 'lucide-react';
import api from '../services/api';
import DynamicLogo from './DynamicLogo';
import GoogleAuthButton from './GoogleAuthButton';
import LoadingSpinner from './LoadingSpinner';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [popularMovies, setPopularMovies] = useState<Array<{ _id?: string; title: string; posterPath?: string }>>([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  useEffect(() => {
    let isMounted = true;
    setMoviesLoading(true);
    (async () => {
      try {
        const res = await api.get('/api/movies/popular?limit=12');
        const movies = res.data?.movies || res.data?.data?.movies || [];
        if (isMounted) {
          setPopularMovies(movies);
          setMoviesLoading(false);
        }
      } catch (_) {
        if (isMounted) setMoviesLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useCallback(async (idToken: string) => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle, navigate]);

  const handleGoogleError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <div className="min-h-screen bg-black px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left: Visual grid of popular movies (lg only) */}
        <div className="hidden lg:flex">
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 w-full h-full relative overflow-hidden shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.05)_10px,rgba(255,255,255,0.05)_20px)]"></div>
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-600 border border-red-400/30">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-white font-bold text-lg">Trending Now</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-600"></div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Live</span>
                </div>
              </div>
              <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1">
                {moviesLoading ? (
                  Array.from({ length: 9 }).map((_, idx) => (
                    <div key={`skeleton-${idx}`} className="relative overflow-hidden border border-gray-900 bg-gray-950">
                      <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-950 animate-pulse"></div>
                    </div>
                  ))
                ) : (
                  <>
                    {popularMovies.slice(0, 9).map((m, idx) => (
                      <div key={(m._id || m.title || 'movie') + idx} className="group relative overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 hover:border-zinc-700 transition-all duration-200">
                        <img
                          src={m.posterPath ? `https://image.tmdb.org/t/p/w300${m.posterPath}` : '/placeholder-movie.jpg'}
                          alt={m.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder-movie.jpg'; }}
                        />
                        {/* Hover overlay with title */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                          <div className="p-2 w-full">
                            <div className="text-[10px] font-bold text-white uppercase tracking-wide line-clamp-2">{m.title}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {popularMovies.length === 0 && (
                      <div className="col-span-3 row-span-3 flex items-center justify-center text-sm text-gray-600 uppercase tracking-wide">No items to display</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Auth card */}
        <div className="w-full max-w-md mx-auto flex flex-col justify-center">
        {/* Logo */}
        <div className="mb-8">
          <DynamicLogo size="md" showTagline={true} />
        </div>

        <Card className="w-full bg-zinc-950/85 border-zinc-800 rounded-2xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-2 inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              Secure Login
            </div>
            <CardTitle className="text-3xl font-bold text-white">Welcome Back</CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Sign in to continue watching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl border border-red-900/50 text-red-400 text-sm bg-red-950/30">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-zinc-300 text-sm">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="h-12 text-base"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="password" className="text-zinc-300 text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="h-12 text-base"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 text-base" 
                disabled={loading}
              >
                {loading ? (
                  <LoadingSpinner size="sm" inline text="Signing in..." color="white" />
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </div>
                )}
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>

              <div className="flex justify-center">
                <GoogleAuthButton
                  onSuccess={handleGoogleLogin}
                  onError={handleGoogleError}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-3 pt-4">
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors duration-200"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="text-center text-sm">
                  <span className="text-gray-400">Don't have an account? </span>
                  <Link 
                    to="/register" 
                    className="text-red-400 hover:text-red-300 font-medium transition-colors duration-200"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2024 MovieStream. All rights reserved.</p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
