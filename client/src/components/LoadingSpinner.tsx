import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'default' | 'red' | 'blue' | 'white' | 'cyan' | string;
  text?: string;
  subtext?: string;
  fullScreen?: boolean;
  inline?: boolean;
  className?: string;
}

/**
 * Unique Signature Cinema Aperture Loader
 * A unified, high-end cinema HUD loading component used across the entire platform.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'default',
  text,
  subtext,
  fullScreen = false,
  inline = false,
  className = '',
}) => {
  // Dimensions and sizing classes
  const sizeMap = {
    xs: { wrap: 'w-3.5 h-3.5', svg: 14, strokeWidth: 3.5 },
    sm: { wrap: 'w-5 h-5', svg: 20, strokeWidth: 3 },
    md: { wrap: 'w-9 h-9', svg: 36, strokeWidth: 2.5 },
    lg: { wrap: 'w-14 h-14', svg: 56, strokeWidth: 2.2 },
    xl: { wrap: 'w-20 h-20', svg: 80, strokeWidth: 2 },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const isCompact = size === 'xs' || size === 'sm' || inline;

  // Custom high-contrast color palettes
  const colorMap: Record<string, { primary: string; secondary: string; glow: string }> = {
    cyan: { primary: '#00f2fe', secondary: '#0284c7', glow: 'rgba(0, 242, 254, 0.45)' },
    blue: { primary: '#38bdf8', secondary: '#2563eb', glow: 'rgba(56, 189, 248, 0.45)' },
    red: { primary: '#ef4444', secondary: '#b91c1c', glow: 'rgba(239, 68, 68, 0.45)' },
    white: { primary: '#ffffff', secondary: '#94a3b8', glow: 'rgba(255, 255, 255, 0.35)' },
    default: { primary: '#00f2fe', secondary: '#38bdf8', glow: 'rgba(0, 242, 254, 0.45)' },
  };

  const activeColor = colorMap[color] || colorMap.default;
  const gradId = `unique-loader-grad-${color}-${size}-${inline ? 'in' : 'std'}`;

  // Unique Cinema Aperture SVG Graphic
  const spinnerElement = (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${currentSize.wrap} ${className}`}
      role="status"
      aria-label={text || 'Loading'}
    >
      {/* Ambient optical halo (for md, lg, xl sizes) */}
      {!isCompact && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40 pointer-events-none"
          style={{ background: activeColor.glow }}
        />
      )}

      <svg
        viewBox="0 0 48 48"
        className="w-full h-full relative z-10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={activeColor.primary} stopOpacity="1" />
            <stop offset="60%" stopColor={activeColor.secondary} stopOpacity="0.45" />
            <stop offset="100%" stopColor={activeColor.primary} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer subtle guide track */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={isCompact ? 3 : 2}
        />

        {/* Outer rotating cinematic neon arc */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke={`url(#${gradId})`}
          strokeWidth={currentSize.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={isCompact ? '34 90' : '48 80'}
          className="animate-spin"
          style={{
            transformOrigin: '24px 24px',
            animationDuration: '0.85s',
          }}
        />

        {/* Inner reverse-spinning cinema notches */}
        {!isCompact && (
          <circle
            cx="24"
            cy="24"
            r="13"
            stroke={activeColor.primary}
            strokeWidth="1.5"
            strokeDasharray="4 14"
            strokeOpacity="0.6"
            style={{
              transformOrigin: '24px 24px',
              animation: 'unique-spin-reverse 3s linear infinite',
            }}
          />
        )}

        {/* Center breathing Cinema Play / Aperture glyph */}
        <path
          d="M21 18.5L29 24L21 29.5V18.5Z"
          fill={activeColor.primary}
          style={{
            transformOrigin: '24px 24px',
            animation: 'unique-glow-pulse 1.3s ease-in-out infinite',
          }}
        />

        {/* Viewfinder corner optical marks */}
        {!isCompact && (
          <g stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1">
            <line x1="24" y1="1.5" x2="24" y2="4.5" />
            <line x1="24" y1="43.5" x2="24" y2="46.5" />
            <line x1="1.5" y1="24" x2="4.5" y2="24" />
            <line x1="43.5" y1="24" x2="46.5" y2="24" />
          </g>
        )}
      </svg>
    </div>
  );

  // 1. INLINE MODE (Buttons, inline labels)
  if (inline) {
    return (
      <span className="inline-flex items-center gap-2 align-middle">
        {spinnerElement}
        {text && (
          <span className="text-xs font-semibold text-zinc-300 select-none tracking-wide">
            {text}
          </span>
        )}
      </span>
    );
  }

  // 2. FULLSCREEN MODE (Page transition / Initial App Hydration)
  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-6 select-none"
      >
        {/* Subtle cinematic radial beam */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0, 242, 254, 0.15) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm">
          {spinnerElement}

          {/* Animated laser progress line */}
          <div className="relative w-32 h-[2px] bg-zinc-900 overflow-hidden mt-5 rounded-none">
            <div
              className="absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              style={{
                animation: 'unique-laser-sweep 1.8s ease-in-out infinite',
              }}
            />
          </div>

          {text && (
            <p className="mt-4 text-xs sm:text-sm font-bold text-white uppercase tracking-widest">
              {text}
            </p>
          )}

          {subtext && (
            <p className="mt-1.5 text-[11px] text-zinc-500 font-mono tracking-wider">
              {subtext}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 3. STANDARD COMPONENT / SECTION MODE
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-6 px-4 text-center w-full select-none"
    >
      {spinnerElement}

      {/* Animated laser progress line (for larger component loaders) */}
      {!isCompact && text && (
        <div className="relative w-24 h-[2px] bg-zinc-900 overflow-hidden mt-3 rounded-none">
          <div
            className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
            style={{
              animation: 'unique-laser-sweep 1.8s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {text && (
        <p className="mt-3 text-xs sm:text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          {text}
        </p>
      )}

      {subtext && (
        <p className="mt-1 text-[11px] text-zinc-500 font-mono tracking-wide">
          {subtext}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
