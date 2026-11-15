import React from 'react';
import { Button } from './ui/button';

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface StreamingProviderFilterProps {
  providers: WatchProvider[];
  selectedProvider: number | null;
  onProviderToggle: (providerId: number | null) => void;
  className?: string;
}

const StreamingProviderFilter: React.FC<StreamingProviderFilterProps> = ({
  providers,
  selectedProvider,
  onProviderToggle,
  className = ""
}) => {
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {/* All/None option */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onProviderToggle(null)}
          className={`
            transition-all duration-300 text-sm p-5 rounded-full
            backdrop-blur-md border
            ${!selectedProvider
              ? "bg-white/20 text-white border-white/40 hover:bg-white/30 font-semibold shadow-lg shadow-white/10"
              : "bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:border-white/30 hover:text-white"
            }
          `}
          title="All Services"
        >
          All
        </Button>
      
      {/* Provider buttons */}
      {providers.map((provider) => {
        const isSelected = selectedProvider === provider.provider_id;
        return (
          <Button
            key={provider.provider_id}
            variant="outline"
            size="sm"
            onClick={() => onProviderToggle(isSelected ? null : provider.provider_id)}
            className={`
              transition-all duration-300 text-sm p-0 rounded-full flex items-center justify-center
              w-11 h-11 backdrop-blur-md border
              ${isSelected
                ? "bg-white/20 text-white border-white/40 hover:bg-white/30 font-semibold shadow-lg shadow-white/10"
                : "bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:border-white/30 hover:text-white"
              }
            `}
            title={provider.provider_name}
          >
            {provider.logo_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                alt={provider.provider_name}
                className="w-7 h-7 object-contain rounded-full"
                title={provider.provider_name}
                onError={(e) => {
                  // Hide button if logo fails to load
                  (e.target as HTMLImageElement).parentElement?.parentElement?.classList.add('hidden');
                }}
              />
            ) : (
              <span className="text-xs font-medium">{provider.provider_name.substring(0, 2).toUpperCase()}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
};

export default StreamingProviderFilter;

