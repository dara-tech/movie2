import React, { useState, useEffect, useCallback } from 'react';
import { Star, X, Tv } from 'lucide-react';
import api from '../services/api';
import streamingService, {
  StreamingOption,
  sortStreamingOptionsForDisplay,
  pickDefaultStreamOption,
  isDirectTvStreamUrl,
} from '../services/streamingService';
import { getPrefetchedMovie } from '../utils/prefetchCache';

export interface Movie {
  _id: string;
  title: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  genres?: Array<{ name: string }>;
  posterPath?: string;
  backdropPath?: string;
  runtime?: number;
  tmdbId?: number;
  imdbId?: string;
  vidsrcUrl?: string;
  streamingUrl?: string;
}

export interface MoviePlayModalProps {
  movie: Partial<Movie> & { _id: string; title: string };
  onClose: () => void;
  onAddToWatchlist?: (movie: any) => void;
  onRemoveFromWatchlist?: (movie: any) => void;
  isInWatchlist?: boolean;
  autoPlay?: boolean;
}

const MoviePlayModal: React.FC<MoviePlayModalProps> = ({
  movie,
  onClose,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist: initialInWatchlist = false,
}) => {
  const [fullMovie, setFullMovie] = useState<Movie | null>(null);
  const [streams, setStreams] = useState<StreamingOption[]>([]);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const reloadKey = 0;
  const [isBuffering, setIsBuffering] = useState(true);
  const [isWatchlisted, setIsWatchlisted] = useState(initialInWatchlist);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Sync initial watchlist state
  useEffect(() => {
    setIsWatchlisted(initialInWatchlist);
  }, [initialInWatchlist]);

  // Load movie data & generate stream options
  useEffect(() => {
    let isMounted = true;

    const setupStreamsForMovie = (data: Movie) => {
      if (!isMounted) return;
      setFullMovie(data);

      const syncOptions = streamingService.generateMovieStreamingOptionsSync(data);
      const sorted = sortStreamingOptionsForDisplay(syncOptions);
      setStreams(sorted);

      const defaultOpt = pickDefaultStreamOption(syncOptions);
      const defIdx = sorted.findIndex((s) => s.id === defaultOpt?.id);
      setActiveStreamIndex(defIdx >= 0 ? defIdx : 0);

      // Async enhancement (fetch extra mirrors if needed)
      streamingService.generateMovieStreamingOptions(data).then((asyncOpts) => {
        if (!isMounted || !asyncOpts?.length) return;
        const mergedSorted = sortStreamingOptionsForDisplay(asyncOpts);
        setStreams(mergedSorted);
      }).catch(() => {});
    };

    // Check prefetch first for instant response
    const prefetched = getPrefetchedMovie(movie._id);
    if (prefetched) {
      if (prefetched instanceof Promise) {
        prefetched.then((d) => {
          if (d) setupStreamsForMovie(d);
        });
      } else {
        setupStreamsForMovie(prefetched);
      }
    } else {
      // Fallback: immediate options from passed movie + fresh API fetch
      setupStreamsForMovie(movie as Movie);
      api.get(`/api/movies/${movie._id}`).then((res) => {
        const movieData = res.data?.data || res.data;
        if (movieData && (movieData._id || movieData.title) && isMounted) {
          setupStreamsForMovie(movieData);
        }
      }).catch(() => {});
    }

    // Record history
    api.post(`/api/movies/${movie._id}/watch`, {
      duration: 0,
      completed: false,
      lastPosition: 0,
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [movie._id, movie]);

  const currentStream = streams[activeStreamIndex] || null;
  const isDirect = currentStream?.url ? isDirectTvStreamUrl(currentStream.url) : false;

  // Buffer loader timer on stream/reload change
  useEffect(() => {
    setIsBuffering(true);
    const timer = setTimeout(() => {
      setIsBuffering(false);
    }, 1400);
    return () => clearTimeout(timer);
  }, [currentStream?.url, reloadKey]);

  const handleToggleWatchlist = useCallback(() => {
    if (!fullMovie) return;
    if (isWatchlisted) {
      onRemoveFromWatchlist?.(fullMovie);
      setIsWatchlisted(false);
    } else {
      onAddToWatchlist?.(fullMovie);
      setIsWatchlisted(true);
    }
  }, [fullMovie, isWatchlisted, onAddToWatchlist, onRemoveFromWatchlist]);

  const title = fullMovie?.title || movie.title || 'Movie';

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black text-white flex flex-col overflow-hidden select-none animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-neutral-900 bg-black shrink-0 z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 mr-3">
          <h3 className="text-white text-sm sm:text-base md:text-lg font-bold truncate">
            {title}
          </h3>
        </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Watchlist toggle */}
            <button
              type="button"
              onClick={handleToggleWatchlist}
              title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
              className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <Star
                className={`w-3.5 h-3.5 transition-colors ${
                  isWatchlisted ? 'text-indigo-400 fill-indigo-400' : ''
                }`}
              />
            </button>

            {/* Close modal */}
            <button
              type="button"
              onClick={onClose}
              title="Close player"
              className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-red-600/80 hover:border-red-500 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Video Player Stage */}
        <div className="flex-1 w-full min-h-0 bg-black overflow-hidden relative flex flex-col">
          {currentStream?.url ? (
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
                  <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <div className="w-9 h-9 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <span className="text-slate-400 text-sm font-medium">
                      Connecting Cinema Stream...
                    </span>
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
            <div className="w-full h-full flex-1 flex flex-col items-center justify-center gap-3 bg-black">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm font-medium">
                Connecting Cinema Stream Provider...
              </p>
            </div>
          )}
        </div>

        {/* Bottom Stream Providers Bar */}
        <footer className="px-4 sm:px-6 pt-3 pb-4 sm:pb-5 border-t border-neutral-900 bg-black flex items-center gap-3 shrink-0 z-20">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 shrink-0">
            <Tv className="w-3.5 h-3.5 text-indigo-400" />
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                    isActive
                      ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  )}
                  <span>Stream {streamNum}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1 py-0.5 rounded font-mono">
                    {quality}
                  </span>
                </button>
              );
            })}
          </div>
        </footer>
    </div>
  );
};

export default MoviePlayModal;
