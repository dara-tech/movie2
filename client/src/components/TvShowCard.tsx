import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Play, Plus, Heart, Check, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiConfig from '../config/api';
import {
  hasPrefetchedTvShow,
  registerTvShowPrefetchPromise,
} from '../utils/prefetchTvShow';
import { tvShowPath } from '../utils/paths';
import TvShowPlayModal from './TvShowPlayModal';
import LoadingSpinner from './LoadingSpinner';

interface TVShow {
  _id: string;
  name: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate: string;
  lastAirDate?: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  averageRuntime?: number;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
  tmdbId?: number;
  imdbId?: string;
  status?: string;
  type?: string;
  aiMetadata?: {
    reason?: string;
    confidence?: number;
    model?: string;
    fallback?: boolean;
    generatedAt?: string;
  };
}

interface TVShowCardProps {
  tvShow: TVShow;
  onPlay?: (tvShow: TVShow) => void;
  onAddToWatchlist?: (tvShow: TVShow) => void;
  onRemoveFromWatchlist?: (tvShow: TVShow) => void;
  isInWatchlist?: boolean;
}

const TVShowCard: React.FC<TVShowCardProps> = ({
  tvShow,
  onPlay,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist = false
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState<'idle' | 'adding' | 'success' | 'error'>('idle');
  const [playModalMode, setPlayModalMode] = useState<'play' | 'info' | null>(null);
  const navigate = useNavigate();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefetchedRef = useRef(false);

  const isUpcoming = useCallback(() => {
    const firstAirDate = new Date(tvShow.firstAirDate);
    const currentDate = new Date();
    return firstAirDate > currentDate;
  }, [tvShow.firstAirDate]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUpcoming()) return;
    if (onPlay) {
      onPlay(tvShow);
    } else {
      navigate(tvShowPath(tvShow));
    }
  };

  const handleCardClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isUpcoming()) return;
    if (onPlay) {
      onPlay(tvShow);
    } else {
      navigate(tvShowPath(tvShow));
    }
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUpcoming()) return;
    setPlayModalMode('info');
  };

  const prefetchTvShowDetails = useCallback(() => {
    if (isUpcoming() || prefetchedRef.current) return;

    const tvShowId = tvShow._id;
    if (!tvShowId) return;

    if (hasPrefetchedTvShow(tvShowId)) {
      return;
    }

    prefetchedRef.current = true;

    const baseURL = apiConfig.baseURL || 'http://localhost:5001';
    registerTvShowPrefetchPromise(
      tvShowId,
      fetch(`${baseURL}/api/tvshows/${tvShowId}`, {
        headers: { 'Content-Type': 'application/json' },
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .catch(() => null)
    );
  }, [tvShow._id, isUpcoming]);

  useEffect(() => {
    prefetchedRef.current = false;
  }, [tvShow._id]);

  const handleAddToWatchlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (watchlistStatus === 'idle') {
      setWatchlistStatus('adding');
      
      try {
        if (isInWatchlist && onRemoveFromWatchlist) {
          await onRemoveFromWatchlist(tvShow);
          setWatchlistStatus('success');
        } else if (!isInWatchlist && onAddToWatchlist) {
          await onAddToWatchlist(tvShow);
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

  const posterUrl = tvShow.posterPath 
    ? `https://image.tmdb.org/t/p/w342${tvShow.posterPath}` 
    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iIzFmMjkzNyIvPgogIDxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiMzNzQxNTEiIHN0cm9rZT0iIzZiNzI4MCIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHRleHQgeD0iMTUwIiB5PSIyMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Y2EzYWYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+Tm8gSW1hZ2U8L3RleHQ+CiAgPHRleHQgeD0iMTUwIiB5PSIyMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Y2EzYWYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiI+QXZhaWxhYmxlPC90ZXh0Pgo8L3N2Zz4K';

  const handleMouseEnter = useCallback(() => {
    if (isUpcoming()) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    prefetchTvShowDetails();
  }, [isUpcoming, prefetchTvShowDetails]);

  const handleCardMouseLeave = useCallback(() => {
    if (isUpcoming()) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, [isUpcoming]);

  useEffect(() => {
    const hoverTimeout = hoverTimeoutRef.current;
    const closeTimeout = closeTimeoutRef.current;
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      if (closeTimeout) clearTimeout(closeTimeout);
    };
  }, [tvShow._id]);

  return (
    <div 
      ref={cardRef}
      className={`group relative flex-shrink-0 snap-start transition-all duration-300 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 ${
        isUpcoming() ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      {/* Card */}
      <Card className={`
        relative overflow-hidden bg-transparent border-none shadow-lg sm:shadow-2xl
        w-full h-full opacity-100
        ${isUpcoming() ? 'cursor-not-allowed' : 'cursor-pointer'}
      `}>
        {/* Play Clickable Area */}
        <div 
          className={`absolute inset-0 z-20 ${
            isUpcoming() ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCardClick(e);
          }}
          title={isUpcoming() ? 'Coming Soon' : 'Click to play'}
        />
        
        {/* Modern Poster Image */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5">
          <img
            src={posterUrl}
            alt={tvShow.name}
            className={`
              w-full h-full object-cover
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
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
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Year Badge */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-30">
            <Badge className="bg-white/20 text-white text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 backdrop-blur-sm border border-white/30 shadow-lg rounded-full">
              {new Date(tvShow.firstAirDate).getFullYear()}
            </Badge>
          </div>

          {/* Heart Icon */}
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30">
            <Button
              onClick={handleAddToWatchlistClick}
              disabled={watchlistStatus === 'adding'}
              size="sm"
              variant="ghost"
              className={`rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0 ${
                watchlistStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : watchlistStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : isInWatchlist
                  ? 'bg-red-600/90 text-white hover:bg-red-700 shadow-lg shadow-red-500/30'
                  : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 backdrop-blur-sm hover:shadow-lg hover:shadow-red-500/20'
              }`}
            >
              {watchlistStatus === 'adding' ? (
                <LoadingSpinner size="xs" inline color="white" />
              ) : watchlistStatus === 'success' ? (
                <Check className="h-3 w-3 sm:h-4 sm:w-4" />
              ) : watchlistStatus === 'error' ? (
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 rotate-45" />
              ) : (
                <Heart className={`h-3 w-3 sm:h-4 sm:w-4 ${
                  isInWatchlist 
                    ? 'fill-red-500 text-red-500' 
                    : 'text-gray-300 hover:text-red-400'
                }`} />
              )}
            </Button>
          </div>

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 z-10 pointer-events-none">
            <Button
              onClick={handlePlayClick}
              size="lg"
              className="bg-white/90 hover:bg-white text-black rounded-full h-12 w-12 sm:h-16 sm:w-16 p-0 shadow-xl sm:shadow-2xl hover:shadow-white/50 pointer-events-auto"
            >
              <Play className="h-4 w-4 sm:h-6 sm:w-6 ml-0.5 sm:ml-1" fill="currentColor" />
            </Button>
          </div>

          {/* Info Icon (Detail) - Bottom Right */}
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-30">
            <Button
              onClick={handleInfoClick}
              disabled={isUpcoming()}
              size="sm"
              variant="ghost"
              className="rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0 bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/20"
              title="View details"
            >
              <Info className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Play Modal - Rendered via portal at document body level */}
      {playModalMode !== null && typeof document !== 'undefined' && createPortal(
        <TvShowPlayModal
          tvShow={tvShow}
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

export default React.memo(TVShowCard);