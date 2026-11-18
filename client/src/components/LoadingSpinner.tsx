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
 * Netflix-Style Signature Loading Spinner
 * Clean, fluid, minimal streaming buffering spinner.
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
  // Sizing map (clean ratios from button-inline to fullscreen buffer)
  const sizeMap = {
    xs: { wrap: 'w-4 h-4', stroke: 5 },
    sm: { wrap: 'w-5 h-5', stroke: 4.5 },
    md: { wrap: 'w-9 h-9', stroke: 4 },
    lg: { wrap: 'w-14 h-14', stroke: 3.8 },
    xl: { wrap: 'w-18 h-18', stroke: 3.5 },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Colors: Default is authentic Netflix Red (#E50914)
  const colorMap: Record<string, string> = {
    default: '#E50914',
    red: '#E50914',
    white: '#FFFFFF',
    cyan: '#00F2FE',
    blue: '#38BDF8',
  };

  const strokeColor = colorMap[color] || color || '#E50914';

  // The Iconic Netflix Spinner (SVG track + fluid expanding/contracting arc)
  const spinnerElement = (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${currentSize.wrap} ${className}`}
      role="status"
      aria-label={text || 'Loading'}
    >
      <svg
        viewBox="0 0 50 50"
        className="netflix-spinner-svg w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle background track */}
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={strokeColor}
          strokeWidth={currentSize.stroke}
          opacity="0.18"
        />

        {/* Fluid animated Netflix buffer arc */}
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={strokeColor}
          strokeWidth={currentSize.stroke}
          strokeLinecap="round"
          className="netflix-spinner-arc"
        />
      </svg>
    </div>
  );

  // 1. INLINE MODE (Inside buttons or inline status)
  if (inline) {
    return (
      <span className="inline-flex items-center gap-2 align-middle">
        {spinnerElement}
        {text && (
          <span className="text-xs font-medium text-zinc-300 select-none">
            {text}
          </span>
        )}
      </span>
    );
  }

  // 2. FULLSCREEN MODE (Page route fallback & initial load)
  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4 select-none"
      >
        <div className="flex flex-col items-center justify-center text-center">
          {spinnerElement}
          {text && (
            <p className="mt-4 text-sm font-medium text-zinc-400 tracking-wide">
              {text}
            </p>
          )}
          {subtext && (
            <p className="mt-1 text-xs text-zinc-600 font-mono">
              {subtext}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 3. COMPONENT / SECTION LEVEL MODE
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-6 px-4 text-center w-full select-none"
    >
      {spinnerElement}
      {text && (
        <p className="mt-3 text-sm font-medium text-zinc-400 tracking-wide">
          {text}
        </p>
      )}
      {subtext && (
        <p className="mt-1 text-xs text-zinc-600 font-mono">
          {subtext}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
