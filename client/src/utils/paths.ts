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
 * - Slug forms like: "some-title-<id>"
 */
export function extractObjectId(slugOrId?: string | null): string | null {
  if (!slugOrId) return null;
  const raw = String(slugOrId);
  // If it's exactly an id
  if (/^[0-9a-fA-F]{24}$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return raw;
  if (/^tmdb_\d+$/.test(raw)) return raw;

  // New format: <id>-slug
  const m1 = raw.match(/^(tmdb_\d+|\d+|[0-9a-fA-F]{24})-(.+)$/);
  if (m1) return m1[1];

  // Legacy format: slug-<id>
  const m2 = raw.match(/-(tmdb_\d+|\d+|[0-9a-fA-F]{24})$/);
  return m2 ? m2[1] : null;
}

/**
 * URL slug segment before `_id`. For English originals, prefer `originalTitle` when it
 * differs from the localized `title` so canonical paths match TMDB’s primary name
 * (e.g. avoids odd localized strings in the path).
 */
export function movieSlug(movie: {
  _id: string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
}): string {
  const t = (movie.title || '').trim();
  const o = (movie.originalTitle || '').trim();
  const lang = (movie.originalLanguage || '').toLowerCase();
  const useOriginalForSlug =
    lang === 'en' && o.length > 0 && (!t || o.toLowerCase() !== t.toLowerCase());
  const basis = useOriginalForSlug ? o : t || o || 'movie';
  const idStr = movie._id.startsWith('tmdb_') ? movie._id.replace('tmdb_', '') : movie._id;
  return `${idStr}-${slugify(basis)}`;
}

export function tvShowSlug(tvShow: { _id: string; name: string }): string {
  const idStr = tvShow._id.startsWith('tmdb_') ? tvShow._id.replace('tmdb_', '') : tvShow._id;
  return `${idStr}-${slugify(tvShow.name)}`;
}

export function moviePath(movie: {
  _id: string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
}): string {
  return `/movie/${movieSlug(movie)}`;
}

export function tvShowPath(tvShow: { _id: string; name: string }): string {
  return `/tvshow/${tvShowSlug(tvShow)}`;
}

