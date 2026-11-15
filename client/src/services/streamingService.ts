/**
 * Streaming Service
 * Default player: SuperEmbed (https://www.superembed.stream) via direct multiembed.mov
 * Handles multiple streaming URL generation (SuperEmbed, Vidsrc.to, VidBinge, GodrivePlayer, etc.)
 */

import vidsrcService from './vidsrcService';
import { apiConfig } from '../config/api';
import api from './api';

/** Default direct MP4 when no episode or show stream URL is configured */
export const DEFAULT_TV_DIRECT_STREAM_URL =
  'https://hugh.cdn.rumble.cloud/video/fww1/e6/s8/2/-/N/M/3/-NM3z.aaa.mp4';

/** True for playable direct files / HLS, false for embed pages (vidsrc, vidplus, multiembed, etc.) */
export function isDirectTvStreamUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    /\.(m3u8|mp4|webm|ogg|mov)(\?|#|$)/i.test(url) ||
    lower.includes('/m3u8') ||
    lower.includes('m3u8-proxy') ||
    lower.includes('/ts-proxy')
  );
}

/** Prefer the first direct media URL; ignore vidsrc/embed URLs so they do not override the default MP4 */
export function resolveTvPrimaryStreamUrl(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (isDirectTvStreamUrl(c)) return c as string;
  }
  return DEFAULT_TV_DIRECT_STREAM_URL;
}

/** Same rules as {@link resolveTvPrimaryStreamUrl} for movie `streamingUrl` / `vidsrcUrl` fields */
export const resolveMoviePrimaryStreamUrl = resolveTvPrimaryStreamUrl;

// Configurable default active server and disabled servers
let currentDefaultServerId: string = typeof window !== 'undefined'
  ? localStorage.getItem('streaming_default_server') || 'vidsrcme.ru'
  : 'vidsrcme.ru';

let currentDisabledServerIds: Set<string> = new Set(
  typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('streaming_disabled_servers') || '[]')
    : []
);

export function getDefaultServerId(): string {
  return currentDefaultServerId;
}

export function setDefaultServerId(id: string): void {
  currentDefaultServerId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem('streaming_default_server', id);
  }
}

export function getDisabledServerIds(): Set<string> {
  return currentDisabledServerIds;
}

export function setDisabledServerIds(ids: string[]): void {
  currentDisabledServerIds = new Set(ids);
  if (typeof window !== 'undefined') {
    localStorage.setItem('streaming_disabled_servers', JSON.stringify(ids));
  }
}

/** Check if an option matches a server ID */
export function matchesServerId(option: StreamingOption, serverId: string): boolean {
  if (!option || !serverId) return false;
  const id = (option.id || '').toLowerCase();
  const name = (option.name || '').toLowerCase();
  const url = (option.url || '').toLowerCase();
  const target = serverId.toLowerCase();

  if (target === 'zxcstream') return option.type === 'zxcstream' || id.includes('zxcstream') || name.includes('zxcstream') || url.includes('zxcstream');
  if (target === 'moviepire') return option.type === 'moviepire' || id.includes('moviepire') || name.includes('moviepire') || url.includes('moviepire');
  if (target === 'vidlink') return option.type === 'vidlink' || id.includes('vidlink') || name.includes('vidlink');
  if (target === 'autoembed') return option.type === 'autoembed' || id.includes('autoembed') || name.includes('autoembed');
  if (target === 'multiembed') return option.type === 'multiembed' || id.includes('superembed') || name.includes('superembed');
  if (target === 'vidsrc-to') return option.type === 'vidsrc-to' || id.includes('vidsrc-to') || name.includes('vidsrc.to');
  if (target === 'vidplus') return option.type === 'vidplus' || id.includes('vidplus') || name.includes('vidplus');
  if (target === 'vidsrc') return option.type === 'vidsrc' || id === 'vidsrc-imdb' || id === 'vidsrc-tmdb' || name.includes('vidsrc (');
  if (target === 'vidbinge') return option.type === 'vidbinge' || id.includes('vidbinge') || name.includes('vidbinge');
  if (target === 'godrive') return option.type === 'godrive' || id.includes('godrive') || name.includes('godrive');

  return name.includes(target) || url.includes(target) || id.includes(target);
}

/** True if the option should be excluded because it was disabled/unactive in admin */
export function isStreamOptionDisabled(option: StreamingOption): boolean {
  for (const disabledId of Array.from(currentDisabledServerIds)) {
    if (matchesServerId(option, disabledId)) return true;
  }
  return false;
}

/** Filter out inactive/disabled servers from list */
export function filterActiveStreamingOptions(options: StreamingOption[]): StreamingOption[] {
  return options.filter((o) => !isStreamOptionDisabled(o));
}

/** Fetch public streaming config from backend */
let isConfigLoaded = false;
export async function loadStreamingConfig(): Promise<void> {
  if (isConfigLoaded) return;
  try {
    const res = await api.get('/api/streaming/config');
    const data = res.data?.data;
    if (data) {
      if (data.defaultServerId) {
        setDefaultServerId(data.defaultServerId);
      }
      if (Array.isArray(data.disabledServerIds)) {
        setDisabledServerIds(data.disabledServerIds);
      }
      isConfigLoaded = true;
    }
  } catch {
    // Keep local cache or defaults
  }
}

// Auto-trigger load on startup in browser
if (typeof window !== 'undefined') {
  loadStreamingConfig();
}

