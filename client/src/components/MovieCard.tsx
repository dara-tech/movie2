import React, { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Play, Heart, Check, Plus, Sparkles, Info, Star } from 'lucide-react';
import api from '../services/api';
import {
  hasPrefetchedMovie,
  registerPrefetchPromise,
} from '../utils/prefetchCache';
import MoviePlayModal from './MoviePlayModal';
import LoadingSpinner from './LoadingSpinner';

interface Movie {
  _id: string;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  runtime?: number;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
  tmdbId?: number;
  imdbId?: string;
  aiMetadata?: {
    reason?: string;
    confidence?: number;
    model?: string;
    fallback?: boolean;
    generatedAt?: string;
  };
}

interface MovieCardProps {
  movie: Movie;
  onPlay?: (movie: Movie) => void;
  onDetail?: (movie: Movie) => void;
  onAddToWatchlist?: (movie: Movie) => void;
  onRemoveFromWatchlist?: (movie: Movie) => void;
  isInWatchlist?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (movie: Movie) => void;
  isLoading?: boolean;
  isDetailLoading?: boolean;
  watchHistory?: { lastPosition: number; completed: boolean };
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onPlay,
  onDetail,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist = false,
  isFavorite = false,
  onToggleFavorite,
  isLoading = false,
  isDetailLoading = false,
  watchHistory
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState<'idle' | 'adding' | 'success' | 'error'>('idle');
  const [favoriteStatus, setFavoriteStatus] = useState<'idle' | 'toggling' | 'success' | 'error'>('idle');
  const [playModalMode, setPlayModalMode] = useState<'play' | 'info' | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardHeightRef = useRef<number | null>(null);
  const prefetchedRef = useRef(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).getFullYear().toString();
  };

  const isUpcoming = useCallback(() => {
    const releaseDate = new Date(movie.releaseDate);
    const currentDate = new Date();
    return releaseDate > currentDate;
  }, [movie.releaseDate]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpcoming() || isLoading) return;
    if (onPlay) {
      onPlay(movie);
    } else {
      setPlayModalMode('play');
    }
  };

  const handleCardClick = () => {
    if (isUpcoming() || isLoading) return;
    if (onPlay) {
      onPlay(movie);
    } else {
      setPlayModalMode('play');
    }
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUpcoming()) return;
    setPlayModalMode('info');
  };

  const handleAddToWatchlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (watchlistStatus === 'idle') {
      setWatchlistStatus('adding');
      
      try {
        if (isInWatchlist && onRemoveFromWatchlist) {
          await onRemoveFromWatchlist(movie);
          setWatchlistStatus('success');
        } else if (!isInWatchlist && onAddToWatchlist) {
          await onAddToWatchlist(movie);
          setWatchlistStatus('success');
        }
        
        setTimeout(() => {
          setWatchlistStatus('idle');
        }, 2000);
      } catch (error) {
        setWatchlistStatus('error');
        
        setTimeout(() => {
          setWatchlistStatus('idle');
        }, 3000);
      }
    }
  };

  const handleToggleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (favoriteStatus === 'idle' && onToggleFavorite) {
      setFavoriteStatus('toggling');
      
      try {
        await onToggleFavorite(movie);
        setFavoriteStatus('success');
        
        setTimeout(() => {
          setFavoriteStatus('idle');
        }, 2000);
      } catch (error) {
        setFavoriteStatus('error');
        
        setTimeout(() => {
          setFavoriteStatus('idle');
        }, 3000);
      }
    }
  };

  const getAiReason = () => {
    const reason = movie.aiMetadata?.reason?.trim();
    if (!reason) return null;
    if (reason.length > 140) {
      return `${reason.slice(0, 137)}…`;
    }
    return reason;
  };

  // Aggressive prefetch movie details on hover - instant execution
  const prefetchMovieDetails = useCallback(() => {
    if (isUpcoming() || prefetchedRef.current) return;
    
    const movieId = movie._id;
    if (!movieId) return;

    // Check if already cached
    if (hasPrefetchedMovie(movieId)) {
      return;
    }

    prefetchedRef.current = true;

    // One lightweight request on hover — detail page loads the rest on demand
    registerPrefetchPromise(
      movieId,
      api.get(`/api/movies/${movieId}`).then((response) => response.data).catch(() => null)
    );
  }, [isUpcoming, movie._id]);

  // Reset prefetched flag when movie changes
  useEffect(() => {
    prefetchedRef.current = false;
  }, [movie._id]);

  const handleMouseEnter = useCallback(() => {
    if (isUpcoming()) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (cardRef.current) {
      cardHeightRef.current = cardRef.current.offsetHeight;
    }
    setIsHovered(true);
    prefetchMovieDetails();
  }, [isUpcoming, prefetchMovieDetails]);

  const handleCardMouseLeave = useCallback(() => {
    if (isUpcoming()) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      closeTimeoutRef.current = null;
    }, 150);
  }, [isUpcoming]);



  useEffect(() => {
    const hoverTimeout = hoverTimeoutRef.current;
    const closeTimeout = closeTimeoutRef.current;
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      if (closeTimeout) clearTimeout(closeTimeout);
    };
  }, [movie._id]);

  const basePoster = movie.posterPath
    ? `https://image.tmdb.org/t/p/w342${movie.posterPath}`
    : '/placeholder-movie.jpg';
  const hiResPoster = movie.posterPath
    ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
    : '/placeholder-movie.jpg';

  return (
    <div 
      ref={cardRef}
      style={cardHeightRef.current ? { height: cardHeightRef.current } : undefined}
      className={`group relative flex-shrink-0 snap-start transition-all duration-300 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 ${
        isUpcoming() ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      {/* Card */}
      <div className={`
        relative overflow-hidden bg-transparent border-none shadow-lg sm:shadow-2xl
        w-full h-full opacity-100
        ${isUpcoming() ? 'cursor-not-allowed' : 'cursor-pointer'}
      `}>
        {/* Play Clickable Area */}
        <div 
          className={`absolute inset-0 z-20 transition-colors duration-200 ${
            isUpcoming() ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'
          }`}
          onClick={handleCardClick}
          title={isUpcoming() ? 'Coming Soon' : 'Click to play'}
        />
        
        {/* Poster - rounded-2xl, subtle border */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5">
          <img
            src={basePoster}
            srcSet={movie.posterPath ? `${basePoster} 500w, ${hiResPoster} 780w` : undefined}
            sizes="(max-width: 768px) 45vw, (max-width: 1280px) 20vw, 15vw"
            alt={movie.title}
            className={`
              w-full h-full object-cover transition-all duration-500
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              ${isHovered ? 'scale-105 brightness-110' : 'scale-100'}
            `}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              e.currentTarget.src = '/placeholder-movie.jpg';
              setImageLoaded(true);
            }}
          />
          
          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-zinc-900/90">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer bg-[length:200%_100%]" />
            </div>
          )}

          {/* Modern gradient overlay with title space */}
          <div className="absolute inset-0" />

          {/* Top-left Badges - glass pills (match reference) */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-30 flex flex-wrap items-center gap-1.5 max-w-[80%]">
            <Badge className="bg-white/[0.08] text-white text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 backdrop-blur-md border border-white/10 rounded-full">
              {formatDate(movie.releaseDate)}
            </Badge>
            {movie.voteAverage >= 8 && !isUpcoming() && (
              <Badge className="bg-amber-400/90 text-black text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 backdrop-blur-md border border-amber-300/40 rounded-full">
                TOP
              </Badge>
            )}
          </div>

          {/* COMING SOON - bottom left, stuck to corner, no padding */}
          {isUpcoming() && (
            <div className="absolute bottom-0 left-0 z-30">
              <Badge className="rounded-tr-md rounded-bl-2xl rounded-tl-none rounded-br-none bg-violet-600/80 text-white text-[11px] sm:text-xs font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 backdrop-blur-md border-0 border-t border-r border-white/10">
                COMING SOON
              </Badge>
            </div>
          )}

          {/* Action Buttons - Top Right: outline icons on glass circles (no override of behavior) */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 flex items-center gap-1.5 sm:gap-2">
            {onToggleFavorite && (
              <Button
                onClick={handleToggleFavoriteClick}
                disabled={favoriteStatus === 'toggling'}
                size="sm"
                variant="ghost"
                className={`rounded-full h-8 w-8 sm:h-9 sm:w-9 p-0 border transition-all duration-200 ${
                  favoriteStatus === 'success'
                    ? 'bg-amber-500/90 text-white border-amber-400/40'
                    : favoriteStatus === 'error'
                    ? 'bg-red-500/80 text-white border-red-400/40'
                    : isFavorite
                    ? 'bg-amber-500/80 text-white border-amber-400/40'
                    : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/[0.15] backdrop-blur-md'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                {favoriteStatus === 'toggling' ? (
                  <LoadingSpinner size="xs" inline color="white" />
                ) : (
                  <Star className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isFavorite ? 'fill-current' : ''}`} />
                )}
              </Button>
            )}
            <Button
              onClick={handleAddToWatchlistClick}
              disabled={watchlistStatus === 'adding'}
              size="sm"
              variant="ghost"
              className={`rounded-full h-8 w-8 sm:h-9 sm:w-9 p-0 border transition-all duration-200 ${
                watchlistStatus === 'success'
                  ? 'bg-emerald-500/90 text-white border-emerald-400/40'
                  : watchlistStatus === 'error'
                  ? 'bg-red-500/80 text-white border-red-400/40'
                  : isInWatchlist
                  ? 'bg-rose-500/80 text-white border-rose-400/40'
                  : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/[0.15] backdrop-blur-md'
              }`}
              title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {watchlistStatus === 'adding' ? (
                <LoadingSpinner size="xs" inline color="white" />
              ) : watchlistStatus === 'success' ? (
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : watchlistStatus === 'error' ? (
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 rotate-45" />
              ) : (
                <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isInWatchlist ? 'fill-current' : ''}`} />
              )}
            </Button>
          </div>

          {/* Bottom Overlay - AI reason unchanged */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 z-20">
            {getAiReason() && (
              <div className="flex items-start gap-1.5 text-white/90">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0 text-amber-400/90" />
                <p className="text-[10px] sm:text-xs leading-snug font-medium">
                  {getAiReason()}
                  {typeof movie.aiMetadata?.confidence === 'number' && (
                    <span className="ml-1 text-white/60">· {Math.round(movie.aiMetadata.confidence * 100)}% match</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Info Icon - Bottom Right: dark glass circle (match reference) */}
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-30">
            <Button
              onClick={handleInfoClick}
              disabled={isUpcoming()}
              size="sm"
              variant="ghost"
              className="rounded-full h-8 w-8 sm:h-9 sm:w-9 p-0 bg-black/40 text-white border border-white/10 hover:bg-black/60 backdrop-blur-md transition-all duration-200"
              title="View details"
            >
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>

          {/* Play Button Overlay */}
          <div 
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"
            onMouseEnter={prefetchMovieDetails}
          >
            <Button
              onClick={handlePlayClick}
              size="lg"
              disabled={isLoading || isUpcoming()}
              className="bg-white/90 hover:bg-white text-black rounded-full h-12 w-12 sm:h-16 sm:w-16 p-0 shadow-xl sm:shadow-2xl hover:shadow-white/50 transition-all duration-300 hover:scale-110 pointer-events-auto"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" inline color="cyan" />
              ) : (
                <Play className="h-4 w-4 sm:h-6 sm:w-6 ml-0.5 sm:ml-1" fill="currentColor" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Play Modal - Rendered via portal at document body level */}
      {playModalMode !== null && typeof document !== 'undefined' && createPortal(
        <MoviePlayModal
          movie={movie}
          onClose={() => setPlayModalMode(null)}
          onAddToWatchlist={onAddToWatchlist}
          onRemoveFromWatchlist={onRemoveFromWatchlist}
          isInWatchlist={isInWatchlist}
          autoPlay={playModalMode === 'play'}
        />,
        document.body
      )}
    </div>
  );
};

export default React.memo(MovieCard);
