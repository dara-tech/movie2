import { useEffect } from 'react';
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

  useEffect(() => {
    initActivityTracker();
  }, []);

  useEffect(() => {
    const query = serializeSearchParams(location.search);
    trackEvent({
      eventType: 'page_view',
      path: location.pathname,
      query,
      metadata: {
        title: document.title,
        scrollY: window.scrollY
      }
    });
  }, [location.pathname, location.search]);
};

