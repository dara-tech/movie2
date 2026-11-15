/**
 * Request Cache Utility
 * Prevents duplicate API calls by caching in-flight requests
 * This significantly reduces network overhead and improves performance
 */

interface CachedRequest {
  promise: Promise<any>;
  timestamp: number;
  data?: any;
}

class RequestCache {
  private cache: Map<string, CachedRequest> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds for GET requests
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Get a cached request or create a new one
   * If a request with the same key is already in flight, return the existing promise
   */
  get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // If we have a cached request that's still valid, return it
    if (cached) {
      const age = now - cached.timestamp;
      if (age < this.CACHE_TTL) {
        // If we have cached data, return it immediately
        if (cached.data !== undefined) {
          return Promise.resolve(cached.data);
        }
        // Otherwise return the in-flight promise
        return cached.promise;
      } else {
        // Cache expired, remove it
        this.cache.delete(key);
      }
    }

    // Create new request
    const promise = fetcher()
      .then((data) => {
        // Cache the result
        const cached = this.cache.get(key);
        if (cached) {
          cached.data = data;
        }
        return data;
      })
      .catch((error) => {
        // Remove from cache on error so it can be retried
        this.cache.delete(key);
        throw error;
      });

    // Store the promise
    this.cache.set(key, {
      promise,
      timestamp: now,
    });

    // Limit cache size
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return promise;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const requestCache = new RequestCache();

/**
 * Create a cache key from a request config
 */
export function createCacheKey(url: string, params?: any): string {
  const sortedParams = params
    ? Object.keys(params)
        .sort()
        .map((key) => `${key}=${JSON.stringify(params[key])}`)
        .join('&')
    : '';
  return `${url}${sortedParams ? `?${sortedParams}` : ''}`;
}

