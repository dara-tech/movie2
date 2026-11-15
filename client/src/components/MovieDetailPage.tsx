import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, X, Tv, MessageSquare } from 'lucide-react';
import api from '../services/api';
import streamingService, {
  StreamingOption,
  sortStreamingOptionsForDisplay,
  pickDefaultStreamOption,
  isDirectTvStreamUrl,
} from '../services/streamingService';
import { getPrefetchedMovie } from '../utils/prefetchCache';
import { extractObjectId, moviePath } from '../utils/paths';
import { MovieSEO } from './SEO';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { trackEvent } from '../utils/activityTracker';
import LoadingSpinner from './LoadingSpinner';
import VpnBanner from './VpnBanner';
import MovieReviews from './MovieReviews';

export interface Movie {
  _id: string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  genres?: Array<{ name: string }>;
  posterPath?: string;
  backdropPath?: string;
  runtime?: number;
  tmdbId?: number;
  imdbId?: string;
  vidsrcUrl?: string;
  streamingUrl?: string;
}

/**
 * Minimal Cinema Stream Embed page for /movie/:id (slug route).
 * Replaces the heavy legacy detail page with the clean, fast player interface.
 */
const MovieDetailPage: React.FC = () => {
  const { id: paramSlugOrId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const objectId = extractObjectId(paramSlugOrId);

  const [movie, setMovie] = useState<Movie | null>(() => {
    if (objectId) {
      const prefetched = getPrefetchedMovie(objectId);
      if (prefetched && !(prefetched instanceof Promise)) {
        return prefetched;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!movie);
  const [streams, setStreams] = useState<StreamingOption[]>([]);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const reloadKey = 0;
  const [isBuffering, setIsBuffering] = useState(true);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [showReviews, setShowReviews] = useState(false);

  // Fetch movie data by extracted ID
  useEffect(() => {
    let isCancelled = false;
    const fetchMovieData = async () => {
      if (!objectId) {
        setLoading(false);
        return;
      }

      try {
        const prefetched = getPrefetchedMovie(objectId);
        let data: Movie | null = null;
        if (prefetched) {
          data = prefetched instanceof Promise ? await prefetched : prefetched;
        }

        if (!data) {
          const res = await api.get(`/api/movies/${objectId}`);
          data = res.data?.movie || res.data;
        }

        if (data && !isCancelled) {
          setMovie(data);
          // Canonicalize slug in browser URL if needed
          const canonical = moviePath(data);
          if (window.location.pathname !== canonical) {
            navigate(canonical, { replace: true });
          }
        }
      } catch (err) {
        console.error('Failed to load movie:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchMovieData();
    return () => {
      isCancelled = true;
    };
  }, [objectId, navigate]);

  // Generate streams whenever movie is loaded
  useEffect(() => {
    if (!movie) return;

    let isCancelled = false;
    const loadStreams = async () => {
      try {
        const rawOptions = await streamingService.generateMovieStreamingOptions(movie);
        const sorted = sortStreamingOptionsForDisplay(rawOptions);
        if (!isCancelled) {
          setStreams(sorted);
          const defaultOpt = pickDefaultStreamOption(sorted);
          if (defaultOpt) {
            const idx = sorted.findIndex((o) => o.id === defaultOpt.id);
            if (idx !== -1) setActiveStreamIndex(idx);
          }
        }
      } catch {
        const syncOptions = streamingService.generateMovieStreamingOptionsSync(movie);
        const sorted = sortStreamingOptionsForDisplay(syncOptions);
        if (!isCancelled) setStreams(sorted);
      }
    };

    loadStreams();
    return () => {
      isCancelled = true;
    };
  }, [movie]);

  // Check watchlist status
  useEffect(() => {
    if (!user || !movie?._id) return;
    api
      .get(`/api/watchlist/check/${movie._id}`)
      .then((res) => setIsWatchlisted(Boolean(res.data?.inWatchlist)))
      .catch(() => {});
  }, [user, movie?._id]);

  // Buffer loader timer
  useEffect(() => {
    setIsBuffering(true);
    const timer = setTimeout(() => setIsBuffering(false), 1400);
    return () => clearTimeout(timer);
  }, [activeStreamIndex, reloadKey]);

  // Track event
  useEffect(() => {
    if (movie) {
      trackEvent({
        eventType: 'movie_play',
        path: window.location.pathname,
        contentType: 'movie',
        contentId: movie._id,
        metadata: { title: movie.title, source: 'movie_route' },
      });
    }
  }, [movie]);

  const handleToggleWatchlist = async () => {
    if (!user) {
      showToast('Please log in to manage your watchlist', 'error');
      return;
    }
    if (!movie?._id) return;

    try {
      if (isWatchlisted) {
        await api.delete(`/api/watchlist/movies/${movie._id}`);
        setIsWatchlisted(false);
        showToast('Removed from Watchlist', 'info');
      } else {
        await api.post(`/api/watchlist/movies/${movie._id}`);
        setIsWatchlisted(true);
        showToast('Added to Watchlist', 'success');
      }
    } catch {
      showToast('Failed to update watchlist', 'error');
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/movies');
    }
  };

  const currentStream = streams[activeStreamIndex] || null;
  const isDirect = currentStream?.url ? isDirectTvStreamUrl(currentStream.url) : false;
  const title = movie?.title || 'Movie';
  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden select-none">
      {movie && <MovieSEO movie={movie as any} />}

      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-cyan-500/20 bg-neutral-950/95 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 mr-3">
          <h1 className="text-white text-sm sm:text-base md:text-lg font-bold truncate">
            {title}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Team Reviews Button */}
          <button
            type="button"
            onClick={() => setShowReviews(true)}
            title="Team & Audience Reviews"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 hover:text-white text-xs font-semibold shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">Team Reviews</span>
          </button>

          {/* Watchlist toggle */}
          <button
            type="button"
            onClick={handleToggleWatchlist}
            title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className={`w-8 h-8 rounded-lg border transition-all flex items-center justify-center active:scale-95 ${
              isWatchlisted
                ? 'border-cyan-500/50 bg-cyan-950/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 transition-colors ${
                isWatchlisted ? 'text-cyan-400 fill-cyan-400' : ''
              }`}
            />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={handleBack}
            title="Close"
            className="w-8 h-8 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-neutral-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Video Player Stage */}
      <div className="flex-1 w-full min-h-0 bg-black overflow-hidden relative flex flex-col">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black">
            <LoadingSpinner size="lg" text="Loading Cinema Player..." />
          </div>
        ) : currentStream?.url ? (
          isDirect ? (
            <div className="relative w-full h-full flex-1 bg-black flex items-center justify-center overflow-hidden">
              <video
                key={`direct-${currentStream.url}-${reloadKey}`}
                src={currentStream.url}
                className="w-full h-full bg-black object-contain"
                controls
                autoPlay
                playsInline
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex-1 bg-black overflow-hidden">
              {isBuffering && (
                <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none">
                  <LoadingSpinner size="md" text="Connecting Cinema Stream..." />
                </div>
              )}
              <iframe
                key={`cinema-${currentStream.url}-${reloadKey}`}
                src={currentStream.url}
                className="absolute inset-0 w-full h-full border-0 outline-none bg-black block"
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#000000',
                  colorScheme: 'dark',
                }}
                allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer *; gyroscope *"
                allowFullScreen
                referrerPolicy="origin"
                title={title}
                onLoad={() => setIsBuffering(false)}
              />
            </div>
          )
        ) : (
          <div className="w-full h-full flex-1 flex flex-col items-center justify-center bg-black">
            <LoadingSpinner size="lg" text="Connecting Cinema Stream Provider..." />
          </div>
        )}
      </div>

      {/* Bottom Stream Providers Bar */}
      <footer className="px-4 sm:px-6 pt-3 pb-4 sm:pb-5 border-t border-cyan-500/20 bg-neutral-950/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
            <Tv className="w-3.5 h-3.5 text-cyan-400" />
            <span>Server:</span>
          </span>
          <div
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {streams.map((stream, idx) => {
              const isActive = idx === activeStreamIndex;
              const streamNum = idx + 1;
              const quality = stream.name.includes('4K') ? '4K' : '1080p';
              return (
                <button
                  key={stream.id || idx}
                  type="button"
                  onClick={() => setActiveStreamIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-blue-600 border-cyan-400 text-white shadow-md shadow-blue-500/30'
                      : 'bg-neutral-900/90 border-neutral-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-neutral-800/80'
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
                  )}
                  <span>Stream {streamNum}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded font-mono ${
                    isActive ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-400/30' : 'bg-slate-800/80 text-slate-400'
                  }`}>
                    {quality}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <VpnBanner variant="player-bar" />
        </div>
      </footer>

      {/* Team & User Reviews Slide-over Drawer */}
      {showReviews && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowReviews(false)} />
          <div className="relative w-full max-w-2xl h-full bg-neutral-950 border-l border-cyan-500/30 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.15)] flex flex-col z-10 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/20 bg-neutral-900/60 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <h3 className="text-white font-bold text-base tracking-wide">
                  Team Reviews • {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviews(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
                title="Close Reviews"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <MovieReviews
                mediaId={movie?._id}
                title={movie?.title}
                mediaType="movie"
                onClose={() => setShowReviews(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetailPage;