/** Helper to identify vidsrc-embed.ru stream option */
export function isVidsrcEmbedRuOption(option?: StreamingOption | null): boolean {
  if (!option) return false;
  const name = option.name?.toLowerCase() || '';
  const url = option.url?.toLowerCase() || '';
  return name.includes('vidsrc-embed.ru') || url.includes('vidsrc-embed.ru');
}

/** UI order: default server first, then ZXCStream, MoviePire, vidsrc-embed.ru, VidLink, AutoEmbed, etc. */
const STREAM_DISPLAY_PRIORITY: Record<string, number> = {
  zxcstream: 0,
  moviepire: 1,
  'vidsrc-new': 2,
  vidlink: 3,
  autoembed: 4,
  multiembed: 5,
  'vidsrc-to': 6,
  vidplus: 7,
  vidsrc: 8,
  direct: 9,
  vidbinge: 10,
  godrive: 11,
};

export function sortStreamingOptionsForDisplay(options: StreamingOption[]): StreamingOption[] {
  // First, filter out disabled options
  const activeOnly = filterActiveStreamingOptions(options);

  return [...activeOnly].sort((a, b) => {
    // Configured default server always goes to the very top
    const aIsDefault = matchesServerId(a, currentDefaultServerId);
    const bIsDefault = matchesServerId(b, currentDefaultServerId);
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;

    // Fallback: vidsrc-embed.ru if default not found
    const aIsVidsrcRu = isVidsrcEmbedRuOption(a);
    const bIsVidsrcRu = isVidsrcEmbedRuOption(b);
    if (aIsVidsrcRu && !bIsVidsrcRu) return -1;
    if (!aIsVidsrcRu && bIsVidsrcRu) return 1;

    return (STREAM_DISPLAY_PRIORITY[a.type] ?? 99) - (STREAM_DISPLAY_PRIORITY[b.type] ?? 99);
  });
}

/** Default provider: configured default server first, then fallback to others */
export function pickDefaultStreamOption(options: StreamingOption[]): StreamingOption | null {
  const sorted = sortStreamingOptionsForDisplay(options);
  if (!sorted.length) return null;

  const defaultOption = sorted.find((o) => matchesServerId(o, currentDefaultServerId));
  if (defaultOption) return defaultOption;

  return sorted[0] ?? null;
}

export function isRecommendedStreamOption(option: StreamingOption): boolean {
  return (
    matchesServerId(option, currentDefaultServerId) ||
    option.type === 'zxcstream' ||
    option.type === 'moviepire' ||
    isVidsrcEmbedRuOption(option) ||
    option.type === 'vidlink' ||
    option.type === 'autoembed' ||
    option.type === 'multiembed' ||
    option.type === 'vidsrc-to' ||
    option.type === 'vidsrc-new'
  );
}

export interface StreamingOption {
  id: string;
  name: string;
  url: string;
  type: 'direct' | 'vidbinge' | 'vidsrc' | 'vidplus' | 'vidsrc-to' | 'godrive' | 'multiembed' | 'vidsrc-new' | 'vidlink' | 'autoembed' | 'zxcstream' | 'moviepire';
}

class StreamingService {
  private vidbingeURL: string;
  private godriveURL: string;
  private multiEmbedURL: string;
  private vidsrcToURL: string;
  private newVidsrcDomains: string[];
  /** Backend SuperEmbed player (replaces se_player.php - no PHP required) */
  private get superembedPlayerBase(): string {
    return `${apiConfig.baseURL}/api/superembed-player`;
  }

  constructor() {
    this.vidbingeURL = 'https://www.vidbinge.to';
    this.godriveURL = 'https://godriveplayer.com/player.php';
    this.multiEmbedURL = 'https://multiembed.mov';
    this.vidsrcToURL = 'https://vidsrc.to';
    this.newVidsrcDomains = [
      'https://vidsrc-embed.ru',
      'https://vidsrcme.ru',
      'https://vidsrcme.su',
      'https://vidsrc-me.ru',
      'https://vidsrc-embed.su',
      'https://vsrc.su'
    ];
  }

  /**
   * Generate ZXCStream URL for movies (https://zxcstream.xyz/player/movie/{tmdbId}?autoplay=1)
   */
  generateZxcStreamMovieUrl({ tmdbId, imdbId }: { tmdbId?: number | string; imdbId?: string }): string | null {
    const rawId = tmdbId ?? (imdbId && /^\d+$/.test(imdbId) ? imdbId : null);
    if (!rawId) return null;
    const cleanId = String(rawId).replace(/^tmdb_/, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) return null;
    return `https://zxcstream.xyz/player/movie/${cleanId}?autoplay=1`;
  }

  /**
   * Generate ZXCStream URL for TV episodes (https://zxcstream.xyz/player/tv/{tmdbId}/{season}/{episode}?autoplay=1)
   */
  generateZxcStreamEpisodeUrl({ tmdbId, imdbId, season, episode }: { tmdbId?: number | string; imdbId?: string; season: number; episode: number }): string | null {
    const rawId = tmdbId ?? (imdbId && /^\d+$/.test(imdbId) ? imdbId : null);
    if (!rawId || season == null || episode == null) return null;
    const cleanId = String(rawId).replace(/^tmdb_/, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) return null;
    return `https://zxcstream.xyz/player/tv/${cleanId}/${season}/${episode}?autoplay=1`;
  }

  /**
   * Generate MoviePire URL for movies (https://video.moviepire.co/embed/movie/{tmdbId}?autoplay=1)
   */
  generateMoviePireMovieUrl({ tmdbId, imdbId }: { tmdbId?: number | string; imdbId?: string }): string | null {
    const rawId = tmdbId ?? (imdbId && /^\d+$/.test(imdbId) ? imdbId : null);
    if (!rawId) return null;
    const cleanId = String(rawId).replace(/^tmdb_/, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) return null;
    return `https://video.moviepire.co/embed/movie/${cleanId}?autoplay=1`;
  }

