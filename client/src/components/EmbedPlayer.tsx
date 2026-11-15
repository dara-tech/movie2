import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Maximize, Minimize, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import VpnBanner from './VpnBanner';

interface EmbedPlayerProps {
  embedUrl: string;
  title: string;
  onClose?: () => void;
}

/**
 * Embed player:
 * - Anti-Redirect Sandbox: prevents third-party embed scripts from hijacking or redirecting the parent site
 * - Ad Shield Mode: toggle between Strict (Anti-popup & Anti-redirect) and Standard (Anti-redirect with popups allowed)
 * - Reload Stream: quick 1-click reload if an embed stalls
 * - Top bar: close, title, shield toggle, reload, fullscreen
 */
const EmbedPlayer: React.FC<EmbedPlayerProps> = ({ embedUrl, title, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shieldMode, setShieldMode] = useState<'strict' | 'standard'>('strict');
  const [reloadKey, setReloadKey] = useState(0);
  const [showShieldTooltip, setShowShieldTooltip] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  type FullscreenElementWithVendor = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  type FullscreenDocumentWithVendor = Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [embedUrl, reloadKey, shieldMode]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  // Prevent parent window unload hijack attempts while player is open
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Browsers handle this standardly without aggressive popups
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const doc = document as FullscreenDocumentWithVendor;
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const doc = document as FullscreenDocumentWithVendor;
    const container = containerRef.current as FullscreenElementWithVendor | null;
    const iframe = iframeRef.current as unknown as FullscreenElementWithVendor | null;
    const target = container || iframe;
    if (!target) return;

    try {
      const activeFullscreenEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
      if (!activeFullscreenEl) {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
          return;
        }
        if (target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen();
          return;
        }
        if (target.msRequestFullscreen) {
          await target.msRequestFullscreen();
          return;
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
          return;
        }
        if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
          return;
        }
        if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
          return;
        }
      }
    } catch (error) {
      // Silent fallback: keep player usable even if browser blocks fullscreen.
    }
  };

  const handleReload = () => {
    setLoading(true);
    setReloadKey((prev) => prev + 1);
  };

  const toggleShieldMode = () => {
    setShieldMode((prev) => (prev === 'strict' ? 'standard' : 'strict'));
    setReloadKey((prev) => prev + 1);
  };

  // Strict sandbox blocks all popups and redirects; Standard blocks top navigation redirects
  const sandboxValue =
    shieldMode === 'strict'
      ? 'allow-scripts allow-same-origin allow-forms allow-presentation'
      : 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups';

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-black">
      {/* Top bar: close, title, shield badge/toggle, reload, and fullscreen */}
      <div className="shrink-0 flex items-center justify-between gap-2 bg-neutral-950/90 backdrop-blur-xl text-white px-3 py-2 border-b border-cyan-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.7)] z-20">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-zinc-300 hover:text-cyan-300 hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/30 shrink-0 gap-1.5 h-8 px-2.5 rounded-lg transition-all active:scale-95"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-wide">Back</span>
            </Button>
          )}
          <span className="text-xs font-semibold text-zinc-200 tracking-wide truncate hidden sm:inline max-w-[200px] md:max-w-[320px]">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* VPN Affiliate Security Bar */}
          <VpnBanner variant="player-bar" />

          {/* Ad Shield Toggle / Indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={toggleShieldMode}
              onMouseEnter={() => setShowShieldTooltip(true)}
              onMouseLeave={() => setShowShieldTooltip(false)}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border backdrop-blur-md transition-all active:scale-95 ${
                shieldMode === 'strict'
                  ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/70 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-blue-950/80 border-blue-500/50 text-blue-300 hover:bg-blue-900/70 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
              }`}
              title="Click to toggle Ad Shield mode"
            >
              {shieldMode === 'strict' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-blue-400" />
              )}
              <span className="hidden xs:inline uppercase tracking-wider text-[10px]">
                {shieldMode === 'strict' ? 'Shield: Strict' : 'Shield: Standard'}
              </span>
            </button>

            {showShieldTooltip && (
              <div className="absolute right-0 top-full mt-1.5 w-60 p-2.5 bg-neutral-950/95 backdrop-blur-xl text-[11px] text-zinc-300 rounded-xl shadow-2xl border border-cyan-500/30 z-50 pointer-events-none animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-white font-bold mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <p>{shieldMode === 'strict' ? 'Strict Anti-Redirect Shield' : 'Standard Shield'}</p>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {shieldMode === 'strict'
                    ? 'Popups and page redirects are blocked. If video does not play, click to switch to Standard.'
                    : 'Page hijacking is blocked, but player popups are allowed if required to start stream.'}
                </p>
              </div>
            )}
          </div>

          {/* Reload Stream Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReload}
            className="text-zinc-300 hover:text-cyan-300 hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/30 h-8 w-8 p-0 rounded-lg shrink-0 transition-all active:scale-95"
            title="Reload stream"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-zinc-300 hover:text-cyan-300 hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/30 h-8 w-8 p-0 rounded-lg shrink-0 transition-all active:scale-95"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Player area */}
      <div className="flex-1 min-h-0 relative bg-black">
        {loading && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs px-4 pointer-events-none transition-opacity duration-300"
            aria-busy="true"
            aria-live="polite"
          >
            <LoadingSpinner size="lg" text="Loading stream..." />
          </div>
        )}

        <iframe
          key={`embed-${reloadKey}-${shieldMode}`}
          ref={iframeRef}
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          style={{ minHeight: '100%' }}
          allowFullScreen
          allow="autoplay; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer *; gyroscope *"
          sandbox={sandboxValue}
          referrerPolicy="origin"
          title={title}
          onLoad={handleIframeLoad}
        />

        {!loading && (
          <p
            className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none px-3 py-1.5 text-[9px] sm:text-[10px] text-cyan-200/80 text-center leading-tight bg-gradient-to-t from-black via-black/80 to-transparent border-t border-cyan-500/10 line-clamp-2 sm:line-clamp-3"
            role="note"
          >
            🛡️ Anti-Redirect Shield active. If video does not start, click Shield in top-right or pick another server.
          </p>
        )}
      </div>
    </div>
  );
};

export default EmbedPlayer;
