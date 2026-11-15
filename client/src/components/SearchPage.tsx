import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, X, Film, Tv, Image, Globe } from 'lucide-react';
import MovieCard from './MovieCard';
import TvShowCard from './TvShowCard';
import MovieCardSkeleton from './MovieCardSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Input } from './ui/input';
import StreamingProviderFilter from './StreamingProviderFilter';
import { trackEvent } from '../utils/activityTracker';
import { moviePath, tvShowPath } from '../utils/paths';
import MoviePlayModal from './MoviePlayModal';
import TvShowPlayModal from './TvShowPlayModal';
import LoadingSpinner from './LoadingSpinner';

interface Movie {
  _id: string;
  title: string;
  posterPath?: string;
  releaseDate: string;
  voteAverage: number;
  genres: Array<{ _id?: string; name: string }>;
  runtime?: number;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
}

interface TvShow {
  _id: string;
  name: string;
  posterPath?: string;
  firstAirDate: string;
  voteAverage: number;
  genres: Array<{ _id?: string; name: string }>;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
}

interface Suggestion {
  type: 'movie' | 'tvshow' | 'genre';
  text: string;
  value: string;
  posterPath?: string;
}

const SuggestionItem: React.FC<{
  suggestion: Suggestion;
  onClick: (suggestion: Suggestion) => void;
}> = ({ suggestion, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isMediaType = suggestion.type === 'movie' || suggestion.type === 'tvshow';
  
  // Check if we have a valid poster path
  const hasPosterPath = !!(suggestion.posterPath);
  
  // Always try to show poster if it's a media type and we have a posterPath
  const shouldShowPoster = isMediaType && hasPosterPath && !imageError;

  return (
    <button
      onClick={() => onClick(suggestion)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg"
    >
      {shouldShowPoster ? (
        <div className="relative w-12 h-16 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gray-700 animate-pulse" />
          )}
          {!imageError && (
            <img
              src={`https://image.tmdb.org/t/p/w92${suggestion.posterPath}`}
              alt={suggestion.text}
              className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
              onLoad={() => {
                setImageLoaded(true);
              }}
              onError={() => {
                setImageError(true);
                setImageLoaded(false);
              }}
            />
          )}
          {imageError && (
            <>
              {suggestion.type === 'movie' && <Film className="h-5 w-5 text-blue-400 absolute inset-0 m-auto" />}
              {suggestion.type === 'tvshow' && <Tv className="h-5 w-5 text-purple-400 absolute inset-0 m-auto" />}
            </>
          )}
        </div>
      ) : (
        <>
          {suggestion.type === 'movie' && <Film className="h-5 w-5 text-blue-400 flex-shrink-0" />}
          {suggestion.type === 'tvshow' && <Tv className="h-5 w-5 text-purple-400 flex-shrink-0" />}
          {suggestion.type === 'genre' && <div className="h-5 w-5 rounded-full bg-red-500 flex-shrink-0" />}
        </>
      )}
      <span className="text-white text-sm font-medium flex-1 text-left">{suggestion.text}</span>
      {/* Badge icon on the right */}
      {suggestion.type === 'movie' && (
        <div className="rounded-full p-1.5 bg-blue-500 shadow-lg flex-shrink-0 ml-auto">
          <Film className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      {suggestion.type === 'tvshow' && (
        <div className="rounded-full p-1.5 bg-purple-500 shadow-lg flex-shrink-0 ml-auto">
          <Tv className="h-3.5 w-3.5 text-white" />
        </div>
      )}
    </button>
  );
};

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const COUNTRY_LABELS: Record<string, string> = {
    US: 'United States',
    JP: 'Japan',
    KR: 'South Korea',
    CN: 'China',
    IN: 'India',
    GB: 'United Kingdom',
    CA: 'Canada',
    DE: 'Germany',
    FR: 'France',
    AU: 'Australia'
  };
  const TOP_COUNTRY_FILTERS = [
    { code: 'US', label: 'United States' },
    { code: 'JP', label: 'Japan' },
    { code: 'KR', label: 'South Korea' },
    { code: 'CN', label: 'China' },
    { code: 'IN', label: 'India' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'CA', label: 'Canada' },
    { code: 'DE', label: 'Germany' },
    { code: 'FR', label: 'France' },
    { code: 'AU', label: 'Australia' }
  ];

  const [movies, setMovies] = useState<Movie[]>([]);
  const [tvShows, setTvShows] = useState<TvShow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [movieCurrentPage, setMovieCurrentPage] = useState(1);
  const [tvShowCurrentPage, setTvShowCurrentPage] = useState(1);
  const [movieTotalPages, setMovieTotalPages] = useState(1);
  const [tvShowTotalPages, setTvShowTotalPages] = useState(1);
  const [showImages, setShowImages] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [providers, setProviders] = useState<Array<{provider_id: number; provider_name: string; logo_path: string}>>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(searchParams.get('country'));
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'movie' | 'tv'>(
    searchParams.get('type') === 'movie' || searchParams.get('type') === 'tv'
      ? (searchParams.get('type') as 'movie' | 'tv')
      : 'all'
  );
  const [watchProviderRegion, setWatchProviderRegion] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return 'US';
    }
    return localStorage.getItem('watch_region') || 'US';
  });
  
  const [selectedMovieToPlay, setSelectedMovieToPlay] = useState<Movie | null>(null);
  const [selectedTvShowToPlay, setSelectedTvShowToPlay] = useState<TvShow | null>(null);

  // Refs for infinite scroll
  const isLoadingMoreRef = useRef(false);
  const lastScrollTime = useRef<{ movies: number; tvShows: number }>({ movies: 0, tvShows: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleRegionChange = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        setWatchProviderRegion(customEvent.detail);
        setSelectedProvider(null);
      }
    };
    window.addEventListener('watchRegionChange', handleRegionChange);
    return () => window.removeEventListener('watchRegionChange', handleRegionChange);
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string, page: number = 1, append: boolean = false) => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery && !selectedProvider && !selectedCountry) {
        setMovies([]);
        setTvShows([]);
        setTotalResults(0);
        return;
      }

      const isLoading = append ? setLoadingMore : setLoading;
      isLoading(true);
      try {
        if (trimmedQuery) {
          const params = new URLSearchParams({ 
            q: trimmedQuery,
            page: page.toString(),
            limit: '20'
          });
          if (selectedProvider) {
            params.append('provider', selectedProvider.toString());
          }
          const response = await api.get(`/api/search?${params}`);
          const responseData = response.data;
          
          if (append) {
            setMovies(prev => [...prev, ...(responseData.movies || [])]);
            setTvShows(prev => [...prev, ...(responseData.tvShows || [])]);
            setMovieCurrentPage(page);
            setTvShowCurrentPage(page);
          } else {
            setMovies(responseData.movies || []);
            setTvShows(responseData.tvShows || []);
            setMovieCurrentPage(1);
            setTvShowCurrentPage(1);
          }
          
          const totalItems = responseData.total || 0;
          const combinedTotalPages = responseData.totalPages || 1;
          
          setTotalResults(totalItems);
          setMovieTotalPages(combinedTotalPages);
          setTvShowTotalPages(combinedTotalPages);

          const queryPayload: Record<string, any> = {
            q: trimmedQuery,
            page
          };
          if (selectedProvider) {
            queryPayload.provider = selectedProvider;
          }

          trackEvent({
            eventType: 'search',
            path: '/search',
            query: queryPayload,
            searchTerm: trimmedQuery,
            metadata: {
              totalResults: totalItems,
              moviesReturned: responseData.movies?.length || 0,
              tvShowsReturned: responseData.tvShows?.length || 0,
              append
            }
          });
        } else if (selectedProvider) {
          const [moviesResponse, tvShowsResponse] = await Promise.all([
            api
              .get('/api/movies', { params: { provider: selectedProvider, page, limit: 20 } })
              .catch(() => ({ data: { movies: [], total: 0, totalPages: 1 } })),
            api
              .get('/api/tvshows', { params: { provider: selectedProvider, page, limit: 20 } })
              .catch(() => ({ data: { tvShows: [], total: 0, totalPages: 1 } }))
          ]);
          
          const movies = moviesResponse.data.movies || [];
          const tvShows = tvShowsResponse.data.tvShows || [];
          const moviesTotal = moviesResponse.data.total || 0;
          const tvShowsTotal = tvShowsResponse.data.total || 0;
          const moviePages = moviesResponse.data.totalPages || 1;
          const tvShowPages = tvShowsResponse.data.totalPages || 1;
          
          if (append) {
            setMovies(prev => [...prev, ...movies]);
            setTvShows(prev => [...prev, ...tvShows]);
            setMovieCurrentPage(page);
            setTvShowCurrentPage(page);
          } else {
            setMovies(movies);
            setTvShows(tvShows);
            setMovieCurrentPage(1);
            setTvShowCurrentPage(1);
          }
          setTotalResults(moviesTotal + tvShowsTotal);
          setMovieTotalPages(moviePages);
          setTvShowTotalPages(tvShowPages);

          trackEvent({
            eventType: 'filter',
            path: '/search',
            query: {
              provider: selectedProvider,
              page
            },
            metadata: {
              totalResults: moviesTotal + tvShowsTotal,
              moviesReturned: movies.length,
              tvShowsReturned: tvShows.length,
              append
            }
          });
        } else if (selectedCountry) {
          const movieRequest =
            selectedMediaType === 'tv'
              ? Promise.resolve({ data: { movies: [], total: 0, totalPages: 1 } })
              : api
                  .get('/api/movies', {
                    params: { country: selectedCountry, limit: 20, page }
                  })
                  .catch(() => ({ data: { movies: [], total: 0, totalPages: 1 } }));

          const tvRequest =
            selectedMediaType === 'movie'
              ? Promise.resolve({ data: { tvShows: [], total: 0, totalPages: 1, hasMore: false } })
              : api
                  .get('/api/tvshows', {
                    params: { country: selectedCountry, limit: 20, page }
                  })
                  .catch(() => ({ data: { tvShows: [], total: 0, totalPages: 1, hasMore: false } }));

          const [moviesResponse, tvShowsResponse] = await Promise.all([movieRequest, tvRequest]);
          
          const movies = moviesResponse.data.movies || [];
          const tvShows = tvShowsResponse.data.tvShows || [];
          const moviesTotal = moviesResponse.data.total || moviesResponse.data.totalResults || movies.length;
          const tvShowsTotal =
            tvShowsResponse.data.total ||
            tvShowsResponse.data.totalResults ||
            tvShowsResponse.data.total_results ||
            tvShows.length;
          const moviePages = moviesResponse.data.totalPages || moviesResponse.data.total_pages || 1;
          const tvShowPages = tvShowsResponse.data.totalPages || tvShowsResponse.data.total_pages || 1;

          if (append) {
            if (selectedMediaType !== 'tv') {
              setMovies(prev => [...prev, ...movies]);
              setMovieCurrentPage(page);
            }
            if (selectedMediaType !== 'movie') {
              setTvShows(prev => [...prev, ...tvShows]);
              setTvShowCurrentPage(page);
            }
          } else {
            if (selectedMediaType !== 'tv') {
              setMovies(movies);
              setMovieCurrentPage(1);
            } else {
              setMovies([]);
            }
            if (selectedMediaType !== 'movie') {
              setTvShows(tvShows);
              setTvShowCurrentPage(1);
            } else {
              setTvShows([]);
            }
          }

          const combinedTotal = selectedMediaType === 'movie'
            ? moviesTotal
            : selectedMediaType === 'tv'
            ? tvShowsTotal
            : moviesTotal + tvShowsTotal;

          setTotalResults(combinedTotal);
          setMovieTotalPages(moviePages);
          setTvShowTotalPages(tvShowPages);

          trackEvent({
            eventType: 'filter',
            path: '/search',
            query: {
              country: selectedCountry,
              type: selectedMediaType,
              page
            },
            metadata: {
              totalResults: combinedTotal,
              moviesReturned: movies.length,
              tvShowsReturned: tvShows.length,
              append,
              mediaType: selectedMediaType
            }
          });
        }
      } catch (error) {
        showToast('Failed to search. Please try again.', 'error');
      } finally {
        isLoading(false);
        isLoadingMoreRef.current = false;
      }
    },
    [selectedProvider, selectedCountry, selectedMediaType, showToast]
  );

  // Fetch watch providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const region = watchProviderRegion;
        const [moviesResponse, tvShowsResponse] = await Promise.all([
          api.get('/api/movies/watch-providers', { params: { region } }).catch(() => ({ data: { providers: [] } })),
          api.get('/api/tvshows/watch-providers', { params: { region } }).catch(() => ({ data: { providers: [] } }))
        ]);
        
        // Combine providers from both sources, deduplicate by provider_id
        const moviesProviders = moviesResponse.data.providers || [];
        const tvShowsProviders = tvShowsResponse.data.providers || [];
        const combined = [...moviesProviders];
        
        tvShowsProviders.forEach((tvProvider: typeof tvShowsProviders[0]) => {
          if (!combined.find(p => p.provider_id === tvProvider.provider_id)) {
            combined.push(tvProvider);
          }
        });
        
        setProviders(combined);
      } catch (error) {
      }
    };
    fetchProviders();
  }, [watchProviderRegion]);

  useEffect(() => {
    const countryParam = searchParams.get('country');
    setSelectedCountry(countryParam);
    const typeParam = searchParams.get('type');
    if (typeParam === 'movie' || typeParam === 'tv') {
      setSelectedMediaType(typeParam);
    } else {
      setSelectedMediaType('all');
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedCountry && selectedProvider !== null) {
      setSelectedProvider(null);
    }
  }, [selectedCountry, selectedProvider]);

  useEffect(() => {
    setMovieCurrentPage(1);
    setTvShowCurrentPage(1);
    performSearch(query.trim(), 1, false);
  }, [searchParams, performSearch, query, selectedProvider, selectedCountry, selectedMediaType]);

  const showMovieResults = selectedMediaType !== 'tv' && movies.length > 0;
  const showTvResults = selectedMediaType !== 'movie' && tvShows.length > 0;
  const showEmptyState = !loading && !showMovieResults && !showTvResults;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const params = new URLSearchParams();
      params.set('q', query.trim());
      setSearchParams(params);
      setSelectedCountry(null);
      setSelectedMediaType('all');
      performSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  const handleInputChange = async (value: string) => {
    setQuery(value);
    
    if (value.length >= 2) {
      try {
        const response = await api.get(`/api/search/suggestions?q=${encodeURIComponent(value)}`);
        const suggestionsData = response.data.suggestions || [];
        setSuggestions(suggestionsData);
        setShowSuggestions(true);
      } catch (error) {
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setQuery(suggestion.value);
    setSearchParams({ q: suggestion.value });
    setSelectedCountry(null);
    setSelectedMediaType('all');
    performSearch(suggestion.value);
    setShowSuggestions(false);
  };

  const handleClearCountry = () => {
    setSelectedCountry(null);
    setSelectedMediaType('all');
    const params = new URLSearchParams(searchParams);
    params.delete('country');
    params.delete('type');
    setSearchParams(params);
  };

  const handleCountrySelect = (countryCode: string) => {
    if (countryCode === selectedCountry) {
      handleClearCountry();
      return;
    }

    setSelectedCountry(countryCode);
    setQuery('');
    setSelectedProvider(null);

    const params = new URLSearchParams(searchParams);
    params.delete('q');
    params.set('country', countryCode);
    if (selectedMediaType !== 'all') {
      params.set('type', selectedMediaType);
    } else {
      params.delete('type');
    }
    setSearchParams(params);
  };

  const handleMediaTypeChange = (type: 'all' | 'movie' | 'tv') => {
    if (type === selectedMediaType) return;
    setSelectedMediaType(type);

    if (selectedCountry) {
      const params = new URLSearchParams(searchParams);
      params.set('country', selectedCountry);
      if (type === 'all') {
        params.delete('type');
      } else {
        params.set('type', type);
      }
      setSearchParams(params);
    }
  };

  const handleProviderToggle = (providerId: number | null) => {
    if (providerId === null) {
      setSelectedProvider(null);
      return;
    }

    setSelectedProvider((prev) => (prev === providerId ? null : providerId));

    if (providerId !== null && selectedCountry) {
      setSelectedCountry(null);
      const params = new URLSearchParams(searchParams);
      params.delete('country');
      params.delete('type');
      setSearchParams(params);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setMovies([]);
    setTvShows([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedProvider(null);
    setSelectedCountry(null);
    setSelectedMediaType('all');
    setSearchParams({});
  };

  const handlePlayMovie = (movie: Movie) => {
    trackEvent({
      eventType: 'movie_play',
      path: '/search',
      contentType: 'movie',
      contentId: movie._id,
      metadata: {
        title: movie.title,
        source: 'search_results'
      }
    });
    navigate(moviePath(movie));
  };

  const handlePlayTvShow = (tvShow: TvShow) => {
    trackEvent({
      eventType: 'tv_play',
      path: '/search',
      contentType: 'tvshow',
      contentId: tvShow._id,
      metadata: {
        title: tvShow.name,
        source: 'search_results'
      }
    });
    navigate(tvShowPath(tvShow as any));
  };

  const handleAddToWatchlist = async (item: Movie | TvShow, type: 'movie' | 'tvshow') => {
    if (!user) {
      showToast('Please log in to add to watchlist', 'error');
      return;
    }

    try {
      const endpoint = type === 'movie' 
        ? `/api/movies/${item._id}/watchlist`
        : `/api/tvshows/${item._id}/watchlist`;
      
      await api.post(endpoint);
      const title = type === 'movie' ? (item as Movie).title : (item as TvShow).name;
      showToast(`"${title}" added to watchlist!`, 'success');
      trackEvent({
        eventType: 'watchlist_add',
        path: '/search',
        contentType: type,
        contentId: item._id,
        metadata: {
          title,
          source: 'search_page'
        }
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        showToast('Please log in to add to watchlist', 'error');
      } else if (error.response?.status === 400) {
        showToast('Already in your watchlist!', 'error');
      } else {
        showToast('Failed to add to watchlist. Please try again.', 'error');
      }
    }
  };



  const handleLoadMoreMovies = useCallback(() => {
    if (!loadingMore && !loading && !isLoadingMoreRef.current && movieCurrentPage < movieTotalPages && showMovieResults) {
      isLoadingMoreRef.current = true;
      const nextPage = movieCurrentPage + 1;
      performSearch(query.trim(), nextPage, true);
    }
  }, [loadingMore, loading, movieCurrentPage, movieTotalPages, showMovieResults, query, performSearch]);

  const handleLoadMoreTvShows = useCallback(() => {
    // If we have a query, movies and TV shows share pagination, so only load if movies haven't already triggered
    if (query.trim() && showMovieResults) {
      // For query searches, movies and TV shows are loaded together, so use movie pagination
      if (!loadingMore && !loading && !isLoadingMoreRef.current && movieCurrentPage < movieTotalPages) {
        isLoadingMoreRef.current = true;
        const nextPage = movieCurrentPage + 1;
        performSearch(query.trim(), nextPage, true);
      }
    } else {
      // For provider/country filters, load TV shows independently
      if (!loadingMore && !loading && !isLoadingMoreRef.current && tvShowCurrentPage < tvShowTotalPages && showTvResults) {
        isLoadingMoreRef.current = true;
        const nextPage = tvShowCurrentPage + 1;
        performSearch(query.trim(), nextPage, true);
      }
    }
  }, [loadingMore, loading, movieCurrentPage, movieTotalPages, tvShowCurrentPage, tvShowTotalPages, showMovieResults, showTvResults, query, performSearch]);

  // Horizontal scroll handler for movies
  const handleMoviesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    
    // Calculate scroll percentage
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
    const isNearEnd = scrollPercentage >= 0.8; // Trigger at 80% scroll
    
    // Throttle scroll events (only allow one per 500ms)
    const now = Date.now();
    const lastTime = lastScrollTime.current.movies || 0;
    if (now - lastTime < 500) {
      return;
    }
    lastScrollTime.current.movies = now;
    
    // Check if we're already loading or if there are no more pages
    if (loadingMore || loading || isLoadingMoreRef.current || movieCurrentPage >= movieTotalPages) {
      return;
    }
    
    // Check if user has scrolled near the end
    if (isNearEnd) {
      const hasMoreMovies = movies.length < totalResults;
      const hasReasonableAmount = movies.length >= 20;
      
      if (hasMoreMovies && hasReasonableAmount) {
        handleLoadMoreMovies();
      }
    }
  };

  // Horizontal scroll handler for TV shows
  const handleTvShowsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    
    // Calculate scroll percentage
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
    const isNearEnd = scrollPercentage >= 0.8; // Trigger at 80% scroll
    
    // Throttle scroll events (only allow one per 500ms)
    const now = Date.now();
    const lastTime = lastScrollTime.current.tvShows || 0;
    if (now - lastTime < 500) {
      return;
    }
    lastScrollTime.current.tvShows = now;
    
    // Check if we're already loading
    if (loadingMore || loading || isLoadingMoreRef.current) {
      return;
    }
    
    // Check pagination based on mode
    const hasMorePages = query.trim() && showMovieResults
      ? movieCurrentPage < movieTotalPages
      : tvShowCurrentPage < tvShowTotalPages;
    
    if (!hasMorePages) {
      return;
    }
    
    // Check if user has scrolled near the end
    if (isNearEnd) {
      const hasMoreContent = query.trim() && showMovieResults
        ? (movies.length + tvShows.length) < totalResults
        : tvShows.length < totalResults;
      const hasReasonableAmount = query.trim() && showMovieResults
        ? (movies.length + tvShows.length) >= 20
        : tvShows.length >= 20;
      
      if (hasMoreContent && hasReasonableAmount) {
        handleLoadMoreTvShows();
      }
    }
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 overflow-x-hidden">
      <div className="p-6 overflow-visible">
        {/* Search Input */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400 group-focus-within:text-red-500 transition-colors duration-200" />
              <Input
                type="text"
                placeholder="Search for movies, TV shows, and more..."
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                className="w-full pl-14 pr-14 h-14 bg-black/50 border border-gray-600 text-white placeholder-gray-400  focus:bg-black/70 transition-all duration-200 text-lg rounded-none"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Clear search"
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-700/50 rounded-full transition-all duration-200"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 rounded-lg border border-gray-700 shadow-xl max-h-96 overflow-y-auto z-50">
                {suggestions.map((suggestion, index) => (
                  <SuggestionItem
                    key={index}
                    suggestion={suggestion}
                    onClick={handleSuggestionClick}
                  />
                ))}
              </div>
            )}
          </form>

          {/* Advanced Filters Section - Under Search Bar */}
          <div className="mt-6 space-y-4">
            {/* Streaming Provider Filter */}
            {providers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Tv className="h-4 w-4" />
                  <span className="uppercase tracking-wider">Streaming Service</span>
                  {selectedProvider && (
                    <button
                      onClick={() => handleProviderToggle(null)}
                      className="ml-auto text-xs text-red-500 hover:text-red-400 uppercase tracking-wider"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <div className="bg-gray-900/50 border border-gray-800/50 p-4">
                  <StreamingProviderFilter
                    providers={providers}
                    selectedProvider={selectedProvider}
                    onProviderToggle={handleProviderToggle}
                    className=""
                  />
                </div>
                {selectedProvider && (
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>Filtering by:</span>
                    <span className="text-white font-semibold">
                      {providers.find(p => p.provider_id === selectedProvider)?.provider_name || 'Selected service'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Country of Origin Filter */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Globe className="h-4 w-4" />
                <span className="uppercase tracking-wider">Country of Origin</span>
                {selectedCountry && (
                  <button
                    onClick={handleClearCountry}
                    className="ml-auto text-xs text-red-500 hover:text-red-400 uppercase tracking-wider"
                  >
                    Clear Country
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {TOP_COUNTRY_FILTERS.map((country) => {
                  const isActive = selectedCountry === country.code;
                  return (
                    <button
                      key={country.code}
                      onClick={() => handleCountrySelect(country.code)}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border rounded-none transition-all ${
                        isActive
                          ? 'bg-red-600 text-white border-red-500'
                          : 'text-gray-400 border-white/10 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {country.label}
                    </button>
                  );
                })}
              </div>
              {selectedCountry && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {(['all', 'movie', 'tv'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleMediaTypeChange(type)}
                      className={`px-3 py-1 border rounded-none uppercase tracking-[0.3em] ${
                        selectedMediaType === type
                          ? 'bg-white text-black border-white'
                          : 'text-gray-400 border-white/20 hover:text-white'
                      }`}
                    >
                      {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCountry && (
              <div className="flex items-center gap-3 bg-gray-900/60 border border-gray-800/70 px-4 py-3 text-sm text-gray-200">
                <div>
                  Focusing on{' '}
                  <span className="font-semibold text-white">
                    {COUNTRY_LABELS[selectedCountry] || selectedCountry}
                  </span>
                  {selectedMediaType !== 'all' && (
                    <span className="text-gray-400"> · {selectedMediaType === 'movie' ? 'Movies' : 'TV Shows'}</span>
                  )}
                </div>
                <button
                  onClick={handleClearCountry}
                  className="text-xs uppercase tracking-widest text-red-500 hover:text-red-400 ml-auto"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {(query || selectedProvider || selectedCountry) && (
          <div className="space-y-8">
            {loading ? (
              <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-4">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52">
                    <MovieCardSkeleton />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Summary */}
                {totalResults > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-gray-400">
                      {query ? (
                        <>Found <span className="text-white font-semibold">{totalResults}</span> result{totalResults !== 1 ? 's' : ''} for <span className="text-white font-semibold">"{query}"</span></>
                      ) : selectedProvider ? (
                        <>Found <span className="text-white font-semibold">{totalResults}</span> result{totalResults !== 1 ? 's' : ''} on <span className="text-white font-semibold">{providers.find(p => p.provider_id === selectedProvider)?.provider_name || 'selected service'}</span></>
                      ) : (
                        <>Found <span className="text-white font-semibold">{totalResults}</span> result{totalResults !== 1 ? 's' : ''}</>
                      )}
                    </div>
                    <button
                      onClick={() => setShowImages(!showImages)}
                      className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors duration-200"
                      title={showImages ? 'Hide Images' : 'Show Images'}
                    >
                      <Image className="h-5 w-5" />
                    </button>
                  </div>
                )}

                    {/* Movies Results */}
                {showMovieResults && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Film className="h-6 w-6 text-blue-400" />
                      Movies
                    </h2>
                    <div className="relative">
                      <div 
                        className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory"
                        onScroll={handleMoviesScroll}
                      >
                        {movies.map((movie) => (
                          <MovieCard
                            key={movie._id}
                            movie={movie}
                            onPlay={handlePlayMovie}
                          />
                        ))}
                        {loadingMore && (
                          <div className="flex-shrink-0 w-40 flex items-center justify-center">
                            <LoadingSpinner size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

        {/* TV Shows Results */}
                {showTvResults && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Tv className="h-6 w-6 text-purple-400" />
                      TV Shows
                    </h2>
                    <div className="relative">
                      <div 
                        className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory"
                        onScroll={handleTvShowsScroll}
                      >
                        {tvShows.map((tvShow) => (
                          <TvShowCard
                            key={tvShow._id}
                            tvShow={tvShow}
                            onPlay={handlePlayTvShow}
                            onAddToWatchlist={() => handleAddToWatchlist(tvShow, 'tvshow')}
                          />
                        ))}
                        {loadingMore && (
                          <div className="flex-shrink-0 w-40 flex items-center justify-center">
                            <LoadingSpinner size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* No Results */}
                {showEmptyState && (
                  <div className="text-center py-16">
                    <Search className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">No results found</h3>
                    <p className="text-gray-400">Try searching for something else</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!query && !selectedProvider && !selectedCountry && movies.length === 0 && tvShows.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-24 w-24 text-gray-700 mx-auto mb-6 opacity-50" />
            <h2 className="text-3xl font-bold text-white mb-4">Search for anything</h2>
            <p className="text-gray-400 text-lg mb-8">
              Find your favorite movies and TV shows
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                <span>Movies</span>
              </div>
              <div className="flex items-center gap-2">
                <Tv className="h-4 w-4" />
                <span>TV Shows</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Play Modals */}
      {selectedMovieToPlay && (
        <MoviePlayModal
          movie={selectedMovieToPlay as any}
          onClose={() => setSelectedMovieToPlay(null)}
          onAddToWatchlist={(m) => handleAddToWatchlist(m as any, 'movie')}
          autoPlay={true}
        />
      )}
      
      {selectedTvShowToPlay && (
        <TvShowPlayModal
          tvShow={selectedTvShowToPlay as any}
          onClose={() => setSelectedTvShowToPlay(null)}
          onAddToWatchlist={(t) => handleAddToWatchlist(t as any, 'tvshow')}
          autoPlay={false}
        />
      )}
    </div>
  );
};

export default SearchPage;