  /**
   * Generate MoviePire URL for TV episodes (https://video.moviepire.co/embed/tv/{tmdbId}/{season}/{episode}?autoplay=1)
   */
  generateMoviePireEpisodeUrl({ tmdbId, imdbId, season, episode }: { tmdbId?: number | string; imdbId?: string; season: number; episode: number }): string | null {
    const rawId = tmdbId ?? (imdbId && /^\d+$/.test(imdbId) ? imdbId : null);
    if (!rawId || season == null || episode == null) return null;
    const cleanId = String(rawId).replace(/^tmdb_/, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) return null;
    return `https://video.moviepire.co/embed/tv/${cleanId}/${season}/${episode}?autoplay=1`;
  }

  /**
   * Generate VidLink URL for movies (clean UI, minimal ads)
   */
  generateVidLinkMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number | string }): string | null {
    if (tmdbId) {
      return `https://vidlink.pro/movie/${tmdbId}?primaryColor=dc2626&secondaryColor=1f2937&iconColor=ef4444`;
    }
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `https://vidlink.pro/movie/${cleanImdbId}?primaryColor=dc2626&secondaryColor=1f2937&iconColor=ef4444`;
    }
    return null;
  }

  /**
   * Generate VidLink URL for TV episodes (clean UI, minimal ads)
   */
  generateVidLinkEpisodeUrl({ imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number | string; season: number; episode: number }): string | null {
    const id = tmdbId ?? (imdbId?.startsWith('tt') ? imdbId : imdbId ? `tt${imdbId}` : null);
    if (id != null && season != null && episode != null) {
      return `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=dc2626&secondaryColor=1f2937&iconColor=ef4444`;
    }
    return null;
  }

  /**
   * Generate AutoEmbed URL for movies (reliable, fewer redirects)
   */
  generateAutoEmbedMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number | string }): string | null {
    const id = tmdbId ?? (imdbId?.startsWith('tt') ? imdbId : imdbId ? `tt${imdbId}` : null);
    if (id) {
      return `https://player.autoembed.cc/embed/movie/${id}`;
    }
    return null;
  }

  /**
   * Generate AutoEmbed URL for TV episodes (reliable, fewer redirects)
   */
  generateAutoEmbedEpisodeUrl({ imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number | string; season: number; episode: number }): string | null {
    const id = tmdbId ?? (imdbId?.startsWith('tt') ? imdbId : imdbId ? `tt${imdbId}` : null);
    if (id != null && season != null && episode != null) {
      return `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`;
    }
    return null;
  }

  /**
   * SuperEmbed player URL via our backend (redirects to getsuperembed.link player - same as se_player.php)
   */
  getSuperEmbedPlayerMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number | string }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.superembedPlayerBase}?video_id=${encodeURIComponent(cleanImdbId)}`;
    }
    if (tmdbId) {
      return `${this.superembedPlayerBase}?video_id=${encodeURIComponent(String(tmdbId))}&tmdb=1`;
    }
    return null;
  }

  getSuperEmbedPlayerEpisodeUrl({ imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number | string; season: number; episode: number }): string | null {
    const base = imdbId
      ? `${this.superembedPlayerBase}?video_id=${encodeURIComponent(imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`)}`
      : tmdbId
        ? `${this.superembedPlayerBase}?video_id=${encodeURIComponent(String(tmdbId))}&tmdb=1`
        : null;
    if (!base) return null;
    return `${base}&s=${season}&e=${episode}`;
  }

  /**
   * Generate VidBinge URL for movies (default embed source)
   * https://www.vidbinge.to/movie/$id - $id = TMDB or IMDb ID
   */
  generateVidBingeMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number | string }): string | null {
    if (tmdbId) {
      return `${this.vidbingeURL}/movie/${tmdbId}`;
    }
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.vidbingeURL}/movie/${cleanImdbId}`;
    }
    return null;
  }

  /**
   * Generate VidBinge URL for TV episodes (default embed source)
   * https://www.vidbinge.to/tv/$id/$s/$e - id, season, episode
   */
  generateVidBingeEpisodeUrl({ imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number | string; season: number; episode: number }): string | null {
    const id = tmdbId ?? (imdbId?.startsWith('tt') ? imdbId : imdbId ? `tt${imdbId}` : null);
    if (id != null && season != null && episode != null) {
      return `${this.vidbingeURL}/tv/${id}/${season}/${episode}`;
    }
    return null;
  }

  /**
   * Generate GodrivePlayer URL for movies
   */
  generateGodriveMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number }): string | null {
    if (imdbId) {
      return `${this.godriveURL}?imdb=${imdbId}`;
    } else if (tmdbId) {
      return `${this.godriveURL}?tmdb=${tmdbId}`;
    }
    return null;
  }

  /**
   * Generate MultiEmbed URL for movies
   */
  generateMultiEmbedMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number }): string | null {
    if (imdbId) {
      // Ensure IMDB ID has tt prefix
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.multiEmbedURL}/?video_id=${cleanImdbId}`;
    } else if (tmdbId) {
      return `${this.multiEmbedURL}/?video_id=${tmdbId}&tmdb=1`;
    }
    return null;
  }

  /**
   * Generate MultiEmbed URL for TV episodes
   */
  generateMultiEmbedEpisodeUrl({ imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number; season: number; episode: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.multiEmbedURL}/?video_id=${cleanImdbId}&s=${season}&e=${episode}`;
    } else if (tmdbId) {
      return `${this.multiEmbedURL}/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
    }
    return null;
  }

  /**
   * Generate Vidsrc.to URL for movies
   */
  generateVidsrcToMovieUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.vidsrcToURL}/embed/movie/${cleanImdbId}`;
    } else if (tmdbId) {
      return `${this.vidsrcToURL}/embed/movie/${tmdbId}`;
    }
    return null;
  }

  /**
   * Generate Vidsrc.to URL for TV shows
   */
  generateVidsrcToTvUrl({ imdbId, tmdbId }: { imdbId?: string; tmdbId?: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.vidsrcToURL}/embed/tv/${cleanImdbId}`;
    } else if (tmdbId) {
      return `${this.vidsrcToURL}/embed/tv/${tmdbId}`;
    }
    return null;
  }

  /**
   * Generate Vidsrc.to URL for TV seasons
   */
  generateVidsrcToSeasonUrl({ imdbId, tmdbId, season }: { imdbId?: string; tmdbId?: number; season: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.vidsrcToURL}/embed/tv/${cleanImdbId}/${season}`;
    } else if (tmdbId) {
      return `${this.vidsrcToURL}/embed/tv/${tmdbId}/${season}`;
    }
    return null;
  }

  /**
   * Generate Vidsrc.to URL for TV episodes
   */
  generateVidsrcToEpisodeUrl({ imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number; season: number; episode: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${this.vidsrcToURL}/embed/tv/${cleanImdbId}/${season}/${episode}`;
    } else if (tmdbId) {
      return `${this.vidsrcToURL}/embed/tv/${tmdbId}/${season}/${episode}`;
    }
    return null;
  }

  /**
   * Generate URL for the new vidsrc domains
   */
  generateNewVidsrcMovieUrl(domain: string, { imdbId, tmdbId }: { imdbId?: string; tmdbId?: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${domain}/embed/movie/${cleanImdbId}`;
    } else if (tmdbId) {
      return `${domain}/embed/movie/${tmdbId}`;
    }
    return null;
  }

  generateNewVidsrcEpisodeUrl(domain: string, { imdbId, tmdbId, season, episode }: { imdbId?: string; tmdbId?: number; season: number; episode: number }): string | null {
    if (imdbId) {
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
      return `${domain}/embed/tv/${cleanImdbId}/${season}/${episode}`;
    } else if (tmdbId) {
      return `${domain}/embed/tv/${tmdbId}/${season}/${episode}`;
    }
    return null;
  }

  /**
   * Generate all streaming options for a movie
   * Default (first) option: Main Stream (direct MP4 when no first-party file URL)
   */
  async generateMovieStreamingOptions(movie: any): Promise<StreamingOption[]> {
    const options: StreamingOption[] = [];

    const directUrl = resolveTvPrimaryStreamUrl(
      movie?.streamingUrl,
      movie?.streaming_url,
      movie?.vidsrcUrl,
      movie?.vidsrc_url
    );
    options.push({
      id: 'direct-movie',
      name: 'Main Stream',
      url: directUrl,
      type: 'direct'
    });

    // ZXCStream (https://zxcstream.xyz/player/movie/{tmdbId}?autoplay=1)
    const movieTmdbId = movie?.tmdbId || (movie?._id && String(movie._id).startsWith('tmdb_') ? String(movie._id).replace('tmdb_', '') : movie?._id && /^\d+$/.test(String(movie._id)) ? movie._id : null);
    const zxcStreamUrl = this.generateZxcStreamMovieUrl({
      tmdbId: movieTmdbId,
      imdbId: movie?.imdbId,
    });
    if (zxcStreamUrl) {
      options.push({
        id: 'zxcstream-movie',
        name: 'ZXCStream',
        url: zxcStreamUrl,
        type: 'zxcstream'
      });
    }

    // MoviePire (https://video.moviepire.co/embed/movie/{tmdbId}?autoplay=1)
    const moviePireUrl = this.generateMoviePireMovieUrl({
      tmdbId: movieTmdbId,
      imdbId: movie?.imdbId,
    });
    if (moviePireUrl) {
      options.push({
        id: 'moviepire-movie',
        name: 'MoviePire',
        url: moviePireUrl,
        type: 'moviepire'
      });
    }

    // VidLink (clean, fast, minimal ads)
    const vidLinkUrl = this.generateVidLinkMovieUrl({
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId,
    });
    if (vidLinkUrl) {
      options.push({
        id: 'vidlink-movie',
        name: 'VidLink (Clean)',
        url: vidLinkUrl,
        type: 'vidlink'
      });
    }

    // AutoEmbed (stable, fewer redirects)
    const autoEmbedUrl = this.generateAutoEmbedMovieUrl({
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId,
    });
    if (autoEmbedUrl) {
      options.push({
        id: 'autoembed-movie',
        name: 'AutoEmbed',
        url: autoEmbedUrl,
        type: 'autoembed'
      });
    }

    // New Vidsrc domains
    this.newVidsrcDomains.forEach((domain, index) => {
      const url = this.generateNewVidsrcMovieUrl(domain, { imdbId: movie.imdbId, tmdbId: movie.tmdbId });
      if (url) {
        options.push({
          id: `vidsrc-new-${index}`,
          name: new URL(domain).hostname,
          url,
          type: 'vidsrc-new'
        });
      }
    });

    // SuperEmbed (multiembed.mov) - default player
    if (movie.imdbId) {
      const superEmbedUrl = this.generateMultiEmbedMovieUrl({ imdbId: movie.imdbId });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-imdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }
    if (movie.tmdbId && !options.some(o => o.type === 'multiembed')) {
      const superEmbedUrl = this.generateMultiEmbedMovieUrl({ tmdbId: movie.tmdbId });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-tmdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }

    // Vidsrc.to (alternative)
    if (movie.tmdbId) {
      const vidsrcToUrl = this.generateVidsrcToMovieUrl({ tmdbId: movie.tmdbId });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-tmdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }
    if (movie.imdbId) {
      const vidsrcToUrl = this.generateVidsrcToMovieUrl({ imdbId: movie.imdbId });
      if (vidsrcToUrl && !options.some(o => o.type === 'vidsrc-to')) {
        options.push({
          id: 'vidsrc-to-imdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }

    // VidBinge (alternative)
    if (movie.tmdbId || movie.imdbId) {
      const vidbingeUrl = this.generateVidBingeMovieUrl({ tmdbId: movie.tmdbId, imdbId: movie.imdbId });
      if (vidbingeUrl) {
        options.push({
          id: 'vidbinge',
          name: 'VidBinge',
          url: vidbingeUrl,
          type: 'vidbinge'
        });
      }
    }

    // API (VidPlus etc.) as fallback
    if (movie.tmdbId || movie.imdbId) {
      try {
        const movieId = movie.tmdbId || movie.imdbId;
        const streamingUrl = await vidsrcService.getMovieStreamingUrl(movieId, {
          autoplay: 1,
          primaryColor: '#dc2626'
        });
        if (streamingUrl) {
          const isVidPlus = streamingUrl.includes('vidplus.to');
          options.push({
            id: isVidPlus ? 'vidplus' : 'vidsrc',
            name: isVidPlus ? 'VidPlus' : 'Vidsrc',
            url: streamingUrl,
            type: isVidPlus ? 'vidplus' : 'vidsrc'
          });
        }
      } catch (error) {
        // Silent fail
      }
    }

    // GodrivePlayer options
    if (movie.imdbId) {
      const godriveUrl = this.generateGodriveMovieUrl({ imdbId: movie.imdbId });
      if (godriveUrl) {
        options.push({
          id: 'godrive-imdb',
          name: 'GodrivePlayer (IMDB)',
          url: godriveUrl,
          type: 'godrive'
        });
      }
    }

    if (movie.tmdbId) {
      const godriveUrl = this.generateGodriveMovieUrl({ tmdbId: movie.tmdbId });
      if (godriveUrl) {
        options.push({
          id: 'godrive-tmdb',
          name: 'GodrivePlayer (TMDB)',
          url: godriveUrl,
          type: 'godrive'
        });
      }
    }

    return sortStreamingOptionsForDisplay(options);
  }

  /**
   * Generate all streaming options for a TV episode
   * Default (first) option: VidBinge when available
   */
  async generateEpisodeStreamingOptions(episode: any, tvShow: any): Promise<StreamingOption[]> {
    const options: StreamingOption[] = [];

    // Main stream: real direct URL from data, else default MP4 (never vidsrc/embed as "direct")
    const directUrl = resolveTvPrimaryStreamUrl(
      episode?.streamingUrl,
      episode?.streaming_url,
      episode?.vidsrcUrl,
      episode?.vidsrc_url,
      tvShow.streamingUrl,
      tvShow.vidsrcUrl
    );
    options.push({
      id: 'direct-tvshow',
      name: 'Main Stream',
      url: directUrl,
      type: 'direct'
    });

    // ZXCStream (https://zxcstream.xyz/player/tv/{tmdbId}/{season}/{episode}?autoplay=1)
    const tvTmdbId = tvShow?.tmdbId || (tvShow?._id && String(tvShow._id).startsWith('tmdb_') ? String(tvShow._id).replace('tmdb_', '') : tvShow?._id && /^\d+$/.test(String(tvShow._id)) ? tvShow._id : null);
    const zxcStreamUrl = this.generateZxcStreamEpisodeUrl({
      tmdbId: tvTmdbId,
      imdbId: tvShow?.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (zxcStreamUrl) {
      options.push({
        id: 'zxcstream-tv',
        name: 'ZXCStream',
        url: zxcStreamUrl,
        type: 'zxcstream'
      });
    }

    // MoviePire (https://video.moviepire.co/embed/tv/{tmdbId}/{season}/{episode}?autoplay=1)
    const moviePireTvUrl = this.generateMoviePireEpisodeUrl({
      tmdbId: tvTmdbId,
      imdbId: tvShow?.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (moviePireTvUrl) {
      options.push({
        id: 'moviepire-tv',
        name: 'MoviePire',
        url: moviePireTvUrl,
        type: 'moviepire'
      });
    }

    // VidLink (clean, fast, minimal ads)
    const vidLinkUrl = this.generateVidLinkEpisodeUrl({
      tmdbId: tvShow.tmdbId,
      imdbId: tvShow.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (vidLinkUrl) {
      options.push({
        id: 'vidlink-tv',
        name: 'VidLink (Clean)',
        url: vidLinkUrl,
        type: 'vidlink'
      });
    }

    // AutoEmbed (stable, fewer redirects)
    const autoEmbedUrl = this.generateAutoEmbedEpisodeUrl({
      tmdbId: tvShow.tmdbId,
      imdbId: tvShow.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (autoEmbedUrl) {
      options.push({
        id: 'autoembed-tv',
        name: 'AutoEmbed',
        url: autoEmbedUrl,
        type: 'autoembed'
      });
    }

    // New Vidsrc domains
    this.newVidsrcDomains.forEach((domain, index) => {
      const url = this.generateNewVidsrcEpisodeUrl(domain, {
        imdbId: tvShow.imdbId,
        tmdbId: tvShow.tmdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (url) {
        options.push({
          id: `vidsrc-new-tv-${index}`,
          name: new URL(domain).hostname,
          url,
          type: 'vidsrc-new'
        });
      }
    });

    // SuperEmbed (multiembed.mov) - default player
    if (tvShow.imdbId) {
      const superEmbedUrl = this.generateMultiEmbedEpisodeUrl({
        imdbId: tvShow.imdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-imdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }
    if (tvShow.tmdbId && !options.some(o => o.type === 'multiembed')) {
      const superEmbedUrl = this.generateMultiEmbedEpisodeUrl({
        tmdbId: tvShow.tmdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-tmdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }

    // Vidsrc.to (alternative)
    if (tvShow.tmdbId) {
      const vidsrcToUrl = this.generateVidsrcToEpisodeUrl({
        tmdbId: tvShow.tmdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-tmdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }
    if (tvShow.imdbId && !options.some(o => o.type === 'vidsrc-to')) {
      const vidsrcToUrl = this.generateVidsrcToEpisodeUrl({
        imdbId: tvShow.imdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-imdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }

    // VidBinge (alternative)
    if (tvShow.tmdbId || tvShow.imdbId) {
      const vidbingeUrl = this.generateVidBingeEpisodeUrl({
        tmdbId: tvShow.tmdbId,
        imdbId: tvShow.imdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (vidbingeUrl) {
        options.push({
          id: 'vidbinge',
          name: 'VidBinge',
          url: vidbingeUrl,
          type: 'vidbinge'
        });
      }
    }

    // API (VidPlus etc.) as fallback
    if (tvShow.tmdbId || tvShow.imdbId) {
      try {
        const tvShowId = tvShow.tmdbId || tvShow.imdbId;
        const streamingUrl = await vidsrcService.getEpisodeStreamingUrl(
          tvShowId,
          episode.seasonNumber,
          episode.episodeNumber,
          {
            dsLang: 'en',
            autoplay: 1,
            primaryColor: '#dc2626'
          }
        );
        if (streamingUrl) {
          const isVidPlus = streamingUrl.includes('vidplus.to');
          options.push({
            id: isVidPlus ? 'vidplus' : 'vidsrc',
            name: isVidPlus ? 'VidPlus' : 'Vidsrc',
            url: streamingUrl,
            type: isVidPlus ? 'vidplus' : 'vidsrc'
          });
        }
      } catch (error) {
        // Silent fail
      }
    }

    return sortStreamingOptionsForDisplay(options);
  }

  /**
   * Generate streaming options for TV episodes synchronously (without API calls)
   * Default (first) option: VidBinge when available
   */
  generateEpisodeStreamingOptionsSync(episode: any, tvShow: any): StreamingOption[] {
    const options: StreamingOption[] = [];

    const directUrl = resolveTvPrimaryStreamUrl(
      episode?.streamingUrl,
      episode?.streaming_url,
      episode?.vidsrcUrl,
      episode?.vidsrc_url,
      tvShow.streamingUrl,
      tvShow.vidsrcUrl
    );
    options.push({
      id: 'direct-tvshow',
      name: 'Main Stream',
      url: directUrl,
      type: 'direct'
    });

    // ZXCStream (https://zxcstream.xyz/player/tv/{tmdbId}/{season}/{episode}?autoplay=1)
    const tvTmdbId = tvShow?.tmdbId || (tvShow?._id && String(tvShow._id).startsWith('tmdb_') ? String(tvShow._id).replace('tmdb_', '') : tvShow?._id && /^\d+$/.test(String(tvShow._id)) ? tvShow._id : null);
    const zxcStreamUrl = this.generateZxcStreamEpisodeUrl({
      tmdbId: tvTmdbId,
      imdbId: tvShow?.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (zxcStreamUrl) {
      options.push({
        id: 'zxcstream-tv',
        name: 'ZXCStream',
        url: zxcStreamUrl,
        type: 'zxcstream'
      });
    }

    // MoviePire (https://video.moviepire.co/embed/tv/{tmdbId}/{season}/{episode}?autoplay=1)
    const moviePireTvUrl = this.generateMoviePireEpisodeUrl({
      tmdbId: tvTmdbId,
      imdbId: tvShow?.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (moviePireTvUrl) {
      options.push({
        id: 'moviepire-tv',
        name: 'MoviePire',
        url: moviePireTvUrl,
        type: 'moviepire'
      });
    }

    // VidLink (clean, fast, minimal ads)
    const vidLinkUrl = this.generateVidLinkEpisodeUrl({
      tmdbId: tvShow.tmdbId,
      imdbId: tvShow.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (vidLinkUrl) {
      options.push({
        id: 'vidlink-tv',
        name: 'VidLink (Clean)',
        url: vidLinkUrl,
        type: 'vidlink'
      });
    }

    // AutoEmbed (stable, fewer redirects)
    const autoEmbedUrl = this.generateAutoEmbedEpisodeUrl({
      tmdbId: tvShow.tmdbId,
      imdbId: tvShow.imdbId,
      season: episode.seasonNumber,
      episode: episode.episodeNumber
    });
    if (autoEmbedUrl) {
      options.push({
        id: 'autoembed-tv',
        name: 'AutoEmbed',
        url: autoEmbedUrl,
        type: 'autoembed'
      });
    }

    // SuperEmbed (multiembed.mov) - default player
    if (tvShow.imdbId) {
      const superEmbedUrl = this.generateMultiEmbedEpisodeUrl({
        imdbId: tvShow.imdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-imdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }
    if (tvShow.tmdbId && !options.some(o => o.type === 'multiembed')) {
      const superEmbedUrl = this.generateMultiEmbedEpisodeUrl({
        tmdbId: tvShow.tmdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-tmdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }

    // Vidsrc.to (alternative)
    if (tvShow.tmdbId) {
      const vidsrcToUrl = this.generateVidsrcToEpisodeUrl({
        tmdbId: tvShow.tmdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-tmdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }
    if (tvShow.imdbId && !options.some(o => o.type === 'vidsrc-to')) {
      const vidsrcToUrl = this.generateVidsrcToEpisodeUrl({
        imdbId: tvShow.imdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-imdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }

    // VidBinge (alternative)
    if (tvShow.tmdbId || tvShow.imdbId) {
      const vidbingeUrl = this.generateVidBingeEpisodeUrl({
        tmdbId: tvShow.tmdbId,
        imdbId: tvShow.imdbId,
        season: episode.seasonNumber,
        episode: episode.episodeNumber
      });
      if (vidbingeUrl) {
        options.push({
          id: 'vidbinge',
          name: 'VidBinge',
          url: vidbingeUrl,
          type: 'vidbinge'
        });
      }
    }

    // VidPlus (fallback)
    if (tvShow.tmdbId || tvShow.imdbId) {
      if (tvShow.tmdbId) {
        const vidPlusUrl = `https://player.vidplus.to/embed/tv/${tvShow.tmdbId}/${episode.seasonNumber}/${episode.episodeNumber}?autoplay=1&primaryColor=dc2626`;
        options.push({
          id: 'vidplus',
          name: 'VidPlus',
          url: vidPlusUrl,
          type: 'vidplus'
        });
      } else if (tvShow.imdbId) {
        const cleanImdbId = tvShow.imdbId.startsWith('tt') ? tvShow.imdbId : `tt${tvShow.imdbId}`;
        const vidPlusUrl = `https://player.vidplus.to/embed/tv/${cleanImdbId}/${episode.seasonNumber}/${episode.episodeNumber}?autoplay=1&primaryColor=dc2626`;
        options.push({
          id: 'vidplus',
          name: 'VidPlus',
          url: vidPlusUrl,
          type: 'vidplus'
        });
      }
    }

    return sortStreamingOptionsForDisplay(options);
  }

  /**
   * Generate streaming options synchronously (without API calls)
   * Default (first) option: VidBinge when available
   */
  generateMovieStreamingOptionsSync(movie: any): StreamingOption[] {
    const options: StreamingOption[] = [];

    const directUrl = resolveTvPrimaryStreamUrl(
      movie?.streamingUrl,
      movie?.streaming_url,
      movie?.vidsrcUrl,
      movie?.vidsrc_url
    );
    options.push({
      id: 'direct-movie',
      name: 'Main Stream',
      url: directUrl,
      type: 'direct'
    });

    // ZXCStream (https://zxcstream.xyz/player/movie/{tmdbId}?autoplay=1)
    const movieTmdbId = movie?.tmdbId || (movie?._id && String(movie._id).startsWith('tmdb_') ? String(movie._id).replace('tmdb_', '') : movie?._id && /^\d+$/.test(String(movie._id)) ? movie._id : null);
    const zxcStreamUrl = this.generateZxcStreamMovieUrl({
      tmdbId: movieTmdbId,
      imdbId: movie?.imdbId,
    });
    if (zxcStreamUrl) {
      options.push({
        id: 'zxcstream-movie',
        name: 'ZXCStream',
        url: zxcStreamUrl,
        type: 'zxcstream'
      });
    }

    // MoviePire (https://video.moviepire.co/embed/movie/{tmdbId}?autoplay=1)
    const moviePireUrl = this.generateMoviePireMovieUrl({
      tmdbId: movieTmdbId,
      imdbId: movie?.imdbId,
    });
    if (moviePireUrl) {
      options.push({
        id: 'moviepire-movie',
        name: 'MoviePire',
        url: moviePireUrl,
        type: 'moviepire'
      });
    }

    // VidLink (clean, fast, minimal ads)
    const vidLinkUrl = this.generateVidLinkMovieUrl({
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId,
    });
    if (vidLinkUrl) {
      options.push({
        id: 'vidlink-movie',
        name: 'VidLink (Clean)',
        url: vidLinkUrl,
        type: 'vidlink'
      });
    }

    // AutoEmbed (stable, fewer redirects)
    const autoEmbedUrl = this.generateAutoEmbedMovieUrl({
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId,
    });
    if (autoEmbedUrl) {
      options.push({
        id: 'autoembed-movie',
        name: 'AutoEmbed',
        url: autoEmbedUrl,
        type: 'autoembed'
      });
    }

    // SuperEmbed (multiembed.mov) - default player
    if (movie.imdbId) {
      const superEmbedUrl = this.generateMultiEmbedMovieUrl({ imdbId: movie.imdbId });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-imdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }
    if (movie.tmdbId && !options.some(o => o.type === 'multiembed')) {
      const superEmbedUrl = this.generateMultiEmbedMovieUrl({ tmdbId: movie.tmdbId });
      if (superEmbedUrl) {
        options.push({
          id: 'superembed-tmdb',
          name: 'SuperEmbed',
          url: superEmbedUrl,
          type: 'multiembed'
        });
      }
    }

    // Vidsrc.to (alternative)
    if (movie.tmdbId) {
      const vidsrcToUrl = this.generateVidsrcToMovieUrl({ tmdbId: movie.tmdbId });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-tmdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }
    if (movie.imdbId && !options.some(o => o.type === 'vidsrc-to')) {
      const vidsrcToUrl = this.generateVidsrcToMovieUrl({ imdbId: movie.imdbId });
      if (vidsrcToUrl) {
        options.push({
          id: 'vidsrc-to-imdb',
          name: 'Vidsrc.to',
          url: vidsrcToUrl,
          type: 'vidsrc-to'
        });
      }
    }

    // VidBinge (alternative)
    if (movie.tmdbId || movie.imdbId) {
      const vidbingeUrl = this.generateVidBingeMovieUrl({ tmdbId: movie.tmdbId, imdbId: movie.imdbId });
      if (vidbingeUrl) {
        options.push({
          id: 'vidbinge',
          name: 'VidBinge',
          url: vidbingeUrl,
          type: 'vidbinge'
        });
      }
    }

    // VidPlus (fallback)
    if (movie.tmdbId || movie.imdbId) {
      if (movie.tmdbId) {
        const vidPlusUrl = `https://player.vidplus.to/embed/movie/${movie.tmdbId}?autoplay=1&primaryColor=dc2626`;
        options.push({
          id: 'vidplus',
          name: 'VidPlus',
          url: vidPlusUrl,
          type: 'vidplus'
        });
      } else if (movie.imdbId) {
        const cleanImdbId = movie.imdbId.startsWith('tt') ? movie.imdbId : `tt${movie.imdbId}`;
        const vidPlusUrl = `https://player.vidplus.to/embed/movie/${cleanImdbId}?autoplay=1&primaryColor=dc2626`;
        options.push({
          id: 'vidplus',
          name: 'VidPlus',
          url: vidPlusUrl,
          type: 'vidplus'
        });
      }
    }

    // GodrivePlayer options
    if (movie.imdbId) {
      const godriveUrl = this.generateGodriveMovieUrl({ imdbId: movie.imdbId });
      if (godriveUrl) {
        options.push({
          id: 'godrive-imdb',
          name: 'GodrivePlayer (IMDB)',
          url: godriveUrl,
          type: 'godrive'
        });
      }
    }

    if (movie.tmdbId) {
      const godriveUrl = this.generateGodriveMovieUrl({ tmdbId: movie.tmdbId });
      if (godriveUrl) {
        options.push({
          id: 'godrive-tmdb',
          name: 'GodrivePlayer (TMDB)',
          url: godriveUrl,
          type: 'godrive'
        });
      }
    }

    return sortStreamingOptionsForDisplay(options);
  }
}

