import api from '../services/api';

export type ActivityEventType =
  | 'page_view'
  | 'search'
  | 'movie_play'
  | 'tv_play'
  | 'watch_completion'
  | 'watchlist_add'
  | 'watchlist_remove'
  | 'favorite_add'
  | 'favorite_remove'
  | 'filter'
  | 'navigation'
  | 'interaction'
  | 'error'
  | 'custom';

export interface ActivityEventPayload {
  eventType: ActivityEventType;
  path?: string;
  query?: Record<string, any>;
  referrer?: string | null;
  searchTerm?: string;
  contentType?: 'movie' | 'tvshow' | 'cast' | 'collection';
  contentId?: string | number | null;
  season?: number;
  episode?: number;
  watchPosition?: number;
  duration?: number;
  device?: string;
  browser?: string;
  locale?: string;
  metadata?: Record<string, any>;
}

interface QueuedEvent extends ActivityEventPayload {
  sessionId: string;
  timestamp: string;
}

const SESSION_STORAGE_KEY = 'ms_session_id';
const FLUSH_INTERVAL_MS = 4000;
const MAX_BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 80;

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let trackerInitialized = false;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const ensureSessionId = (): string => {
  if (!isBrowser) {
    return 'server-session';
  }
  const storage = window.localStorage;
  let sessionId = storage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    if (typeof window.crypto?.randomUUID === 'function') {
      sessionId = window.crypto.randomUUID();
    } else {
      sessionId = `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    }
    storage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
};

const getNavigatorMetadata = () => {
  if (!isBrowser) {
    return {
      device: 'server',
      browser: 'server',
      locale: 'en-US'
    };
  }

  const nav = window.navigator;
  const uaData = (nav as unknown as { userAgentData?: { platform?: string } })?.userAgentData;
  return {
    device: uaData?.platform || nav.platform,
    browser: nav.userAgent,
    locale: nav.language || (Array.isArray(nav.languages) ? nav.languages[0] : 'en-US')
  };
};

const parseCurrentQuery = () => {
  if (!isBrowser) return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params.entries());
  } catch {
    return {};
  }
};

const getAbsoluteUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  const base =
    api.defaults.baseURL ||
    (isBrowser ? window.location.origin : 'http://localhost:5000');
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}${path.startsWith('/') ? '' : '/'}${path}`;
};

const scheduleFlush = () => {
  if (flushTimer || !isBrowser) return;
  flushTimer = setTimeout(() => {
    flushActivityQueue().catch(() => {
      // Swallow errors - already logged inside flush
    });
  }, FLUSH_INTERVAL_MS);
};

// Store handlers for cleanup
let visibilityHandler: (() => void) | null = null;
let beforeUnloadHandler: (() => void) | null = null;

export const initActivityTracker = () => {
  if (trackerInitialized || !isBrowser) return;
  trackerInitialized = true;

  visibilityHandler = () => {
    if (document.visibilityState === 'hidden') {
      flushActivityQueue({ sync: true });
    }
  };

  beforeUnloadHandler = () => {
    flushActivityQueue({ sync: true });
  };

  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('beforeunload', beforeUnloadHandler);
};

export const cleanupActivityTracker = () => {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  trackerInitialized = false;
};

const enqueueEvent = (event: ActivityEventPayload) => {
  const sessionId = ensureSessionId();
  const timestamp = new Date().toISOString();
  const navigatorMetadata = getNavigatorMetadata();

  const payload: QueuedEvent = {
    path: event.path ?? (isBrowser ? window.location.pathname : undefined),
    query: event.query ?? parseCurrentQuery(),
    referrer:
      event.referrer ??
      (isBrowser ? document.referrer || null : null),
    ...navigatorMetadata,
    ...event,
    sessionId,
    timestamp,
    metadata: {
      ...event.metadata,
      viewport:
        (isBrowser ? `${window.innerWidth}x${window.innerHeight}` : undefined) ??
        event.metadata?.viewport
    }
  };

  queue.push(payload);

  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }
};

export const trackEvent = (
  event: ActivityEventPayload,
  options: { immediate?: boolean } = {}
) => {
  if (!isBrowser) return;
  enqueueEvent(event);

  if (options.immediate || queue.length >= MAX_BATCH_SIZE) {
    flushActivityQueue().catch(() => {
      // Errors are logged in flushActivityQueue
    });
  } else {
    scheduleFlush();
  }
};

export const flushActivityQueue = async (options: { sync?: boolean } = {}) => {
  if (!queue.length || isFlushing) return;

  const eventsToSend = [...queue];
  queue = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  isFlushing = true;
  try {
    if (options.sync && isBrowser && typeof navigator.sendBeacon === 'function') {
      const url = getAbsoluteUrl('/api/activity/events');
      const blob = new Blob(
        [JSON.stringify({ events: eventsToSend })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(url, blob);
    } else {
      await api.post('/api/activity/events', { events: eventsToSend });
    }
  } catch (error) {
    // Requeue the events (up to MAX_QUEUE_SIZE)
    queue = [...eventsToSend, ...queue].slice(-MAX_QUEUE_SIZE);
  } finally {
    isFlushing = false;
  }
};

