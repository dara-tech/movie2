import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
// import { Card, CardContent } from './ui/card';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw, Gauge } from 'lucide-react';
import { Input } from './ui/input';
import api from '../services/api';
import {
  getDefaultMoviePlayUrl,
  isDirectTvStreamUrl,
  resolveMoviePrimaryStreamUrl,
} from '../services/streamingService';
import EmbedPlayer from './EmbedPlayer';
interface Movie {
  _id: string;
  title: string;
  overview?: string;
  releaseDate: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  runtime?: number;
  streamingUrl?: string;
  vidsrcUrl?: string;
  tmdbId?: number;
  imdbId?: string;
  posterPath?: string;
}

interface MoviePlayerProps {
  movie: Movie;
  onClose: () => void;
  onWatchComplete?: (movie: Movie) => void;
  resumePosition?: number;
  streamingUrl?: string | null; // Optional: if provided, use this instead of generating
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({
  movie,
  onClose,
  onWatchComplete,
  resumePosition,
  streamingUrl: providedStreamingUrl
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  // const [isFullscreen, setIsFullscreen] = useState(false);

  // Track watch history
  const trackWatchHistory = useCallback(async (completed: boolean = false) => {
    try {
      const video = videoRef.current;
      if (!video) return;

      const watchData = {
        duration: Math.floor(video.duration || 0),
        completed,
        lastPosition: Math.floor(video.currentTime || 0)
      };

      await api.post(`/api/movies/${movie._id}/watch`, watchData);
    } catch (error) {
    }
  }, [movie._id]);

  /** Selected provider URL from parent, or resolved direct default / DB fields (embeds ignored for default). */
  const effectiveStreamUrl = useMemo(() => {
    if (providedStreamingUrl) return providedStreamingUrl;
    return (
      getDefaultMoviePlayUrl(movie) ||
      resolveMoviePrimaryStreamUrl(movie.streamingUrl, movie.vidsrcUrl)
    );
  }, [providedStreamingUrl, movie]);

  const useDirectPlayer = isDirectTvStreamUrl(effectiveStreamUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !useDirectPlayer) return;
    try {
      const streamOrigin = new URL(effectiveStreamUrl, window.location.href).origin;
      if (streamOrigin === window.location.origin) {
        video.crossOrigin = 'anonymous';
      } else {
        video.removeAttribute('crossOrigin');
      }
    } catch {
      video.removeAttribute('crossOrigin');
    }
  }, [useDirectPlayer, effectiveStreamUrl]);

