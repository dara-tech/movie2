/**
 * Google Analytics utility functions
 * 
 * Usage:
 * - trackEvent('view_movie', { movie_id: '123', movie_title: 'The Matrix' })
 * - trackPageView('/movie/123')
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Track a custom event in Google Analytics
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, any>
): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
};

/**
 * Track a page view
 */
export const trackPageView = (path: string, title?: string): void => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-449FS2FPMX', {
      page_path: path,
      page_title: title,
    });
  }
};

/**
 * Track movie view
 */
export const trackMovieView = (movieId: string, movieTitle: string): void => {
  trackEvent('view_movie', {
    movie_id: movieId,
    movie_title: movieTitle,
    content_type: 'movie',
  });
};

/**
 * Track TV show view
 */
export const trackTVShowView = (tvShowId: string, tvShowName: string): void => {
  trackEvent('view_tvshow', {
    tvshow_id: tvShowId,
    tvshow_name: tvShowName,
    content_type: 'tvshow',
  });
};

/**
 * Track video play
 */
export const trackVideoPlay = (
  contentId: string,
  contentType: 'movie' | 'tvshow',
  contentTitle: string
): void => {
  trackEvent('play_video', {
    content_id: contentId,
    content_type: contentType,
    content_title: contentTitle,
  });
};

/**
 * Track search query
 */
export const trackSearch = (query: string, resultCount: number): void => {
  trackEvent('search', {
    search_term: query,
    result_count: resultCount,
  });
};

/**
 * Track user registration
 */
export const trackRegistration = (method: 'email' | 'social' = 'email'): void => {
  trackEvent('sign_up', {
    method,
  });
};

/**
 * Track user login
 */
export const trackLogin = (method: 'email' | 'social' = 'email'): void => {
  trackEvent('login', {
    method,
  });
};

/**
 * Track watchlist add
 */
export const trackWatchlistAdd = (contentId: string, contentType: string): void => {
  trackEvent('add_to_watchlist', {
    content_id: contentId,
    content_type: contentType,
  });
};

/**
 * Track share event
 */
export const trackShare = (
  contentType: string,
  contentId: string,
  method: 'facebook' | 'twitter' | 'whatsapp' | 'native'
): void => {
  trackEvent('share', {
    content_type: contentType,
    content_id: contentId,
    method,
  });
};


