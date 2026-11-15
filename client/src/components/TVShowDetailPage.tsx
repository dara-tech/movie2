import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Tv, Star, X, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import api from '../services/api';
import streamingService, {
  StreamingOption,
  sortStreamingOptionsForDisplay,
  pickDefaultStreamOption,
  isDirectTvStreamUrl,
} from '../services/streamingService';
import { getPrefetchedTvShow } from '../utils/prefetchTvShow';
import { extractObjectId, tvShowPath } from '../utils/paths';
import { TVShowSEO } from './SEO';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { trackEvent } from '../utils/activityTracker';
import LoadingSpinner from './LoadingSpinner';
import VpnBanner from './VpnBanner';
import MovieReviews from './MovieReviews';

export interface TVShow {
  _id: string;
  name: string;
  overview?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  voteAverage?: number;
  voteCount?: number;
  genres?: Array<{ name: string }>;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  posterPath?: string;
  backdropPath?: string;
  tmdbId?: number;
  imdbId?: string;
  status?: string;
  type?: string;
  seasons?: Array<{
    seasonNumber: number;
    episodeCount?: number;
    name?: string;
  }>;
}

/**
 * Cinema Stream Embed Player page for /tvshow/:id (slug route).
 * Direct series player with seamless season & episode navigation,
 * multi-server streaming, and full-screen cinema UX.
 */
