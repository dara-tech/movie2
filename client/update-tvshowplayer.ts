import * as fs from 'fs';

let content = fs.readFileSync('src/components/TvShowPlayer.tsx', 'utf8');

// 1. Add Select and icons to imports
content = content.replace(
  "import { ArrowLeft, Tv, Calendar } from 'lucide-react';",
  "import { ArrowLeft, Tv, Calendar, ChevronLeft, ChevronRight, List } from 'lucide-react';\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';\nimport api from '../services/api';"
);

// 2. Add seasons to TvShow interface
content = content.replace(
  "  imdbId?: string;\n}",
  "  imdbId?: string;\n  seasons?: Array<{ seasonNumber: number; episodeCount?: number; name?: string }>;\n}"
);

// 3. Add onEpisodeChange to Props
content = content.replace(
  "  streamingUrl?: string | null; // Optional: if provided, use this instead of generating\n}",
  "  streamingUrl?: string | null; // Optional: if provided, use this instead of generating\n  onEpisodeChange?: (season: number, episode: number) => void;\n}"
);

// 4. Update component signature
content = content.replace(
  "  streamingUrl: providedStreamingUrl\n}) => {",
  "  streamingUrl: providedStreamingUrl,\n  onEpisodeChange\n}) => {"
);

// 5. Add state for available episodes
const stateStr = `
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
        const response = await api.get(\`/api/tvshows/\${tvShow._id}/season/\${season}/episodes\`);
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
      // We don't know the exact number of episodes in the previous season easily without fetching
      // So we just go to previous season episode 1 for now if they click prev on episode 1
      const currentSeasonIndex = availableSeasons.indexOf(season);
      if (currentSeasonIndex > 0) {
        onEpisodeChange(availableSeasons[currentSeasonIndex - 1], 1);
      }
    }
  };

  const hasNext = episodesList.length > 0 ? (episode < Math.max(...episodesList.map(e => e.episodeNumber))) || (availableSeasons.indexOf(season) < availableSeasons.length - 1) : true;
  const hasPrev = episode > 1 || availableSeasons.indexOf(season) > 0;
`;

content = content.replace(
  "  const [videoError, setVideoError] = useState<string | null>(null);\n  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);\n  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);\n  const [useDirectPlayer, setUseDirectPlayer] = useState(false);\n  const videoRef = useRef<HTMLVideoElement>(null);",
  stateStr.trim()
);

content = content.replace("import React, { useState, useEffect, useCallback, useRef } from 'react';", "import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';");

const uiStr = `
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
`;

content = content.replace("{currentEpisode && (", uiStr.trim());

fs.writeFileSync('src/components/TvShowPlayer.tsx', content);
