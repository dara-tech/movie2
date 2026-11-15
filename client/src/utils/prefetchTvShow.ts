import { PREFETCH_MAX_ENTRIES, trimMapToMaxSize } from './boundedCache';

const prefetchTvShowCache = new Map<string, Promise<any>>();
const prefetchTvShowDataCache = new Map<string, any>();
const PREFETCH_TTL_MS = 90_000;

function trimPrefetch(): void {
  trimMapToMaxSize(prefetchTvShowDataCache, PREFETCH_MAX_ENTRIES, prefetchTvShowCache);
}

export const getPrefetchedTvShow = (tvShowId: string): any | null => {
  if (prefetchTvShowDataCache.has(tvShowId)) {
    return prefetchTvShowDataCache.get(tvShowId);
  }

  const pending = prefetchTvShowCache.get(tvShowId);
  if (pending) {
    return pending;
  }

  return null;
};

export const setPrefetchedTvShow = (tvShowId: string, data: any) => {
  prefetchTvShowDataCache.set(tvShowId, data);
  trimPrefetch();
};

export const hasPrefetchedTvShow = (tvShowId: string): boolean => {
  return prefetchTvShowDataCache.has(tvShowId) || prefetchTvShowCache.has(tvShowId);
};

export const clearPrefetchedTvShowCache = (tvShowId?: string) => {
  if (tvShowId) {
    prefetchTvShowCache.delete(tvShowId);
    prefetchTvShowDataCache.delete(tvShowId);
  } else {
    prefetchTvShowCache.clear();
    prefetchTvShowDataCache.clear();
  }
};

export function registerTvShowPrefetchPromise(tvShowId: string, promise: Promise<any>): void {
  prefetchTvShowCache.set(tvShowId, promise);
  promise
    .then((data) => {
      if (data) setPrefetchedTvShow(tvShowId, data);
    })
    .catch(() => {
      prefetchTvShowCache.delete(tvShowId);
    })
    .finally(() => {
      window.setTimeout(() => {
        prefetchTvShowCache.delete(tvShowId);
        prefetchTvShowDataCache.delete(tvShowId);
      }, PREFETCH_TTL_MS);
    });
  trimPrefetch();
}

export { prefetchTvShowCache, prefetchTvShowDataCache };
