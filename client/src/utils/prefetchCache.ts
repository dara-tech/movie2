// Shared prefetch cache for movie data (bounded to limit RAM)

import { PREFETCH_MAX_ENTRIES, trimMapToMaxSize } from './boundedCache';

const prefetchCache = new Map<string, Promise<any>>();
const prefetchDataCache = new Map<string, any>();
const PREFETCH_TTL_MS = 90_000;

function trimPrefetch(): void {
  trimMapToMaxSize(prefetchDataCache, PREFETCH_MAX_ENTRIES, prefetchCache);
}

export const getPrefetchedMovie = (movieId: string): any | null => {
  if (prefetchDataCache.has(movieId)) {
    return prefetchDataCache.get(movieId);
  }

  const prefetchPromise = prefetchCache.get(movieId);
  if (prefetchPromise) {
    return prefetchPromise;
  }

  return null;
};

export const setPrefetchedMovie = (movieId: string, data: any) => {
  prefetchDataCache.set(movieId, data);
  trimPrefetch();
};

export const hasPrefetchedMovie = (movieId: string): boolean => {
  return prefetchDataCache.has(movieId) || prefetchCache.has(movieId);
};

export const clearPrefetchCache = (movieId?: string) => {
  if (movieId) {
    prefetchCache.delete(movieId);
    prefetchDataCache.delete(movieId);
  } else {
    prefetchCache.clear();
    prefetchDataCache.clear();
  }
};

export function registerPrefetchPromise(movieId: string, promise: Promise<any>): void {
  prefetchCache.set(movieId, promise);
  promise
    .then((data) => {
      if (data) setPrefetchedMovie(movieId, data);
    })
    .catch(() => {
      prefetchCache.delete(movieId);
    })
    .finally(() => {
      window.setTimeout(() => {
        prefetchCache.delete(movieId);
        prefetchDataCache.delete(movieId);
      }, PREFETCH_TTL_MS);
    });
  trimPrefetch();
}

export { prefetchCache, prefetchDataCache };
