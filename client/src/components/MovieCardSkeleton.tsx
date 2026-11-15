import React from 'react';

const MovieCardSkeleton: React.FC = () => (
  <div className="group relative w-full transition-all duration-300 ease-out animate-pulse">
    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-xl border border-gray-800/50">
      {/* Poster shimmer */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>

      {/* Year badge placeholder */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
        <div className="h-5 w-12 sm:h-6 sm:w-16 bg-white/20 rounded-full backdrop-blur-sm border border-white/20" />
      </div>

      {/* Heart placeholder */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-800/70 rounded-full border border-gray-700/60" />
      </div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
    </div>
  </div>
);

export default MovieCardSkeleton;

