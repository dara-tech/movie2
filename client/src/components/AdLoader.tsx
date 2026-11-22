import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdLoaderProps {
  /** Optional zone ID override for Monetag */
  zoneId?: string;
  /** Optional script URL override */
  scriptUrl?: string;
  /** Disable ads explicitly */
  disabled?: boolean;
}

const EXCLUDED_ROUTES = [
  '/login',
  '/signin',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
];

const ADMIN_OR_AUTH_SUPPRESSION_STYLE_ID = 'disable-ads-guard-style';
const POPUNDER_ONLY_CLEANUP_STYLE_ID = 'popunder-only-cleanup-style';

/**
 * Check if the given path is a login/auth page or an admin page where ads must never show.
 */
const isExcludedPath = (path: string): boolean => {
  if (!path) return false;
  const cleanPath = path.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  // 1. Auth routes (login, signin, register, password reset)
  const isAuth = EXCLUDED_ROUTES.some(
    (route) => cleanPath === route || cleanPath.startsWith(`${route}/`)
  );
  if (isAuth) return true;

  // 2. Admin routes (/admin, /admin/*)
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    return true;
  }

  return false;
};

/**
 * Total ad suppression style applied on /login, /register, and /admin routes.
 */
const applyFullAdSuppressionStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(ADMIN_OR_AUTH_SUPPRESSION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = ADMIN_OR_AUTH_SUPPRESSION_STYLE_ID;
  style.textContent = `
    #monetag-ad-script,
    [id*="monetag"],
    [class*="monetag"],
    .ipp-container,
    [class*="ipp-"],
    [id*="ipp-"],
    [id^="zone_"],
    [class^="zone_"],
    iframe[src*="quge5.com"],
    iframe[src*="5gvci.com"],
    iframe[src*="roagrofoogrobo.com"],
    div[style*="z-index: 2147483647"],
    div[style*="z-index: 9999999"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      opacity: 0 !important;
      position: absolute !important;
      top: -99999px !important;
      left: -99999px !important;
      width: 0 !important;
      height: 0 !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
};

const removeFullAdSuppressionStyle = () => {
  if (typeof document === 'undefined') return;
  const style = document.getElementById(ADMIN_OR_AUTH_SUPPRESSION_STYLE_ID);
  if (style?.parentNode) {
    style.parentNode.removeChild(style);
  }
};

/**
 * Ensures only Popunder (OnClick) works on public pages:
 * Hides annoying visual in-page push boxes (.ipp-container), floating cards, etc.
 */
const applyPopunderOnlyStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(POPUNDER_ONLY_CLEANUP_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = POPUNDER_ONLY_CLEANUP_STYLE_ID;
  style.textContent = `
    .ipp-container,
    [class*="ipp-"],
    [id*="ipp-"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      position: absolute !important;
      top: -99999px !important;
      left: -99999px !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
};

/**
 * Remove all Monetag scripts and elements when on admin / login or when user is authenticated.
 */
const removeMonetagAds = () => {
  if (typeof document === 'undefined') return;

  const scripts = document.querySelectorAll(
    'script#monetag-ad-script, script[src*="quge5.com"], script[src*="5gvci.com"], script[src*="roagrofoogrobo.com"], script[data-zone]'
  );
  scripts.forEach((script) => {
    try {
      script.parentNode?.removeChild(script);
    } catch {}
  });

  const iframes = document.querySelectorAll(
    'iframe[src*="quge5.com"], iframe[src*="5gvci.com"], iframe[src*="roagrofoogrobo.com"], iframe[id*="monetag"], iframe[class*="monetag"]'
  );
  iframes.forEach((iframe) => {
    try {
      iframe.parentNode?.removeChild(iframe);
    } catch {}
  });

  const adSelectors = [
    '[id*="monetag"]',
    '[class*="monetag"]',
    '.ipp-container',
    '[class*="ipp-"]',
    '[id^="zone_"]',
    '[class^="zone_"]'
  ];

  adSelectors.forEach((selector) => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const tagName = el.tagName.toLowerCase();
        if (
          tagName === 'iframe' ||
          el.id === 'monetag-ad-script' ||
          el.hasAttribute('data-zone') ||
          (el.className && typeof el.className === 'string' && (el.className.includes('ipp-') || el.className.includes('monetag')))
        ) {
          el.parentNode?.removeChild(el);
        }
      });
    } catch {}
  });

  if (typeof window !== 'undefined') {
    try {
      const win = window as any;
      if (win.__monetag) win.__monetag = undefined;
      if (win._monetag) win._monetag = undefined;
      if (win.__monetag_injected) win.__monetag_injected = false;
    } catch {}
  }
};

