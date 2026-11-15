import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'default' | 'red' | 'blue' | 'white' | 'cyan' | string;
  text?: string;
  subtext?: string;
  fullScreen?: boolean;
  inline?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'default',
  text,
  subtext,
  fullScreen = false,
  inline = false,
  className = '',
}) => {
  // Simple, clean ring sizes
  const sizeClasses = {
    sm: 'w-4 h-4 border-[2px]',
    md: 'w-7 h-7 border-[2.5px]',
    lg: 'w-10 h-10 border-[3px]',
    xl: 'w-12 h-12 border-[3.5px]',
  }[size] || 'w-7 h-7 border-[2.5px]';

  // Minimal clean spinner ring with subtle cyan accent on dark track
  const spinnerElement = (
    <div
      className={`rounded-full border-zinc-800 border-t-cyan-400 animate-spin shrink-0 ${sizeClasses} ${className}`}
      role="status"
      aria-label={text || 'Loading'}
    />
  );

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        {spinnerElement}
        {text && (
          <span className="text-xs font-medium text-zinc-400 select-none">
            {text}
          </span>
        )}
      </span>
    );
  }

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4"
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

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-6 px-4 text-center w-full"
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