  // Add/remove body class when player is open
  useEffect(() => {
    document.body.classList.add('player-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.classList.remove('player-open');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSpeedMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.playback-speed-menu')) {
          setShowSpeedMenu(false);
        }
      }
    };

    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSpeedMenu]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set initial playback rate
    video.playbackRate = playbackRate;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => {
      setDuration(video.duration);
      // Resume from last position if available
      if (resumePosition && resumePosition > 0 && video.duration > resumePosition) {
        video.currentTime = resumePosition;
        setCurrentTime(resumePosition);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      trackWatchHistory(true); // Mark as completed
      onWatchComplete?.(movie);
    };
    const handleError = (e: Event) => {
      setVideoError('Failed to load video. Please try again.');
    };
    const handleLoadStart = () => {
      setVideoError(null);
    };
    const handleCanPlay = () => {
      setVideoError(null);
      // Resume playback if there's a resume position
      if (resumePosition && resumePosition > 0 && video.duration > resumePosition) {
        video.currentTime = resumePosition;
        setCurrentTime(resumePosition);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [movie, onWatchComplete, trackWatchHistory, resumePosition, playbackRate, useDirectPlayer, effectiveStreamUrl]);

  // Track progress every 30 seconds during playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      trackWatchHistory(false); // Track progress, not completed
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isPlaying, trackWatchHistory]);

  // Track when player is closed
  useEffect(() => {
    return () => {
      // Track final position when component unmounts
      trackWatchHistory(false);
    };
  }, [trackWatchHistory]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // Video state tracking

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch (error) {
        setVideoError('Failed to play video. Please check your browser settings.');
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    type FullscreenElementWithVendor = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    type FullscreenDocumentWithVendor = Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    const doc = document as FullscreenDocumentWithVendor;
    const targetElement = (videoRef.current || playerContainerRef.current) as FullscreenElementWithVendor | null;
    if (!targetElement) return;

    const activeFullscreenEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
    if (!activeFullscreenEl) {
      if (targetElement.requestFullscreen) {
        targetElement.requestFullscreen().catch(() => {});
      } else if (targetElement.webkitRequestFullscreen) {
        try { targetElement.webkitRequestFullscreen(); } catch {}
      } else if (targetElement.msRequestFullscreen) {
        try { targetElement.msRequestFullscreen(); } catch {}
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        try { doc.webkitExitFullscreen(); } catch {}
      } else if (doc.msExitFullscreen) {
        try { doc.msExitFullscreen(); } catch {}
      }
    }
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const skipBySeconds = (delta: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(
      video.duration,
      Math.max(0, video.currentTime + delta)
    );
    setCurrentTime(video.currentTime);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div ref={playerContainerRef} className="w-full h-full relative ad-block-wrapper">
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

        {/* Native video for direct MP4/HLS; iframe for embed providers (SuperEmbed, Vidsrc, …) */}
        {useDirectPlayer ? (
          <video
            ref={videoRef}
            key={`direct-${effectiveStreamUrl}`}
            className="w-full h-full object-contain bg-black"
            src={effectiveStreamUrl}
            poster={
              movie.posterPath
                ? `https://image.tmdb.org/t/p/w1280${movie.posterPath}`
                : undefined
            }
            onClick={togglePlay}
            onMouseMove={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            controls={false}
            playsInline
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full h-full overflow-hidden relative flex flex-col">
            <EmbedPlayer
              key={`embed-${effectiveStreamUrl}`}
              embedUrl={effectiveStreamUrl}
              title={movie.title}
              onClose={onClose}
            />
          </div>
        )}

        {/* Error Display */}
        {videoError && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-white p-6">
              <div className="text-red-400 text-xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Video Error</h3>
              <p className="text-gray-300 mb-4">{videoError}</p>
              <Button
                onClick={() => {
                  setVideoError(null);
                  const video = videoRef.current;
                  if (video) {
                    video.load();
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Controls overlay only for native direct video, not embed iframes */}
        {showControls && useDirectPlayer && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-3">
            <div className="flex justify-between items-center pl-10 sm:pl-12">
              <h2 className="text-white text-sm sm:text-base font-semibold truncate pr-4">{movie.title}</h2>
            </div>

            <div className="space-y-2">
              {/* Progress Bar */}
              <div className="space-y-2">
                <Input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-white text-sm">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => skipBySeconds(-10)}
                    className="text-white hover:bg-white/20"
                    title="Back 10 seconds"
                    aria-label="Back 10 seconds"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span className="ml-0.5 text-xs font-semibold tabular-nums">10</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlay}
                    className="text-white hover:bg-white/20"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => skipBySeconds(10)}
                    className="text-white hover:bg-white/20"
                    title="Forward 10 seconds"
                    aria-label="Forward 10 seconds"
                  >
                    <RotateCw className="h-5 w-5" />
                    <span className="ml-0.5 text-xs font-semibold tabular-nums">10</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>

                  {/* Playback Speed Control */}
                  <div className="relative playback-speed-menu">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="text-white hover:bg-white/20"
                      title={`Playback Speed: ${playbackRate}x`}
                    >
                      <Gauge className="h-5 w-5" />
                      <span className="ml-1 text-xs">{playbackRate}x</span>
                    </Button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-black/90 rounded-lg p-2 min-w-[100px] z-50">
                        {playbackRates.map((rate) => (
                          <button
                            key={rate}
                            onClick={() => changePlaybackRate(rate)}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-white/20 transition-colors ${
                              playbackRate === rate ? 'bg-red-600 text-white' : 'text-white'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-white/20"
                >
                  <Maximize className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoviePlayer;
