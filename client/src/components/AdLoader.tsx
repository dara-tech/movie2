import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdLoaderProps {
  /** Optional zone ID override for Monetag MultiTag */
  zoneId?: string;
  /** Optional script URL override */
  scriptUrl?: string;
  /** Disable ads explicitly */
  disabled?: boolean;
}

const AUTH_ROUTES = [
  '/signin',
  '/login',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
];

const isAuthPath = (path: string): boolean => {
  if (!path) return false;
  const cleanPath = path.toLowerCase().split('?')[0].split('#')[0];
  return AUTH_ROUTES.some(
    (route) => cleanPath === route || cleanPath.startsWith(`${route}/`)
  );
};

const removeMonetagScript = () => {
  if (typeof document === 'undefined') return;

  const scripts = document.querySelectorAll('#monetag-ad-script');
  scripts.forEach((script) => {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
  });

  const headScript = document.head?.querySelector('#monetag-ad-script');
  if (headScript?.parentNode) {
    headScript.parentNode.removeChild(headScript);
  }

  const bodyScript = document.body?.querySelector('#monetag-ad-script');
  if (bodyScript?.parentNode) {
    bodyScript.parentNode.removeChild(bodyScript);
  }

  const byId = document.getElementById('monetag-ad-script');
  if (byId?.parentNode) {
    byId.parentNode.removeChild(byId);
  }
};

const AdLoader: React.FC<AdLoaderProps> = ({ zoneId, scriptUrl, disabled = false }) => {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const isAuthRoute = isAuthPath(currentPath) || (typeof window !== 'undefined' && isAuthPath(window.location.pathname));
    const isAuthenticated = Boolean(user) || user !== null;

    // 1. Clean up and return if disabled, user is authenticated (100% ad-free), or on auth routes
    if (disabled || isAuthenticated || isAuthRoute) {
      removeMonetagScript();
      return;
    }

    // Zone ID from prop, environment variable, or default Monetag MultiTag zone
    const activeZoneId =
      zoneId ||
      process.env.REACT_APP_MONETAG_ZONE_ID ||
      '303675';

    const activeScriptUrl =
      scriptUrl ||
      process.env.REACT_APP_MONETAG_SCRIPT_URL ||
      'https://quge5.com/88/tag.min.js';

    // Prevent duplicate script injection
    const existingScript = document.getElementById('monetag-ad-script');
    if (existingScript) return;

    // Monetag MultiTag script
    const script = document.createElement('script');
    script.id = 'monetag-ad-script';
    script.src = activeScriptUrl;
    script.dataset.zone = activeZoneId;
    script.setAttribute('data-zone', activeZoneId);
    script.async = true;
    script.setAttribute('data-cfasync', 'false');

    script.onerror = () => {
      // Ad blocker blocked the script or network error - fail silently
    };

    const targetParent = document.head || document.body || document.documentElement;
    targetParent.appendChild(script);

    return () => {
      // Cleanup script on unmount
      removeMonetagScript();
    };
  }, [user, zoneId, scriptUrl, disabled, location.pathname]);

  return null;
};

export default AdLoader;