const streamingService = new StreamingService();
export default streamingService;

/** TV play modal / player: SuperEmbed/MultiEmbed embed first, then Vidsrc, else direct fallback */
export function getDefaultTvEpisodePlayUrl(
  tvShow: { tmdbId?: number; imdbId?: string },
  season: number,
  episode: number,
  ...candidates: (string | null | undefined)[]
): string {
  const multiembed = streamingService.generateMultiEmbedEpisodeUrl({
    tmdbId: tvShow.tmdbId,
    imdbId: tvShow.imdbId,
    season,
    episode,
  });
  if (multiembed) return multiembed;

  const vidsrcTo = streamingService.generateVidsrcToEpisodeUrl({
    tmdbId: tvShow.tmdbId,
    imdbId: tvShow.imdbId,
    season,
    episode,
  });
  if (vidsrcTo) return vidsrcTo;

  return resolveTvPrimaryStreamUrl(...candidates);
}

/** Movie play: SuperEmbed/MultiEmbed first, then Vidsrc.to */
export function getDefaultMoviePlayUrl(movie: { tmdbId?: number; imdbId?: string }): string | null {
  const multiembed = streamingService.generateMultiEmbedMovieUrl({
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId,
  });
  if (multiembed) return multiembed;

  const vidsrcTo = streamingService.generateVidsrcToMovieUrl({
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId,
  });
  if (vidsrcTo) return vidsrcTo;

  return null;
}

