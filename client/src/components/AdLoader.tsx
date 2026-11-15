import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AdLoaderProps {
  /** Optional zone ID override for Monetag MultiTag */
  zoneId?: string;
  /** Optional script URL override */
  scriptUrl?: string;
  /** Disable ads explicitly */
  disabled?: boolean;
}

const AdLoader: React.FC<AdLoaderProps> = ({ zoneId, scriptUrl, disabled = false }) => {
  const { user } = useAuth();

  useEffect(() => {
    // 1. Clean up and return if disabled or user is an admin
    if (disabled || user?.role === 'admin' || user?.role === 'super_admin') {
      const existingScript = document.getElementById('monetag-ad-script');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
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
      const scriptToRemove = document.getElementById('monetag-ad-script');
      if (scriptToRemove && scriptToRemove.parentNode) {
        scriptToRemove.parentNode.removeChild(scriptToRemove);
      }
    };
  }, [user, zoneId, scriptUrl, disabled]);

  return null;
};

export default AdLoader;
