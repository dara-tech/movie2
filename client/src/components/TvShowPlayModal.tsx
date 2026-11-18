import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Tv, Star, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import streamingService, {
  StreamingOption,
  sortStreamingOptionsForDisplay,
  pickDefaultStreamOption,
  isDirectTvStreamUrl,
} from '../services/streamingService';

import { getPrefetchedTvShow } from '../utils/prefetchTvShow';
import LoadingSpinner from './LoadingSpinner';

export interface TVShow {
  _id: string;
  name: string;
  overview?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  voteAverage?: number;
  genres?: Array<{ name: string }>;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  posterPath?: string;
  backdropPath?: string;
  tmdbId?: number;
  imdbId?: string;
  seasons?: Array<{
    seasonNumber: number;
    episodeCount?: number;
    name?: string;
  }>;
}

export interface TvShowPlayModalProps {
  tvShow: Partial<TVShow> & { _id: string; name: string };
  onClose: () => void;
  onAddToWatchlist?: (tvShow: any) => void;
  onRemoveFromWatchlist?: (tvShow: any) => void;
  isInWatchlist?: boolean;
  autoPlay?: boolean;
  initialSeason?: number;
  initialEpisode?: number;
}

const TvShowPlayModal: React.FC<TvShowPlayModalProps> = ({
  tvShow,
  onClose,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist: initialInWatchlist = false,
  initialSeason = 1,
  initialEpisode = 1,
}) => {
  const [fullTvShow, setFullTvShow] = useState<TVShow | null>(null);
  const [seasonEpisodesCount, setSeasonEpisodesCount] = useState<Record<number, number>>({});
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [selectedEpisode, setSelectedEpisode] = useState(initialEpisode);
  const [streams, setStreams] = useState<StreamingOption[]>([]);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
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

  // Fetch full TV show details and prefetch cache
  useEffect(() => {
    let isMounted = true;
    const showId = tvShow._id || (tvShow as any).tmdbId || (tvShow as any).id;
    if (!showId) return;

    // Check prefetch cache first for instant seasons & metadata
    const prefetched = getPrefetchedTvShow(String(showId));
    if (prefetched) {
      if (prefetched instanceof Promise) {
        prefetched.then((d) => {
          if (d && isMounted) {
            const data = d.data || d;
            if (data && (data._id || data.name || data.seasons)) {
              setFullTvShow(data);
            }
          }
        });
      } else {
        const data = prefetched.data || prefetched;
        if (data && (data._id || data.name || data.seasons)) {
          setFullTvShow(data);
        }
      }
    }

    // Fresh API fetch
    api
      .get(`/api/tvshows/${showId}`)
      .then((res) => {
        const showData = res.data?.data || res.data;
        if (showData && (showData._id || showData.name || showData.seasons) && isMounted) {
          setFullTvShow(showData);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [tvShow._id]);

  const activeShow = fullTvShow || (tvShow as TVShow);

  // Fetch episodes for the currently selected season to get accurate episode counts
  useEffect(() => {
    let isMounted = true;
    const showId = activeShow._id || (activeShow as any).tmdbId || (activeShow as any).id;
    if (!showId) return;

    api
      .get(`/api/tvshows/${showId}/season/${selectedSeason}/episodes`)
      .then((res) => {
        const episodes = res.data?.episodes || res.data?.data?.episodes;
        if (Array.isArray(episodes) && episodes.length > 0 && isMounted) {
          setSeasonEpisodesCount((prev) => ({
            ...prev,
            [selectedSeason]: episodes.length,
          }));
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeShow._id, selectedSeason]);

  // Generate streams whenever season, episode, or activeShow details change
  useEffect(() => {
    let isMounted = true;
    const epObj = { seasonNumber: selectedSeason, episodeNumber: selectedEpisode };

    const syncOptions = streamingService.generateEpisodeStreamingOptionsSync(epObj, activeShow);
    const sorted = sortStreamingOptionsForDisplay(syncOptions);
    setStreams(sorted);

    const defaultOpt = pickDefaultStreamOption(syncOptions);
    const defIdx = sorted.findIndex((s) => s.id === defaultOpt?.id);
    setActiveStreamIndex(defIdx >= 0 ? defIdx : 0);

    // Async enhancement
    streamingService
      .generateEpisodeStreamingOptions(epObj, activeShow)
      .then((asyncOpts) => {
        if (!isMounted || !asyncOpts?.length) return;
        const mergedSorted = sortStreamingOptionsForDisplay(asyncOpts);
        setStreams(mergedSorted);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedSeason, selectedEpisode, activeShow]);

  // Seasons list
  const availableSeasons = useMemo(() => {
    if (activeShow.seasons && activeShow.seasons.length > 0) {
      const valid = activeShow.seasons
        .map((s) => s.seasonNumber)
        .filter((n) => typeof n === 'number' && n > 0)
        .sort((a, b) => a - b);
      if (valid.length > 0) {
        return Array.from(new Set(valid));
      }
    }
    const count = activeShow.numberOfSeasons || 1;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeShow]);

  // Episodes count for the currently selected season
  const episodesCount = useMemo(() => {
    // 1. Precise count from season episodes fetch
    if (seasonEpisodesCount[selectedSeason] && seasonEpisodesCount[selectedSeason] > 0) {
      return seasonEpisodesCount[selectedSeason];
    }
    // 2. Count from activeShow.seasons metadata
    if (activeShow.seasons && activeShow.seasons.length > 0) {
      const currentSeasonMeta = activeShow.seasons.find((s) => s.seasonNumber === selectedSeason);
      if (currentSeasonMeta?.episodeCount && currentSeasonMeta.episodeCount > 0) {
        return currentSeasonMeta.episodeCount;
      }
    }
    return 24; // clean default fallback if TMDB metadata hasn't loaded individual count
  }, [activeShow, selectedSeason, seasonEpisodesCount]);

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
    if (isWatchlisted) {
      onRemoveFromWatchlist?.(activeShow);
      setIsWatchlisted(false);
    } else {
      onAddToWatchlist?.(activeShow);
      setIsWatchlisted(true);
    }
  }, [activeShow, isWatchlisted, onAddToWatchlist, onRemoveFromWatchlist]);

  const episodesContainerRef = useRef<HTMLDivElement | null>(null);
  const seasonsContainerRef = useRef<HTMLDivElement | null>(null);
  const serversContainerRef = useRef<HTMLDivElement | null>(null);
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null);
  const activeSeasonRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll active episode into view smoothly
  useEffect(() => {
    if (activeEpisodeRef.current) {
      activeEpisodeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedEpisode, selectedSeason]);

  // Auto-scroll active season into view smoothly
  useEffect(() => {
    if (activeSeasonRef.current) {
      activeSeasonRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedSeason]);

  const handleHorizontalWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const scrollEpisodes = (direction: 'left' | 'right') => {
    if (episodesContainerRef.current) {
      episodesContainerRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth',
      });
    }
  };

  const scrollSeasons = (direction: 'left' | 'right') => {
    if (seasonsContainerRef.current) {
      seasonsContainerRef.current.scrollBy({
        left: direction === 'left' ? -180 : 180,
        behavior: 'smooth',
      });
    }
  };

  const scrollServers = (direction: 'left' | 'right') => {
    if (serversContainerRef.current) {
      serversContainerRef.current.scrollBy({
        left: direction === 'left' ? -180 : 180,
        behavior: 'smooth',
      });
    }
  };

  const handleSeasonChange = (sNum: number) => {
    setSelectedSeason(sNum);
    setSelectedEpisode(1);
    setReloadKey((k) => k + 1);
  };

  const handleEpisodeChange = (epNum: number) => {
    setSelectedEpisode(epNum);
    setReloadKey((k) => k + 1);
  };

  const title = activeShow.name || tvShow.name || 'TV Show';

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

          <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0 font-mono">
            S{selectedSeason} • E{selectedEpisode}
          </span>
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
                  key={`direct-${selectedSeason}-${selectedEpisode}-${reloadKey}`}
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
                  <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center pointer-events-none">
                    <LoadingSpinner size="lg" text="Connecting Cinema Stream..." />
                  </div>
                )}
                <iframe
                  key={`cinema-${currentStream.url}-${selectedSeason}-${selectedEpisode}-${reloadKey}`}
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
                  title={`${title} - S${selectedSeason}E${selectedEpisode}`}
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

        {/* Bottom Bar: Stream Providers & Season/Episode Navigator */}
        <footer className="px-4 sm:px-6 pt-3 pb-4 sm:pb-5 border-t border-neutral-900 bg-black flex flex-col gap-2 shrink-0 z-20">
          {/* Stream Servers Row */}
          <div className="flex items-center gap-2 py-0.5 min-w-0">
            <span className="w-14 sm:w-16 text-xs font-bold text-slate-400 flex items-center gap-1.5 shrink-0">
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span>Server:</span>
            </span>
            {streams.length > 5 && (
              <button
                type="button"
                onClick={() => scrollServers('left')}
                title="Scroll streams left"
                className="w-5 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center shrink-0 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            )}
            <div
              ref={serversContainerRef}
              onWheel={handleHorizontalWheel}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0"
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
            {streams.length > 5 && (
              <button
                type="button"
                onClick={() => scrollServers('right')}
                title="Scroll streams right"
                className="w-5 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center shrink-0 transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* TV Shows Season & Episode Navigator */}
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5">
            {/* Season row */}
            <div className="flex items-center gap-2 py-0.5 min-w-0">
              <span className="w-14 sm:w-16 text-xs font-bold text-slate-400 shrink-0">
                Season:
              </span>
              {availableSeasons.length > 7 && (
                <button
                  type="button"
                  onClick={() => scrollSeasons('left')}
                  title="Scroll seasons left"
                  className="w-5 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center shrink-0 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
              )}
              <div
                ref={seasonsContainerRef}
                onWheel={handleHorizontalWheel}
                className="flex items-center gap-1.5 overflow-x-auto scroll-smooth no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {availableSeasons.map((sNum) => {
                  const isCur = sNum === selectedSeason;
                  return (
                    <button
                      key={`season-${sNum}`}
                      ref={isCur ? activeSeasonRef : null}
                      type="button"
                      onClick={() => handleSeasonChange(sNum)}
                      className={`min-w-8 h-7 px-2.5 rounded-md text-xs font-bold border transition-colors shrink-0 ${
                        isCur
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      S{sNum}
                    </button>
                  );
                })}
              </div>
              {availableSeasons.length > 7 && (
                <button
                  type="button"
                  onClick={() => scrollSeasons('right')}
                  title="Scroll seasons right"
                  className="w-5 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center shrink-0 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Episode row */}
            <div className="flex items-center gap-2 py-0.5 min-w-0">
              <span className="w-14 sm:w-16 text-xs font-bold text-slate-400 shrink-0">
                Episode:
              </span>
              {episodesCount > 10 && (
                <button
                  type="button"
                  onClick={() => scrollEpisodes('left')}
                  title="Scroll episodes left"
                  className="w-5 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center shrink-0 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
              )}
              <div
                ref={episodesContainerRef}
                onWheel={handleHorizontalWheel}
                className="flex items-center gap-1.5 overflow-x-auto scroll-smooth no-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {Array.from({ length: episodesCount }, (_, i) => i + 1).map((epNum) => {
                  const isCur = epNum === selectedEpisode;
                  return (
                    <button
                      key={`ep-${epNum}`}
                      ref={isCur ? activeEpisodeRef : null}
                      type="button"
                      onClick={() => handleEpisodeChange(epNum)}
                      className={`min-w-8 h-7 px-2 rounded-md text-xs font-bold border transition-colors shrink-0 ${
                        isCur
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {epNum}
                    </button>
                  );
                })}
              </div>
              {episodesCount > 10 && (
                <button
                  type="button"
                  onClick={() => scrollEpisodes('right')}
                  title="Scroll episodes right"
                  className="w-5 h-7 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center justify-center shrink-0 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </footer>
    </div>
  );
};

export default TvShowPlayModal;
