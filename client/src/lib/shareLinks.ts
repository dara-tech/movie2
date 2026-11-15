import environment from '../config/environment';

/**
 * Rich-preview share URLs (server returns HTML with og:image, og:title, etc.).
 * Paste in Discord, iMessage, Slack — they fetch this URL without running React.
 *
 * Backend: GET /api/share/movie/:id and /api/share/tv/:id
 * Set CLIENT_PUBLIC_URL on the server so og:url and redirects point at your SPA.
 */
export function getShareApiBase(): string {
  return (environment.API_URL || '').replace(/\/$/, '');
}

export function getShareMovieUrl(apiMovieId: string): string {
  const base = getShareApiBase();
  const id = encodeURIComponent(apiMovieId);
  return `${base}/api/share/movie/${id}`;
}

export function getShareTvUrl(apiTvShowId: string): string {
  const base = getShareApiBase();
  const id = encodeURIComponent(apiTvShowId);
  return `${base}/api/share/tv/${id}`;
}
