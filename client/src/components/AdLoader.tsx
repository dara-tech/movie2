import React, { useEffect, useRef } from 'react';

interface AdLoaderProps {
  /** Optional zone ID override (retained for backward compatibility) */
  zoneId?: string;
  /** Optional script URL override (retained for backward compatibility) */
  scriptUrl?: string;
  /** Disable ads explicitly */
  disabled?: boolean;
}

const AD_SUPPRESSION_STYLE_ID = 'disable-ads-guard-style';

/**
 * Enforces CSS rules to guarantee ad network elements, floating push boxes, and popunder overlays
 * are completely invisible and unable to receive click events across the entire site.
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

/**
 * Thoroughly removes all Monetag scripts, ad iframes, floating popups, and overlays from the DOM.
 */
const removeMonetagAds = () => {
  if (typeof document === 'undefined') return;

  // 1. Remove all Monetag and ad network script tags
  const scripts = document.querySelectorAll(
    'script#monetag-ad-script, script[src*="quge5.com"], script[src*="5gvci.com"], script[src*="roagrofoogrobo.com"], script[data-zone]'
  );
  scripts.forEach((script) => {
    try {
      script.parentNode?.removeChild(script);
    } catch {}
  });

  // 2. Remove ad iframes created by Monetag / ad networks
  const iframes = document.querySelectorAll(
    'iframe[src*="quge5.com"], iframe[src*="5gvci.com"], iframe[src*="roagrofoogrobo.com"], iframe[id*="monetag"], iframe[class*="monetag"]'
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
      if (win.__monetag_injected) win.__monetag_injected = false;
    } catch {}
  }
};

/**
 * AdLoader acts as a global anti-ad and popunder prevention guard.
 * All network ads (Monetag MultiTag, popunders on click, IPP, interstitials) are completely removed.
 */
const AdLoader: React.FC<AdLoaderProps> = () => {
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Apply strict CSS suppression
    applyAdSuppressionStyle();

    // Immediately sweep and purge any existing ad elements
    removeMonetagAds();

    // Known ad network domain patterns that trigger popunders
    const adDomainPatterns = [
      /quge5\.com/i,
      /5gvci\.com/i,
      /roagrofoogrobo\.com/i,
      /monetag/i,
      /propeller/i,
      /adsterra/i,
      /hilltopads/i,
    ];

    // Intercept window.open popunders globally
    const originalOpen = window.open;
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

    // Global capture-phase click listener to intercept hidden ad links / transparent popunder backdrops
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

    // Active MutationObserver to instantly destroy any delayed or injected ad tags
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

    return () => {
      window.open = originalOpen;
      document.removeEventListener('click', handleCaptureClick, true);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return null;
};

export default AdLoader;
