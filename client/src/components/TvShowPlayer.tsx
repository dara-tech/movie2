import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Tv, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import api from '../services/api';
import apiConfig from '../config/api';
import streamingService, { resolveTvPrimaryStreamUrl } from '../services/streamingService';
import EmbedPlayer from './EmbedPlayer';
import Hls from 'hls.js';

interface TvShow {
  _id: string;
  name: string;
  overview?: string;
  firstAirDate: string;
  lastAirDate?: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  posterPath?: string;
  backdropPath?: string;
  status?: string;
  type?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
  tmdbId?: number;
  imdbId?: string;
  seasons?: Array<{ seasonNumber: number; episodeCount?: number; name?: string }>;
}

interface Episode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview?: string;
  airDate?: string;
  stillPath?: string;
  vidsrcUrl?: string;
}

interface TvShowPlayerProps {
  tvShow: TvShow;
  season: number;
  episode: number;
  onClose: () => void;
  onWatchComplete?: (tvShow: TvShow, season: number, episode: number) => void;
  streamingUrl?: string | null; // Optional: if provided, use this instead of generating
  onEpisodeChange?: (season: number, episode: number) => void;
}

const TvShowPlayer: React.FC<TvShowPlayerProps> = ({
  tvShow,
  season,
  episode,
  onClose,
  onWatchComplete,
  streamingUrl: providedStreamingUrl,
  onEpisodeChange
}) => {
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [useDirectPlayer, setUseDirectPlayer] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [episodesList, setEpisodesList] = useState<Episode[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  // Available seasons
  const availableSeasons = useMemo(() => {
    if (tvShow.seasons && tvShow.seasons.length > 0) {
      return tvShow.seasons.filter(s => s.seasonNumber > 0).map(s => s.seasonNumber).sort((a, b) => a - b);
    }
    if (tvShow.numberOfSeasons) {
      return Array.from({ length: tvShow.numberOfSeasons }, (_, i) => i + 1);
    }
    return [season];
  }, [tvShow.seasons, tvShow.numberOfSeasons, season]);

  // Fetch episodes when season changes
  useEffect(() => {
    const fetchEpisodes = async () => {
      setIsLoadingEpisodes(true);
      try {
        const response = await api.get(`/api/tvshows/${tvShow._id}/season/${season}/episodes`);
        if (response.data && response.data.episodes) {
          setEpisodesList(response.data.episodes);
        }
      } catch (error) {
        console.error('Failed to fetch episodes', error);
      } finally {
        setIsLoadingEpisodes(false);
      }
    };
    fetchEpisodes();
  }, [tvShow._id, season]);

  const handleSeasonChange = (newSeasonStr: string) => {
    if (onEpisodeChange) {
      onEpisodeChange(Number(newSeasonStr), 1); // Reset to episode 1 on season change
    }
  };

  const handleEpisodeChange = (newEpisodeStr: string) => {
    if (onEpisodeChange) {
      onEpisodeChange(season, Number(newEpisodeStr));
    }
  };

  const handleNextEpisode = () => {
    if (!onEpisodeChange) return;
    const isLastEpisode = episodesList.length > 0 && episode >= Math.max(...episodesList.map(e => e.episodeNumber));
    if (!isLastEpisode) {
      onEpisodeChange(season, episode + 1);
    } else {
      // Try next season
      const currentSeasonIndex = availableSeasons.indexOf(season);
      if (currentSeasonIndex !== -1 && currentSeasonIndex < availableSeasons.length - 1) {
        onEpisodeChange(availableSeasons[currentSeasonIndex + 1], 1);
      }
    }
  };

  const handlePrevEpisode = () => {
    if (!onEpisodeChange) return;
    if (episode > 1) {
      onEpisodeChange(season, episode - 1);
    } else {
      // Try previous season last episode
      const currentSeasonIndex = availableSeasons.indexOf(season);
      if (currentSeasonIndex > 0) {
        onEpisodeChange(availableSeasons[currentSeasonIndex - 1], 1);
      }
    }
  };

  const hasNext = episodesList.length > 0 ? (episode < Math.max(...episodesList.map(e => e.episodeNumber))) || (availableSeasons.indexOf(season) < availableSeasons.length - 1) : true;
  const hasPrev = episode > 1 || availableSeasons.indexOf(season) > 0;

  const isDirectStreamUrl = useCallback((url: string) => {
    const lower = url.toLowerCase();
    return (
      /\.(m3u8|mp4|webm|ogg|mov)(\?|#|$)/i.test(url) ||
      lower.includes('/m3u8') ||
      lower.includes('m3u8-proxy') ||
      lower.includes('/ts-proxy')
    );
  }, []);

  // Track watch history for TV shows (only if user is logged in, don't require auth)
  const trackWatchHistory = useCallback(async (completed: boolean = false) => {
    try {
      const token = localStorage.getItem('token');
      // Only track if user is logged in, but don't require it
      if (!token) return;
      
      const watchData = {
        duration: 3600, // Default 1 hour for TV episodes
        completed,
        lastPosition: 0, // TV shows don't track position the same way
        season,
        episode
      };

      // Use direct fetch to avoid interceptor redirects
      const baseURL = apiConfig.baseURL || 'http://localhost:5000';
      await fetch(`${baseURL}/api/tvshows/${tvShow._id}/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(watchData)
      });
    } catch (error) {
      // Silent fail - watch history is optional
    }
  }, [tvShow._id, season, episode]);

  // Add/remove body class when player is open
  useEffect(() => {
    document.body.classList.add('player-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.classList.remove('player-open');
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.body.style.width = 'auto';
      trackWatchHistory(false);
    };
  }, [onClose, trackWatchHistory]);

  // Default: VidBinge embed (player shield). Explicit URL from parent wins.
  useEffect(() => {
    if (providedStreamingUrl) {
      setStreamingUrl(providedStreamingUrl);
      return;
    }
    const vidbinge = streamingService.generateVidBingeEpisodeUrl({
      tmdbId: tvShow.tmdbId,
      imdbId: tvShow.imdbId,
      season,
      episode,
    });
    setStreamingUrl(
      vidbinge || resolveTvPrimaryStreamUrl(tvShow.streamingUrl, tvShow.vidsrcUrl)
    );
  }, [tvShow.tmdbId, tvShow.imdbId, tvShow.streamingUrl, tvShow.vidsrcUrl, season, episode, providedStreamingUrl]);

  useEffect(() => {
    if (!streamingUrl) {
      setUseDirectPlayer(false);
      return;
    }
    setUseDirectPlayer(isDirectStreamUrl(streamingUrl));
  }, [isDirectStreamUrl, streamingUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamingUrl || !useDirectPlayer) return;

    setVideoError(null);
    try {
      const streamOrigin = new URL(streamingUrl, window.location.href).origin;
      if (streamOrigin === window.location.origin) {
        video.crossOrigin = 'anonymous';
      } else {
        video.removeAttribute('crossOrigin');
      }
    } catch {
      video.removeAttribute('crossOrigin');
    }
    video.playsInline = true;

    const isHlsStream = /\.m3u8(\?|#|$)/i.test(streamingUrl) || streamingUrl.toLowerCase().includes('m3u8');
    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamingUrl);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        hls.destroy();
        // Fall back to embed so playback still has a second chance.
        setUseDirectPlayer(false);
        setVideoError('Direct stream failed. Switched to fallback player.');
      });

      return () => {
        hls.destroy();
      };
    }

    if (isHlsStream && !canPlayNativeHls) {
      setUseDirectPlayer(false);
      setVideoError('This browser cannot play HLS directly. Switched to fallback player.');
      return;
    }

    video.src = streamingUrl;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [streamingUrl, useDirectPlayer]);

  // Mock episode data - in a real app, you'd fetch this from your API
  useEffect(() => {
    setCurrentEpisode({
      seasonNumber: season,
      episodeNumber: episode,
      name: `Episode ${episode}`,
      overview: `Season ${season}, Episode ${episode} of ${tvShow.name}`,
      airDate: tvShow.firstAirDate,
      vidsrcUrl: streamingUrl || undefined
    });
  }, [season, episode, tvShow, streamingUrl]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="w-full h-full relative ad-block-wrapper">
        {/* Video Element or Streaming Iframe (Vidsrc.to / alternatives) - wrapper clips bottom to hide embed debug bars */}
        {streamingUrl ? (
          <div className="w-full h-full overflow-hidden relative flex flex-col">
            {useDirectPlayer ? (
              <video
                ref={videoRef}
                key={`direct-${season}-${episode}`}
                className="h-full w-full bg-black"
                controls
                autoPlay
                playsInline
                onError={() => {
                  setUseDirectPlayer(false);
                  setVideoError('Direct stream failed. Switched to fallback player.');
                }}
              />
            ) : (
              <EmbedPlayer
                key={`embed-${season}-${episode}`}
                embedUrl={streamingUrl}
                title={`${tvShow.name} - S${season}E${episode}`}
                onClose={onClose}
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">📺</div>
              <h3 className="text-xl font-semibold mb-2">Loading Episode...</h3>
              <p className="text-gray-400">Please wait while we prepare your content</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {videoError && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-white p-6">
              <div className="text-red-400 text-xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Episode Error</h3>
              <p className="text-gray-300 mb-4">{videoError}</p>
              <Button
                onClick={() => {
                  setVideoError(null);
                  // Retry loading
                  window.location.reload();
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Back — return to show / episode list */}
        <div className="absolute top-3 left-3 z-30">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm gap-1 h-8 px-2"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Back</span>
          </Button>
        </div>

        {/* Episode Selector Overlay */}
        {onEpisodeChange && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-md rounded-xl p-3 border border-gray-800 shadow-2xl flex items-center gap-3 w-[95%] max-w-[600px] sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevEpisode}
              disabled={!hasPrev}
              className="text-white hover:bg-white/20 hover:text-white shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <Select value={season.toString()} onValueChange={handleSeasonChange}>
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-9 min-w-[110px]">
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white max-h-[300px]">
                  {availableSeasons.map(s => (
                    <SelectItem key={s} value={s.toString()}>Season {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={episode.toString()} onValueChange={handleEpisodeChange}>
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-9 min-w-[120px]">
                  <SelectValue placeholder="Episode" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white max-h-[300px]">
                  {episodesList.length > 0 ? (
                    episodesList.map(ep => (
                      <SelectItem key={ep.episodeNumber} value={ep.episodeNumber.toString()}>
                        Ep {ep.episodeNumber}
                      </SelectItem>
                    ))
                  ) : (
                    // Fallback if episodes not loaded
                    <SelectItem value={episode.toString()}>Ep {episode}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextEpisode}
              disabled={!hasNext}
              className="text-white hover:bg-white/20 hover:text-white shrink-0"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {currentEpisode && (
          <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm rounded-lg p-2.5 max-w-[220px] sm:max-w-xs hidden sm:block">
            <div className="flex items-center space-x-2 mb-2">
              <Tv className="w-4 h-4 text-blue-400" />
              <span className="text-white font-semibold">Episode Info</span>
            </div>
            <h4 className="text-white font-medium mb-1">{currentEpisode.name}</h4>
            <p className="text-gray-300 text-sm mb-2">{currentEpisode.overview}</p>
            {currentEpisode.airDate && (
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                <span>Aired {formatDate(currentEpisode.airDate)}</span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};


export default TvShowPlayer;

