export function slugify(input: string): string {
  return (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Extracts the API id from a route param.
 * Supports:
 * - Mongo ObjectId (24 hex)
 * - TMDB id (digits)
 * - HybridService id (tmdb_123)
 * - Primary SEO format: "[title]-[year]-[id]" or "[title]-[id]" (ID at the end)
 * - Legacy format: "[id]-[title]" (ID at the start)
 */
export function extractObjectId(slugOrId?: string | null): string | null {
  if (!slugOrId) return null;
  const raw = String(slugOrId).trim();

  // If it's directly an ID
  if (/^[0-9a-fA-F]{24}$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return raw;
  if (/^tmdb_\d+$/.test(raw)) return raw;

  // 1. Primary SEO format: Title + Year + ID at end, e.g. "avatar-aang-2025-980431"
  const mEnd = raw.match(/-([0-9a-fA-F]{24}|tmdb_\d+|\d+)$/);
  if (mEnd) return mEnd[1];

  // 2. Legacy format: ID at start, e.g. "980431-avatar-aang"
  const mStart = raw.match(/^([0-9a-fA-F]{24}|tmdb_\d+|\d+)-(.+)$/);
  if (mStart) return mStart[1];

  return null;
}

/**
 * Robustly extracts a 4-digit release year from a string or Date.
 */
function extractYear(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  const str = String(dateVal);
  const match = str.match(/\b(19\d\d|20\d\d)\b/);
  if (match) return `-${match[1]}`;
  const y = new Date(dateVal).getFullYear();
  if (!isNaN(y) && y > 1900 && y < 2100) return `-${y}`;
  return '';
}

/**
 * High-performing SEO Movie Slug:
 * Places Movie Title + Release Year FIRST for maximum keyword weight on Google,
 * followed by the content ID (prefers clean numeric TMDB ID over Mongo ObjectId):
 * /movie/avatar-aang-the-last-airbender-2025-980431
 */
export function movieSlug(movie: {
  _id?: string;
  tmdbId?: number | string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  releaseDate?: string | Date;
}): string {
  const t = (movie.title || '').trim();
  const o = (movie.originalTitle || '').trim();
  const lang = (movie.originalLanguage || '').toLowerCase();
  const useOriginalForSlug =
    lang === 'en' && o.length > 0 && (!t || o.toLowerCase() !== t.toLowerCase());
  const basis = useOriginalForSlug ? o : t || o || 'movie';

  // Prefer tmdbId when available for much cleaner, shorter, SEO-friendly numeric URLs
  const rawId = movie.tmdbId ? String(movie.tmdbId) : String(movie._id || '');
  const idStr = rawId.startsWith('tmdb_') ? rawId.replace('tmdb_', '') : rawId;
  const yearStr = extractYear(movie.releaseDate);

  return `${slugify(basis)}${yearStr}-${idStr}`;
}

export function tvShowSlug(tvShow: {
  _id?: string;
  tmdbId?: number | string;
  name: string;
  firstAirDate?: string | Date;
}): string {
  const rawId = tvShow.tmdbId ? String(tvShow.tmdbId) : String(tvShow._id || '');
  const idStr = rawId.startsWith('tmdb_') ? rawId.replace('tmdb_', '') : rawId;
  const yearStr = extractYear(tvShow.firstAirDate);

  return `${slugify(tvShow.name)}${yearStr}-${idStr}`;
}

export function moviePath(movie: {
  _id?: string;
  tmdbId?: number | string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  releaseDate?: string | Date;
}): string {
  return `/movie/${movieSlug(movie)}`;
}

export function tvShowPath(tvShow: {
  _id?: string;
  tmdbId?: number | string;
  name: string;
  firstAirDate?: string | Date;
}): string {
  return `/tvshow/${tvShowSlug(tvShow)}`;
}