/**
 * AdLoader keeps Popunder (OnClick) active for public visitors, while:
 * 1. Suppressing floating in-page push and visual banner popups.
 * 2. Strictly disabling ads and popunders on /login, /register, and /admin routes.
 * 3. Keeping authenticated users 100% ad-free.
 */
const AdLoader: React.FC<AdLoaderProps> = ({ zoneId, scriptUrl, disabled = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const observerRef = useRef<MutationObserver | null>(null);

  // Guard against window.open popunders when on login, auth, or admin pages
  useEffect(() => {
    const currentPath = location.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const isExcluded = isExcludedPath(currentPath) || (typeof window !== 'undefined' && isExcludedPath(window.location.pathname));
    const isBlocked = disabled || Boolean(user) || isExcluded;

    if (isBlocked && typeof window !== 'undefined') {
      applyFullAdSuppressionStyle();

      const originalOpen = window.open;
      const adDomainPatterns = [
        /quge5\.com/i,
        /5gvci\.com/i,
        /roagrofoogrobo\.com/i,
        /monetag/i,
        /propeller/i,
        /adsterra/i,
        /hilltopads/i,
      ];

      // Block window.open popunders only on protected (login/admin/user) pages
      window.open = function(url?: string | URL, target?: string, features?: string) {
        const urlStr = url ? String(url).trim() : '';
        if (!urlStr || urlStr === 'about:blank' || urlStr === 'about:srcdoc') {
          return null;
        }

        const isAdUrl = adDomainPatterns.some(pattern => pattern.test(urlStr));
        if (isAdUrl) {
          return null;
        }

        return originalOpen.call(this, url, target, features);
      };

      // Capture-phase click listener to stop ad anchor clicks on login/admin
      const handleCaptureClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const link = target?.closest('a') as HTMLAnchorElement | null;
        if (link && link.href) {
          const isAdLink = adDomainPatterns.some(p => p.test(link.href));
          if (isAdLink) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            link.remove();
          }
        }
      };

      document.addEventListener('click', handleCaptureClick, true);

      return () => {
        window.open = originalOpen;
        document.removeEventListener('click', handleCaptureClick, true);
      };
    } else {
      removeFullAdSuppressionStyle();
      applyPopunderOnlyStyle();
    }
  }, [location.pathname, user, disabled]);

  // Main ad injection effect for Popunder (OnClick)
  useEffect(() => {
    const currentPath = location.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const isExcluded = isExcludedPath(currentPath) || (typeof window !== 'undefined' && isExcludedPath(window.location.pathname));
    const isAuthenticated = Boolean(user) || user !== null;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // 1. Do not inject while auth is loading to prevent flash on /login or /admin
    if (loading) {
      return;
    }

    // 2. If disabled, logged in, or on excluded routes (login/admin), keep 100% clean
    if (disabled || isAuthenticated || isExcluded) {
      applyFullAdSuppressionStyle();
      removeMonetagAds();

      // If Monetag was active before navigating to login/admin, flush memory
      if (typeof window !== 'undefined' && (window as any).__monetag_injected) {
        (window as any).__monetag_injected = false;
        window.location.replace(currentPath);
        return;
      }

      if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        const observer = new MutationObserver(() => {
          removeMonetagAds();
        });
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });
        observerRef.current = observer;
      }

      return;
    }

    // 3. Public visitor browsing: Load Monetag Popunder (OnClick)
    removeFullAdSuppressionStyle();
    applyPopunderOnlyStyle();

    const activeZoneId =
      zoneId ||
      process.env.REACT_APP_MONETAG_ZONE_ID ||
      '303675';

    const activeScriptUrl =
      scriptUrl ||
      process.env.REACT_APP_MONETAG_SCRIPT_URL ||
      'https://quge5.com/88/tag.min.js';

    const existingScript = document.getElementById('monetag-ad-script');
    if (existingScript) return;

    const script = document.createElement('script');
    script.id = 'monetag-ad-script';
    script.src = activeScriptUrl;
    script.dataset.zone = activeZoneId;
    script.setAttribute('data-zone', activeZoneId);
    script.async = true;
    script.setAttribute('data-cfasync', 'false');

    script.onerror = () => {
      // Ad blocker blocked script or network error - fail silently
    };

    const targetParent = document.head || document.body || document.documentElement;
    (window as any).__monetag_injected = true;
    targetParent.appendChild(script);

    return () => {
      // On unmount/route change, if leaving to a protected route, it cleans up
    };
  }, [user, loading, zoneId, scriptUrl, disabled, location.pathname]);

  return null;
};

export default AdLoader;