const TVShowDetailPage: React.FC = () => {
  const { id: paramSlugOrId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const objectId = extractObjectId(paramSlugOrId);

  // Initialize season and episode from URL query params (supports ?season= & ?episode=, or ?s= & ?ep=)
  const querySeason = parseInt(searchParams.get('season') || searchParams.get('s') || '', 10);
  const queryEpisode = parseInt(searchParams.get('episode') || searchParams.get('ep') || '', 10);

  const [tvShow, setTvShow] = useState<TVShow | null>(() => {
    if (objectId) {
      const prefetched = getPrefetchedTvShow(objectId);
      if (prefetched && !(prefetched instanceof Promise)) {
        return prefetched.data || prefetched;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(!tvShow);
  const [selectedSeason, setSelectedSeason] = useState(
    Number.isInteger(querySeason) && querySeason > 0 ? querySeason : 1
  );
  const [selectedEpisode, setSelectedEpisode] = useState(
    Number.isInteger(queryEpisode) && queryEpisode > 0 ? queryEpisode : 1
  );
  const [seasonEpisodesCount, setSeasonEpisodesCount] = useState<Record<number, number>>({});
  const [streams, setStreams] = useState<StreamingOption[]>([]);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [showReviews, setShowReviews] = useState(false);

  // Fetch full TV show metadata
  useEffect(() => {
    let isCancelled = false;
    const fetchShowData = async () => {
      if (!objectId) {
        setLoading(false);
        return;
      }

      try {
        const prefetched = getPrefetchedTvShow(objectId);
        let data: TVShow | null = null;
        if (prefetched) {
          data = prefetched instanceof Promise ? await prefetched : prefetched;
          if (data && (data as any).data) {
            data = (data as any).data;
          }
        }

        if (!data || !data.name) {
          const res = await api.get(`/api/tvshows/${objectId}`);
          data = res.data?.data || res.data?.tvShow || res.data;
        }

        if (data && !isCancelled) {
          setTvShow(data);
          // Canonicalize slug in browser URL if needed
          const canonical = tvShowPath(data);
          if (window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search}`, { replace: true });
          }
        }
      } catch (err) {
        console.error('Failed to load TV show:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchShowData();
    return () => {
      isCancelled = true;
    };
  }, [objectId, navigate]);

  const activeShow = tvShow;

  // Fetch episodes count for the selected season
  useEffect(() => {
    let isCancelled = false;
    const showId = activeShow?._id || (activeShow as any)?.tmdbId || objectId;
    if (!showId) return;

    api
      .get(`/api/tvshows/${showId}/season/${selectedSeason}/episodes`)
      .then((res) => {
        const episodes = res.data?.episodes || res.data?.data?.episodes;
        if (Array.isArray(episodes) && episodes.length > 0 && !isCancelled) {
          setSeasonEpisodesCount((prev) => ({
            ...prev,
            [selectedSeason]: episodes.length,
          }));
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [activeShow, objectId, selectedSeason]);

  // Generate streams for current episode
  useEffect(() => {
    if (!activeShow) return;

    let isCancelled = false;
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
        if (!isCancelled && asyncOpts?.length) {
          const mergedSorted = sortStreamingOptionsForDisplay(asyncOpts);
          setStreams(mergedSorted);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [selectedSeason, selectedEpisode, activeShow]);

  // Available seasons list
  const availableSeasons = useMemo(() => {
    if (activeShow?.seasons && activeShow.seasons.length > 0) {
      const valid = activeShow.seasons
        .map((s) => s.seasonNumber)
        .filter((n) => typeof n === 'number' && n > 0)
        .sort((a, b) => a - b);
      if (valid.length > 0) {
        return Array.from(new Set(valid));
      }
    }
    const count = activeShow?.numberOfSeasons || 1;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeShow]);

  // Episodes count for currently selected season
  const episodesCount = useMemo(() => {
    if (seasonEpisodesCount[selectedSeason] && seasonEpisodesCount[selectedSeason] > 0) {
      return seasonEpisodesCount[selectedSeason];
    }
    if (activeShow?.seasons && activeShow.seasons.length > 0) {
      const currentSeasonMeta = activeShow.seasons.find((s) => s.seasonNumber === selectedSeason);
      if (currentSeasonMeta?.episodeCount && currentSeasonMeta.episodeCount > 0) {
        return currentSeasonMeta.episodeCount;
      }
    }
    return 24;
  }, [activeShow, selectedSeason, seasonEpisodesCount]);

  // Check watchlist status
  useEffect(() => {
    if (!user || !activeShow?._id) return;
    api
      .get(`/api/watchlist/check/${activeShow._id}`)
      .then((res) => setIsWatchlisted(Boolean(res.data?.inWatchlist)))
      .catch(() => {});
  }, [user, activeShow?._id]);

  // Buffer loader timer
  const currentStream = streams[activeStreamIndex] || null;
  useEffect(() => {
    setIsBuffering(true);
    const timer = setTimeout(() => setIsBuffering(false), 1400);
    return () => clearTimeout(timer);
  }, [currentStream?.url, reloadKey]);

  // Track event
  useEffect(() => {
    if (activeShow) {
      trackEvent({
        eventType: 'tv_play',
        path: location.pathname,
        contentType: 'tvshow',
        contentId: activeShow._id,
        metadata: {
          title: activeShow.name,
          season: selectedSeason,
          episode: selectedEpisode,
          source: 'tvshow_route',
        },
      });
    }
  }, [activeShow, selectedSeason, selectedEpisode, location.pathname]);

  const handleToggleWatchlist = async () => {
    if (!user) {
      showToast('Please log in to manage your watchlist', 'error');
      return;
    }
    if (!activeShow?._id) return;

    try {
      if (isWatchlisted) {
        await api.delete(`/api/watchlist/tvshows/${activeShow._id}`);
        setIsWatchlisted(false);
        showToast('Removed from Watchlist', 'info');
      } else {
        await api.post(`/api/watchlist/tvshows/${activeShow._id}`);
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
      navigate('/tvshows');
    }
  };

  const episodesContainerRef = useRef<HTMLDivElement | null>(null);
  const seasonsContainerRef = useRef<HTMLDivElement | null>(null);
  const serversContainerRef = useRef<HTMLDivElement | null>(null);
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null);
  const activeSeasonRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll active episode into view
  useEffect(() => {
    if (activeEpisodeRef.current) {
      activeEpisodeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedEpisode, selectedSeason]);

  // Auto-scroll active season into view
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

  const isDirect = currentStream?.url ? isDirectTvStreamUrl(currentStream.url) : false;
  const title = activeShow?.name || 'TV Series';

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden select-none animate-fadeIn">
      {activeShow && <TVShowSEO tvShow={activeShow as any} />}

      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-cyan-500/20 bg-neutral-950/95 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 mr-3">
          <h1 className="text-white text-sm sm:text-base md:text-lg font-bold truncate">
            {title}
          </h1>

          <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 font-mono shadow-[0_0_12px_rgba(6,182,212,0.3)] border border-cyan-400/30">
            S{selectedSeason} • E{selectedEpisode}
          </span>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <VpnBanner variant="player-bar" />

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

          {/* Close / Back button */}
          <button
            type="button"
            onClick={handleBack}
            title="Back to TV shows"
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
                <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none">
                  <LoadingSpinner size="md" text="Connecting Cinema Stream..." />
                </div>
              )}
              <iframe
                key={`cinema-${currentStream.url}-${selectedSeason}-${selectedEpisode}-${reloadKey}`}
                src={currentStream.url}
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
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
      <footer className="px-4 sm:px-6 pt-3 pb-4 sm:pb-5 border-t border-cyan-500/20 bg-neutral-950/95 backdrop-blur-md flex flex-col gap-2 shrink-0 z-20">
        {/* Stream Servers Row */}
        <div className="flex items-center gap-2 py-0.5 min-w-0">
          <span className="w-14 sm:w-16 text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
            <Tv className="w-3.5 h-3.5 text-cyan-400" />
            <span>Server:</span>
          </span>
          {streams.length > 5 && (
            <button
              type="button"
              onClick={() => scrollServers('left')}
              title="Scroll streams left"
              className="w-5 h-7 rounded bg-neutral-900/90 hover:bg-neutral-800 text-slate-400 hover:text-cyan-300 border border-neutral-800 hover:border-cyan-500/30 flex items-center justify-center shrink-0 transition-colors"
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
          {streams.length > 5 && (
            <button
              type="button"
              onClick={() => scrollServers('right')}
              title="Scroll streams right"
              className="w-5 h-7 rounded bg-neutral-900/90 hover:bg-neutral-800 text-slate-400 hover:text-cyan-300 border border-neutral-800 hover:border-cyan-500/30 flex items-center justify-center shrink-0 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* TV Shows Season & Episode Navigator */}
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5">
          {/* Season row */}
          <div className="flex items-center gap-2 py-0.5 min-w-0">
            <span className="w-14 sm:w-16 text-xs font-bold text-slate-300 shrink-0">
              Season:
            </span>
            {availableSeasons.length > 7 && (
              <button
                type="button"
                onClick={() => scrollSeasons('left')}
                title="Scroll seasons left"
                className="w-5 h-7 rounded bg-neutral-900/90 hover:bg-neutral-800 text-slate-400 hover:text-cyan-300 border border-neutral-800 hover:border-cyan-500/30 flex items-center justify-center shrink-0 transition-colors"
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
                    className={`min-w-8 h-7 px-2.5 rounded-md text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                      isCur
                        ? 'bg-blue-600 border-cyan-400 text-white shadow-md shadow-blue-500/30'
                        : 'bg-neutral-900/90 border-neutral-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-neutral-800/80'
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
                className="w-5 h-7 rounded bg-neutral-900/90 hover:bg-neutral-800 text-slate-400 hover:text-cyan-300 border border-neutral-800 hover:border-cyan-500/30 flex items-center justify-center shrink-0 transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Episode row */}
          <div className="flex items-center gap-2 py-0.5 min-w-0">
            <span className="w-14 sm:w-16 text-xs font-bold text-slate-300 shrink-0">
              Episode:
            </span>
            {episodesCount > 10 && (
              <button
                type="button"
                onClick={() => scrollEpisodes('left')}
                title="Scroll episodes left"
                className="w-5 h-7 rounded bg-neutral-900/90 hover:bg-neutral-800 text-slate-400 hover:text-cyan-300 border border-neutral-800 hover:border-cyan-500/30 flex items-center justify-center shrink-0 transition-colors"
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
                    className={`min-w-8 h-7 px-2 rounded-md text-xs font-bold border transition-all shrink-0 active:scale-95 ${
                      isCur
                        ? 'bg-blue-600 border-cyan-400 text-white shadow-md shadow-blue-500/30'
                        : 'bg-neutral-900/90 border-neutral-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-neutral-800/80'
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
                className="w-5 h-7 rounded bg-neutral-900/90 hover:bg-neutral-800 text-slate-400 hover:text-cyan-300 border border-neutral-800 hover:border-cyan-500/30 flex items-center justify-center shrink-0 transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
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
                mediaId={activeShow?._id}
                title={activeShow?.name}
                mediaType="tv"
                onClose={() => setShowReviews(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TVShowDetailPage;
