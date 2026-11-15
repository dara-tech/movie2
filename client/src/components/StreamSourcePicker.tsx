import React from 'react';
import { CheckCircle, Tv } from 'lucide-react';
import { StreamingOption } from '../services/streamingService';
import { cn } from '../lib/utils';

interface StreamSourcePickerProps {
  options: StreamingOption[];
  selectedId?: string | null;
  onSelect: (option: StreamingOption) => void;
  className?: string;
  subtitle?: string;
}

/**
 * Compact, consistent "Streaming Servers" source grid (movie + TV detail pages).
 */
const StreamSourcePicker: React.FC<StreamSourcePickerProps> = ({
  options,
  selectedId,
  onSelect,
  className,
  subtitle = 'High Speed HD Streams',
}) => {
  if (options.length === 0) return null;

  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
          <Tv className="w-4 h-4 text-indigo-400" />
          <span>Available Servers</span>
        </h3>
        <span className="text-[10px] text-zinc-400">{subtitle}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {options.map((option, idx) => {
          const isSelected = selectedId === option.id;
          const streamNumber = idx + 1;
          const isDefaultStream = idx === 0;
          const quality = option.name.includes('4K') ? '4K' : '1080p';

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                'relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 min-h-[46px] text-left transition-all',
                isSelected
                  ? 'border-indigo-500 bg-indigo-600/90 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/50'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-indigo-500/50 hover:bg-white/[0.08]'
              )}
            >
              <span
                className={cn(
                  'flex h-7 px-1.5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold',
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700/80'
                )}
              >
                {quality}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold leading-tight">
                  Stream {streamNumber}
                </span>
                {isDefaultStream && !isSelected && (
                  <span className="block text-[10px] leading-tight text-indigo-400 font-semibold">
                    Default
                  </span>
                )}
                {isSelected && (
                  <span className="block text-[10px] leading-tight text-indigo-100 font-medium">
                    Active
                  </span>
                )}
              </span>
              {isSelected && <CheckCircle className="h-4 w-4 shrink-0 text-white" aria-hidden />}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default StreamSourcePicker;
