import React, { useEffect, useRef } from 'react';
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

const EXCLUDED_ROUTES = [
  '/login',
  '/signin',
  '/register',
  '/auth',
  '/forgot-password',
  '/reset-password',
];

const AD_SUPPRESSION_STYLE_ID = 'disable-ads-guard-style';

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
 * Enforces CSS rules to guarantee ad network elements, floating push boxes, and popunder overlays
 * are completely invisible and unable to receive click events.
 */
const applyAdSuppressionStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(AD_SUPPRESSION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = AD_SUPPRESSION_STYLE_ID;
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

const removeAdSuppressionStyle = () => {
  if (typeof document === 'undefined') return;
  const style = document.getElementById(AD_SUPPRESSION_STYLE_ID);
  if (style?.parentNode) {
    style.parentNode.removeChild(style);
  }
};

/**
 * Thoroughly removes all Monetag scripts, ad iframes, floating popups, and overlays from the DOM.
 */
const removeMonetagAds = () => {
  if (typeof document === 'undefined') return;

  // 1. Remove all Monetag and ad network script tags
  const scripts = document.querySelectorAll(
    'script#monetag-ad-script, script[src*="quge5.com"], script[src*="5gvci.com"], script[data-zone]'
  );
  scripts.forEach((script) => {
    try {
      script.parentNode?.removeChild(script);
    } catch {}
  });

  // 2. Remove ad iframes created by Monetag / ad networks
  const iframes = document.querySelectorAll(
    'iframe[src*="quge5.com"], iframe[src*="5gvci.com"], iframe[id*="monetag"], iframe[class*="monetag"]'
  );
  iframes.forEach((iframe) => {
    try {
      iframe.parentNode?.removeChild(iframe);
    } catch {}
  });

  // 3. Remove injected ad overlays, floating in-page push, banners, or popunder containers
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
        // Only remove ad-specific containers, avoid touching application components
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

  // 4. Clear any Monetag globals on window
  if (typeof window !== 'undefined') {
    try {
      const win = window as any;
      if (win.__monetag) win.__monetag = undefined;
      if (win._monetag) win._monetag = undefined;
    } catch {}
  }
};

const AdLoader: React.FC<AdLoaderProps> = ({ zoneId, scriptUrl, disabled = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const observerRef = useRef<MutationObserver | null>(null);

  // Guard against window.open popunders and clicks when on login, auth, or admin pages
  useEffect(() => {
    const currentPath = location.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const isExcluded = isExcludedPath(currentPath) || (typeof window !== 'undefined' && isExcludedPath(window.location.pathname));
    const isBlocked = disabled || Boolean(user) || isExcluded;

    if (isBlocked && typeof window !== 'undefined') {
      applyAdSuppressionStyle();

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

      // Block window.open popunders
      window.open = function(url?: string | URL, target?: string, features?: string) {
        const urlStr = url ? String(url).trim() : '';

        // Block empty, about:blank, or ad network popunders
        if (!urlStr || urlStr === 'about:blank' || urlStr === 'about:srcdoc') {
          return null;
        }

        const isAdUrl = adDomainPatterns.some(pattern => pattern.test(urlStr));
        if (isAdUrl) {
          return null;
        }

        return originalOpen.call(this, url, target, features);
      };

      // Capture-phase click listener to stop hidden ad anchor clicks
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
      removeAdSuppressionStyle();
    }
  }, [location.pathname, user, disabled]);

  // Main ad injection and cleanup effect
  useEffect(() => {
    const currentPath = location.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    const isExcluded = isExcludedPath(currentPath) || (typeof window !== 'undefined' && isExcludedPath(window.location.pathname));
    const isAuthenticated = Boolean(user);

    // Disconnect any existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // 1. DO NOT inject ads while authentication is loading (prevents flash on /admin or /login)
    if (loading) {
      return;
    }

    // 2. Clean up and return if disabled, user is authenticated (100% ad-free), or on login/admin routes
    if (disabled || isAuthenticated || isExcluded) {
      applyAdSuppressionStyle();
      removeMonetagAds();

      // If Monetag was active before entering login/admin, reset window to cleanly flush memory listeners
      if (typeof window !== 'undefined' && (window as any).__monetag_injected) {
        (window as any).__monetag_injected = false;
        window.location.replace(currentPath);
        return;
      }

      // Set up a MutationObserver on login / admin pages to sweep any delayed ad nodes
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

    // 3. Otherwise, load Monetag for unauthenticated public browsing
    removeAdSuppressionStyle();

    const activeZoneId =
      zoneId ||
      process.env.REACT_APP_MONETAG_ZONE_ID ||
      '303675';

    const activeScriptUrl =
      scriptUrl ||
      process.env.REACT_APP_MONETAG_SCRIPT_URL ||
      'https://quge5.com/88/tag.min.js';

    // Prevent duplicate script injection
    const existingScript =
      document.getElementById('monetag-ad-script') ||
      document.querySelector('script[src*="quge5.com"]') ||
      document.querySelector('script[data-zone="303675"]');
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
    (window as any).__monetag_injected = true;
    targetParent.appendChild(script);

    return () => {
      // Disconnect observer on cleanup; only remove ads when transitioning to auth/admin
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [user, loading, zoneId, scriptUrl, disabled, location.pathname]);

  return null;
};

export default AdLoader;
