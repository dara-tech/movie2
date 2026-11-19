import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { initActivityTracker, trackEvent } from '../utils/activityTracker';

const serializeSearchParams = (search: string) => {
  if (!search) return {};
  try {
    const params = new URLSearchParams(search);
    return Object.fromEntries(params.entries());
  } catch {
    return {};
  }
};

export const useActivityTracking = () => {
  const location = useLocation();
  const prevLocationRef = useRef<string | null>(null);

  useEffect(() => {
    initActivityTracker();
  }, []);

  useEffect(() => {
    const query = serializeSearchParams(location.search);
    const prevPath = prevLocationRef.current;

    // Capture initial external landing referrer in session storage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (!sessionStorage.getItem('ms_landing_referrer') && document.referrer) {
        sessionStorage.setItem('ms_landing_referrer', document.referrer);
      }
    }
    const landingReferrer =
      typeof window !== 'undefined' && window.sessionStorage
        ? sessionStorage.getItem('ms_landing_referrer')
        : null;

    trackEvent({
      eventType: 'page_view',
      path: location.pathname,
      query,
      referrer: prevPath
        ? (typeof window !== 'undefined' ? `${window.location.origin}${prevPath}` : prevPath)
        : (document.referrer || landingReferrer || null),
      metadata: {
        title: document.title,
        scrollY: window.scrollY,
        fromPath: prevPath || undefined,
        landingReferrer: landingReferrer || undefined
      }
    });

    prevLocationRef.current = `${location.pathname}${location.search}`;
  }, [location.pathname, location.search]);
};