/** Player URL: Selected source first, else default working stream */
export function resolveMoviePlayerStreamUrl(
  movie: { tmdbId?: number; imdbId?: string; streamingUrl?: string; vidsrcUrl?: string },
  selected: StreamingOption | null | undefined,
  preferDefaultStream?: boolean
): string | null {
  if (selected?.url && !preferDefaultStream) return selected.url;
  const defaultUrl = getDefaultMoviePlayUrl(movie);
  if (defaultUrl) return defaultUrl;
  if (selected?.url) return selected.url;
  return resolveMoviePrimaryStreamUrl(movie.streamingUrl, movie.vidsrcUrl);
}

/** TV player URL: Selected source first, else default working stream */
export function resolveTvPlayerStreamUrl(
  tvShow: { tmdbId?: number; imdbId?: string; streamingUrl?: string; vidsrcUrl?: string },
  season: number,
  episode: number,
  selected: StreamingOption | null | undefined,
  preferDefaultStream?: boolean,
  ...extraCandidates: (string | null | undefined)[]
): string | null {
  if (selected?.url && !preferDefaultStream) return selected.url;
  const defaultUrl = getDefaultTvEpisodePlayUrl(tvShow, season, episode, ...extraCandidates);
  if (defaultUrl) return defaultUrl;
  if (selected?.url) return selected.url;
  return resolveTvPrimaryStreamUrl(...extraCandidates);
}

