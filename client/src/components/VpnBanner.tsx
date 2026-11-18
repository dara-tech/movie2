import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Shield, ExternalLink, X, Zap, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export interface VpnBannerProps {
  /** Variant style */
  variant?: 'inline' | 'floating' | 'player-bar';
  /** Optional manual affiliate URL override */
  affiliateUrl?: string;
  /** Optional custom title */
  title?: string;
  /** Optional custom subtitle */
  subtitle?: string;
  /** Class name override */
  className?: string;
}

interface SmartLinkData {
  _id: string;
  title: string;
  url: string;
  imageUrl?: string;
  clickCount?: number;
}

export const VpnBanner: React.FC<VpnBannerProps> = ({
  variant = 'inline',
  affiliateUrl: manualUrl,
  title: manualTitle,
  subtitle: manualSubtitle,
  className = ''
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const [closed, setClosed] = useState(false);
  const [smartLink, setSmartLink] = useState<SmartLinkData | null>(null);

  const AUTH_PATHS = ['/signin', '/login', '/register', '/auth', '/forgot-password', '/reset-password'];
  const isAuthPage = AUTH_PATHS.some((path) => location.pathname.toLowerCase().startsWith(path));
  const isHiddenFloating = variant === 'floating' && (Boolean(user) || isAuthPage);

  // Fetch active affiliate link from backend if available
  useEffect(() => {
    if (isHiddenFloating) return;

    let isCancelled = false;

    const fetchAffiliateLink = async () => {
      try {
        const response = await api.get('/api/smartlinks/general');
        const links = response.data?.data || response.data || [];
        if (Array.isArray(links) && links.length > 0 && !isCancelled) {
          setSmartLink(links[0]);
        }
      } catch (err) {
        // Fall back gracefully to default URL
      }
    };

    fetchAffiliateLink();
    return () => {
      isCancelled = true;
    };
  }, [isHiddenFloating]);

  const fallbackUrl =
    process.env.REACT_APP_VPN_AFFILIATE_URL ||
    'https://surfshark.club/c/YOUR_AFFILIATE_ID';

  const targetUrl = manualUrl || smartLink?.url || fallbackUrl;
  const displayTitle = manualTitle || smartLink?.title || 'Fast 4K Stream & IP Protection';
  const displaySubtitle =
    manualSubtitle ||
    'Bypass ISP throttling, conceal your real IP address, and unlock high-speed worldwide streaming servers.';

  const handleLinkClick = () => {
    if (smartLink?._id) {
      api.post(`/api/smartlinks/${smartLink._id}/click`).catch(() => {
        // Silent fail
      });
    }
  };

  if (closed || isHiddenFloating) return null;

  // 1. Sleek Glassmorphic Player Bar (for Player Toolbars & Server Bars)
  if (variant === 'player-bar') {
    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        title="Bypass buffering & protect stream identity with VPN encryption"
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/40 text-neutral-200 transition-all duration-300 shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0 active:scale-[0.98] ${className}`}
      >
        {/* Ambient glow accent on hover */}
        <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600/15 via-transparent to-cyan-500/15 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Live radar status indicator */}
        <div className="relative flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-cyan-400 group-hover:bg-blue-400 transition-colors" />
          <span className="absolute w-3.5 h-3.5 rounded-full bg-cyan-400/40 animate-ping pointer-events-none" />
        </div>

        <Shield className="w-3.5 h-3.5 text-neutral-400 group-hover:text-cyan-400 transition-colors shrink-0" />

        <span className="font-semibold tracking-wide text-neutral-200 group-hover:text-white truncate max-w-[130px] sm:max-w-none">
          {manualTitle || 'Fast Stream Shield'}
        </span>

        {/* Discount badge */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
          82% Off
        </span>

        <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition-colors shrink-0" />
      </a>
    );
  }

  // 2. Luxury Floating Glass Dock (Bottom-right Corner)
  if (variant === 'floating') {
    return (
      <div
        className={`fixed bottom-5 right-5 z-50 max-w-[360px] w-full p-3.5 rounded-2xl backdrop-blur-xl bg-neutral-950/85 border border-blue-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(6,182,212,0.15)] flex items-center justify-between gap-3 text-sm animate-in fade-in slide-in-from-bottom-4 duration-500 group ${className}`}
      >
        {/* Subtle interior radial glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 min-w-0 z-10">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/25 via-neutral-900 to-neutral-900 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-white text-xs font-bold truncate">Stream Anonymously</p>
              <span className="text-[9px] font-mono font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1 py-0.2 rounded">
                SECURE
              </span>
            </div>
            <p className="text-neutral-400 text-[11px] truncate mt-0.5">
              Unblock fast 4K servers & stop throttling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 z-10">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-500 hover:via-sky-500 hover:to-cyan-400 shadow-md shadow-blue-950/80 hover:shadow-cyan-500/30 transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
          >
            <span>Get VPN</span>
            <ExternalLink className="w-3 h-3 text-cyan-100" />
          </a>

          <button
            type="button"
            onClick={() => setClosed(true)}
            className="w-7 h-7 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/10 flex items-center justify-center transition"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Premium Glassmorphic Inline Banner (for Catalog & Detail Sections)
  return (
    <div
      className={`relative overflow-hidden w-full rounded-2xl backdrop-blur-xl bg-gradient-to-r from-neutral-950/90 via-neutral-900/80 to-neutral-950/90 border border-white/10 hover:border-cyan-500/40 p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 shadow-xl hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] group ${className}`}
    >
      {/* Background ambient light effects */}
      <div className="absolute top-0 right-1/4 w-72 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-500" />
      <div className="absolute bottom-0 left-10 w-48 h-24 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />

      {/* Left side content */}
      <div className="flex items-center gap-4 w-full md:w-auto relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/25 via-neutral-900 to-black border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-blue-950/40">
          <Shield className="w-6 h-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-white text-sm sm:text-base font-bold tracking-tight">
              {displayTitle}
            </h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider shadow-[0_0_10px_rgba(6,182,212,0.15)]">
              <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
              Verified Fast CDN
            </span>
          </div>

          <p className="text-neutral-400 text-xs mt-1 max-w-xl leading-relaxed">
            {displaySubtitle}
          </p>

          <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400 flex-wrap">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              Zero ISP Logs
            </span>
            <span className="text-neutral-700">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              Ultra-Fast 4K Buffering
            </span>
            <span className="text-neutral-700">•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              30-Day Money-Back
            </span>
          </div>
        </div>
      </div>

      {/* Right side CTA */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0 relative z-10">
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-500 hover:via-sky-500 hover:to-cyan-400 shadow-lg shadow-blue-950/60 hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
        >
          <Zap className="w-4 h-4 text-cyan-200 fill-cyan-200" />
          <span>Unlock Fast VPN (82% Off)</span>
          <ExternalLink className="w-3.5 h-3.5 text-cyan-100" />
        </a>
      </div>
    </div>
  );
};

export default VpnBanner;
