import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { tvShowPath } from '../utils/paths';
import TVShowCard from './TvShowCard';
import TvShowCardSkeleton from './TvShowCardSkeleton';
import TVShowSearchResults from './TVShowSearchResults';
import LoadingSpinner from './LoadingSpinner';
import TvShowPlayModal from './TvShowPlayModal';
import { 
  Tv, 
  TrendingUp, 
  Star, 
  Award,
  LayoutGrid,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { trackEvent } from '../utils/activityTracker';

interface TVShow {
  _id: string;
  name: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate: string;
  lastAirDate?: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  averageRuntime?: number;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
  tmdbId?: number;
  imdbId?: string;
  status?: string;
  type?: string;
}

interface Genre {
  _id: string;
  name: string;
  tmdbId?: number;
}

interface SearchFilters {
  query: string;
  genres: string[];
  year: string;
  rating: string;
  sortBy: string;
  order: 'asc' | 'desc';
  status?: string;
  type?: string;
  provider?: number | null;
}

const TVShowsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresWithCounts, setGenresWithCounts] = useState<Array<Genre & { tvShowCount: number }>>([]);
  const { user } = useAuth();
  const { showToast } = useToast();

  // Category states
  const [trendingTvShows, setTrendingTvShows] = useState<TVShow[]>([]);
  const [popularTvShows, setPopularTvShows] = useState<TVShow[]>([]);
  const [topRatedTvShows, setTopRatedTvShows] = useState<TVShow[]>([]);

  // Pagination state for each category
  const [categoryPages, setCategoryPages] = useState<{[key: string]: number}>({
    trending: 1,
    popular: 1,
    'top-rated': 1
  });

  const [categoryTotals, setCategoryTotals] = useState<{[key: string]: number}>({
    trending: 0,
    popular: 0,
    'top-rated': 0
  });

  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const [lastScrollTime, setLastScrollTime] = useState<{[key: string]: number}>({});
  const [rowNavState, setRowNavState] = useState<{[key: string]: { canLeft: boolean; canRight: boolean }}>({});
  const rowRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Search and filter states
  const [searchQuery] = useState('');
  const [isSearching] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    genres: [],
    year: 'all',
    rating: 'all',
    sortBy: 'popularity',
    order: 'desc',
    status: 'all',
    type: 'all',
    provider: null
  });

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedTvShowToPlay, setSelectedTvShowToPlay] = useState<TVShow | null>(null);
  
  // Dynamic TV shows storage by genre slug
  const [tvShowsByGenreSlug, setTvShowsByGenreSlug] = useState<{[key: string]: TVShow[]}>({});
  const [pagesByGenreSlug, setPagesByGenreSlug] = useState<{[key: string]: number}>({});
  const [totalsByGenreSlug, setTotalsByGenreSlug] = useState<{[key: string]: number}>({});

  // Fetch user's watchlist
  const fetchWatchlist = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await api.get('/api/watchlist');
      const watchlistItems = response.data.watchlist || [];
      const tvShowIds = watchlistItems
        .filter((item: any) => item.tvShow)
        .map((item: any) => item.tvShow._id);
      setWatchlist(tvShowIds);
    } catch (error) {
    }
  }, [user]);

  const selectedCategory = useMemo(() => searchParams.get('category') || 'all', [searchParams]);

  // Fetch genres
  const fetchGenres = useCallback(async () => {
    try {
      const response = await api.get('/api/genres');
      const genresData = response.data?.genres || response.data || [];
      setGenres(Array.isArray(genresData) ? genresData : []);
      
      // Also fetch genres with TV show counts for category buttons
      const countsResponse = await api.get('/api/genres/with-counts');
      const countsData = countsResponse.data?.genres || countsResponse.data || [];
      setGenresWithCounts(Array.isArray(countsData) ? countsData : []);
    } catch (error) {
    }
  }, []);

  // Fetch TV shows by category (append = true to add to existing list for infinite scroll)
  const fetchCategoryTvShows = useCallback(async (category: string, page: number = 1, append: boolean = false) => {
    try {
      let response;

      switch (category) {
        case 'trending':
          response = await api.get(`/api/tvshows/trending?limit=20&page=${page}`);
          break;
        case 'popular':
          response = await api.get(`/api/tvshows/popular?limit=20&page=${page}`);
          break;
        case 'top-rated':
          response = await api.get(`/api/tvshows/top-rated?limit=20&page=${page}`);
          break;
        default:
          response = await api.get(`/api/tvshows?limit=20&page=${page}`);
      }

      const tvShows = response.data.tvShows || [];
      const total = response.data.total || 0;

      const categoryMap: {[key: string]: any} = {
        'trending': { setter: setTrendingTvShows, key: 'trending' },
        'popular': { setter: setPopularTvShows, key: 'popular' },
        'top-rated': { setter: setTopRatedTvShows, key: 'top-rated' }
      };

      const categoryInfo = categoryMap[category];
      if (categoryInfo) {
        if (append) {
          categoryInfo.setter((prev: TVShow[]) => [...prev, ...tvShows]);
        } else {
          categoryInfo.setter(tvShows);
        }
        setCategoryTotals(prev => ({ ...prev, [categoryInfo.key]: total }));
      }
    } catch (error) {
    }
  }, []);

  // Fetch TV shows by genre
  const fetchTvShowsByGenre = useCallback(async (genreName: string, page: number = 1, append: boolean = false) => {
    try {
      if (genres.length === 0) {
        setTimeout(() => fetchTvShowsByGenre(genreName, page, append), 1000);
        return;
      }

      // First try exact match (case insensitive)
      let genre = genres.find(g => 
        g.name.toLowerCase() === genreName.toLowerCase() && g.tmdbId
      );
      
      // If no exact match, try fuzzy matching (but prefer longest match)
      if (!genre) {
        const matchingGenres = genres.filter(g => 
          g.name.toLowerCase().includes(genreName.toLowerCase()) ||
          genreName.toLowerCase().includes(g.name.toLowerCase())
        );
        
        // Among matches, prefer the one that matches more of the search term
        genre = matchingGenres.reduce((best, current) => {
          if (!best) return current;
          const bestScore = best.name.toLowerCase().includes(genreName.toLowerCase()) ? genreName.length : 0;
          const currentScore = current.name.toLowerCase().includes(genreName.toLowerCase()) ? genreName.length : 0;
          
          // Prefer exact or longer matching names with tmdbId
          if (current.tmdbId && currentScore >= bestScore) return current;
          if (best.tmdbId) return best;
          return current;
        });
      }
      
      if (genre) {
        const response = await api.get(`/api/tvshows?genre=${genre._id}&limit=20&page=${page}`);

        // Store TV shows by genre slug dynamically
        const genreSlug = genreToSlug(genre.name);
        
        if (append) {
          setTvShowsByGenreSlug(prev => ({
            ...prev,
            [genreSlug]: [...(prev[genreSlug] || []), ...(response.data.tvShows || [])]
          }));
        } else {
          setTvShowsByGenreSlug(prev => ({
            ...prev,
            [genreSlug]: response.data.tvShows || []
          }));
        }
        
        setTotalsByGenreSlug(prev => ({
          ...prev,
          [genreSlug]: response.data.total || 0
        }));
        
        // Initialize page for this genre if not set
        setPagesByGenreSlug(prev => ({
          ...prev,
          [genreSlug]: page
        }));
      } else {
        const fallbackResponse = await api.get(`/api/tvshows/popular?limit=20&page=${page}`);
        
        // For fallback, store in genre slug format
        const genreSlug = genreToSlug(genreName);
        setTvShowsByGenreSlug(prev => ({
          ...prev,
          [genreSlug]: fallbackResponse.data.tvShows || []
        }));
        setTotalsByGenreSlug(prev => ({
          ...prev,
          [genreSlug]: fallbackResponse.data.total || 0
        }));
      }
    } catch (error) {
    }
  }, [genres]);

  // Get TV shows for selected category
  const getCategoryTvShows = useCallback((category: string): TVShow[] => {
    // Check special categories first
    switch (category) {
      case 'trending': return trendingTvShows;
      case 'popular': return popularTvShows;
      case 'top-rated': return topRatedTvShows;
    }
    
    // Check dynamic genre storage
    if (tvShowsByGenreSlug[category]) {
      return tvShowsByGenreSlug[category];
    }
    
    return [];
  }, [trendingTvShows, popularTvShows, topRatedTvShows, tvShowsByGenreSlug]);

  // Helper function to convert genre name to URL slug
  const genreToSlug = (name: string) => {
    return name.toLowerCase()
      .replace(/&/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  // Load more TV shows for category (infinite scroll)
  const loadMoreCategoryTvShows = async (category: string) => {
    if (loadingStates[category]) return;
    const newPage = (categoryPages[category] || 1) + 1;
    const total = categoryTotals[category] || 0;
    const totalPages = Math.ceil(total / 20);
    if (newPage > totalPages) return;

    setLoadingStates(prev => ({ ...prev, [category]: true }));
    try {
      await fetchCategoryTvShows(category, newPage, true);
      setCategoryPages(prev => ({ ...prev, [category]: newPage }));
    } catch (error) {
    } finally {
      setLoadingStates(prev => ({ ...prev, [category]: false }));
    }
  };

  // Load more TV shows for genre (infinite scroll)
  const loadMoreGenreTvShows = async (genreSlug: string) => {
    if (loadingStates[genreSlug]) return;
    const genreFromSelected = genresWithCounts.find(g => genreToSlug(g.name) === genreSlug);
    if (!genreFromSelected) return;
    const currentPage = pagesByGenreSlug[genreSlug] || 1;
    const newPage = currentPage + 1;
    const total = totalsByGenreSlug[genreSlug] || 0;
    const totalPages = Math.ceil(total / 20);
    if (newPage > totalPages) return;

    setLoadingStates(prev => ({ ...prev, [genreSlug]: true }));
    try {
      await fetchTvShowsByGenre(genreFromSelected.name, newPage, true);
      setPagesByGenreSlug(prev => ({ ...prev, [genreSlug]: newPage }));
    } catch (error) {
    } finally {
      setLoadingStates(prev => ({ ...prev, [genreSlug]: false }));
    }
  };

  // Infinite scroll: when user scrolls near end of horizontal row, load more
  const handleScroll = (e: React.UIEvent<HTMLDivElement>, category: string) => {
    const el = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
    const isNearEnd = scrollPercentage >= 0.8;

    const now = Date.now();
    const last = lastScrollTime[category] || 0;
    if (now - last < 500) return;
    setLastScrollTime(prev => ({ ...prev, [category]: now }));

    if (loadingStates[category]) return;
    if (!isNearEnd) return;

    const list = getCategoryTvShows(category);
    const total = ['trending', 'popular', 'top-rated'].includes(category)
      ? (categoryTotals[category] || 0)
      : (totalsByGenreSlug[category] || 0);
    const hasMore = list.length < total && list.length >= 20;
    const currentPage = ['trending', 'popular', 'top-rated'].includes(category)
      ? (categoryPages[category] || 1)
      : (pagesByGenreSlug[category] || 1);
    const totalPages = Math.ceil(total / 20);
    const isNotAtMax = currentPage < totalPages;

    if (hasMore && isNotAtMax) {
      if (['trending', 'popular', 'top-rated'].includes(category)) {
        loadMoreCategoryTvShows(category);
      } else {
        loadMoreGenreTvShows(category);
      }
    }
  };

  const updateRowNav = useCallback((key: string) => {
    const el = rowRefs.current[key];
    if (!el) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setRowNavState(prev => ({
      ...prev,
      [key]: {
        canLeft: el.scrollLeft > 8,
        canRight: el.scrollLeft < maxScrollLeft - 8
      }
    }));
  }, []);

  const setRowRef = useCallback((key: string) => (el: HTMLDivElement | null) => {
    rowRefs.current[key] = el;
    if (el) {
      requestAnimationFrame(() => updateRowNav(key));
    }
  }, [updateRowNav]);

  const scrollRowBy = useCallback((key: string, direction: 'left' | 'right') => {
    const el = rowRefs.current[key];
    if (!el) return;
    const distance = Math.max(280, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
    requestAnimationFrame(() => updateRowNav(key));
  }, [updateRowNav]);

  useEffect(() => {
    const onResize = () => {
      Object.keys(rowRefs.current).forEach((key) => updateRowNav(key));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateRowNav]);

  // Handle play TV show
  const handlePlayTvShow = (tvShow: TVShow) => {
    trackEvent({
      eventType: 'tv_play',
      path: '/tvshows',
      contentType: 'tvshow',
      contentId: tvShow._id,
      metadata: {
        title: tvShow.name,
        source: 'tvshows_page',
        category: selectedCategory
      }
    });
    navigate(tvShowPath(tvShow));
  };

  // Handle add to watchlist
  const handleAddToWatchlist = async (tvShow: { _id: string; name: string }) => {
    if (!user) {
      showToast('Please log in to add TV shows to your watchlist', 'error');
      return;
    }
    
    try {
      await api.post(`/api/watchlist/tvshows/${tvShow._id}`);
      setWatchlist(prev => [...prev, tvShow._id]);
      showToast(`"${tvShow.name}" added to watchlist!`, 'success');
      trackEvent({
        eventType: 'watchlist_add',
        path: '/tvshows',
        contentType: 'tvshow',
        contentId: tvShow._id,
        metadata: {
          title: tvShow.name,
          source: 'tvshows_page'
        }
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        showToast('Please log in to add TV shows to your watchlist', 'error');
      } else if (error.response?.status === 400) {
        showToast('This TV show is already in your watchlist!', 'error');
      } else {
        showToast('Failed to add TV show to watchlist. Please try again.', 'error');
      }
      throw error; // Re-throw to let the card handle the error state
    }
  };

  // Handle remove from watchlist
  const handleRemoveFromWatchlist = async (tvShow: { _id: string; name: string }) => {
    if (!user) {
      showToast('Please log in to manage your watchlist', 'error');
      return;
    }
    
    try {
      await api.delete(`/api/watchlist/tvshows/${tvShow._id}`);
      setWatchlist(prev => prev.filter(id => id !== tvShow._id));
      showToast(`"${tvShow.name}" removed from watchlist!`, 'success');
      trackEvent({
        eventType: 'watchlist_remove',
        path: '/tvshows',
        contentType: 'tvshow',
        contentId: tvShow._id,
        metadata: {
          title: tvShow.name,
          source: 'tvshows_page'
        }
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        showToast('Please log in to manage your watchlist', 'error');
      } else {
        showToast('Failed to remove TV show from watchlist. Please try again.', 'error');
      }
      throw error;
    }
  };

  // Load initial data
  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Load all categories on initial mount with staggered fetching to prevent main thread blocking
  useEffect(() => {
    // Fetch trending immediately for fast perceived load
    fetchCategoryTvShows('trending');
    
    // Stagger the others to let the browser paint the navigation transition first
    const popularTimer = setTimeout(() => fetchCategoryTvShows('popular'), 150);
    const topRatedTimer = setTimeout(() => fetchCategoryTvShows('top-rated'), 300);

    return () => {
      clearTimeout(popularTimer);
      clearTimeout(topRatedTimer);
    };
  }, [fetchCategoryTvShows]);

  // Load genre-based categories after genres are loaded (fetch top 7 genres)
  useEffect(() => {
    if (genres.length > 0 && genresWithCounts.length > 0) {
      // Stagger the fetches dynamically to prevent UI freeze (80+ cards rendering at once)
      const timers = genresWithCounts.slice(0, 7).map((genre, index) => {
        return setTimeout(() => {
          fetchTvShowsByGenre(genre.name);
        }, 500 + (index * 200)); // Start after 500ms, then every 200ms
      });

      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [genres.length, genresWithCounts, fetchTvShowsByGenre]);

  // Fetch TV shows when category changes
  useEffect(() => {
    if (!selectedCategory || selectedCategory === 'all') return;
    
    if (['trending', 'popular', 'top-rated'].includes(selectedCategory)) {
      if (
        (selectedCategory === 'trending' && trendingTvShows.length === 0) ||
        (selectedCategory === 'popular' && popularTvShows.length === 0) ||
        (selectedCategory === 'top-rated' && topRatedTvShows.length === 0)
      ) {
        fetchCategoryTvShows(selectedCategory);
      }
    } else {
      const genreFromSelected = genresWithCounts.find(g => genreToSlug(g.name) === selectedCategory);
      if (genreFromSelected && !tvShowsByGenreSlug[selectedCategory]) {
        fetchTvShowsByGenre(genreFromSelected.name);
      }
    }
  }, [selectedCategory, genresWithCounts, trendingTvShows.length, popularTvShows.length, topRatedTvShows.length, tvShowsByGenreSlug, fetchTvShowsByGenre, fetchCategoryTvShows]);

  // Build category items dynamically from database (All first as default)
  const categoryItems = useMemo(() => {
    const allCategory = { label: 'All', path: '/tvshows?category=all', icon: <LayoutGrid className="w-4 h-4" /> };
    const baseCategories = [
      { label: 'Trending', path: '/tvshows?category=trending', icon: <TrendingUp className="w-4 h-4" /> },
      { label: 'Popular', path: '/tvshows?category=popular', icon: <Star className="w-4 h-4" /> },
      { label: 'Top Rated', path: '/tvshows?category=top-rated', icon: <Award className="w-4 h-4" /> }
    ];

    // Add top genres from database (limit to top 7 to keep UI clean)
    const topGenres = genresWithCounts.slice(0, 7).map(genre => ({
      label: genre.name,
      path: `/tvshows?category=${genreToSlug(genre.name)}`,
      icon: <Tv className="w-4 h-4" />,
      count: genre.tvShowCount,
      genreId: genre._id
    }));

    return [allCategory, ...baseCategories, ...topGenres];
  }, [genresWithCounts]);

  // Get display label for selected category slug
  const selectedCategoryLabel = useMemo(() => {
    const item = categoryItems.find((i) => i.path.split('=')[1] === selectedCategory);
    return item ? item.label : selectedCategory.replace(/-/g, ' ');
  }, [categoryItems, selectedCategory]);

  return (
    <div className="min-h-screen bg-black text-white ">
      <div className=" p-6 space-y-8">
        {/* Search Results */}
        {isSearching && searchQuery && (
          <TVShowSearchResults
            query={searchQuery}
            filters={searchFilters}
            onPlay={handlePlayTvShow}
            onAddToWatchlist={handleAddToWatchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            watchlist={watchlist}
            onFilterChange={(newFilters) => setSearchFilters(prev => ({ ...prev, ...newFilters }))}
          />
        )}

        {/* Category Navigation - Match reference: red for Trending/Popular/Top Rated, blue-gray for genres */}
        {!isSearching && !searchQuery && (
          <>
          <div className="mb-8">
            <div
              className="flex items-center gap-2 overflow-x-auto scroll-smooth pb-1 pt-0.5 no-scrollbar scrollbar-none scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categoryItems.map((item) => {
                const slug = item.path.split('=')[1];
                const isSelected = selectedCategory === slug;
                const isMainCategory = ['all', 'trending', 'popular', 'top-rated'].includes(slug);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setSearchParams({ category: slug })}
                    className={`
                      inline-flex items-center px-4 py-2 rounded-full text-sm font-medium
                      transition-all border shrink-0 whitespace-nowrap
                      ${isSelected
                        ? isMainCategory
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                          : 'bg-slate-600 text-white border-slate-600 hover:bg-slate-500'
                        : 'bg-black text-white border-gray-500/50 hover:border-gray-400 hover:bg-gray-900'
                      }
                    `}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="ml-2">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </>
        )}

        {/* All sections when "All" selected, otherwise filtered single category */}
        {!isSearching && !searchQuery && selectedCategory === 'all' && (
          <div className="space-y-10">
            {/* Trending Now */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Trending Now</h2>
                <div className="h-[2px] w-16 sm:w-24 bg-red-600"></div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('trending', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState.trending?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('trending', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState.trending?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
              <div ref={setRowRef('trending')} className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory" onScroll={(e) => { handleScroll(e, 'trending'); updateRowNav('trending'); }}>
                {trendingTvShows.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start"><TvShowCardSkeleton /></div>
                  ))
                ) : (
                  <>
                    {trendingTvShows.map((tvShow) => (
                      <TVShowCard key={tvShow._id} tvShow={tvShow} onPlay={handlePlayTvShow} onAddToWatchlist={handleAddToWatchlist} onRemoveFromWatchlist={handleRemoveFromWatchlist} isInWatchlist={watchlist.includes(tvShow._id)} />
                    ))}
                    {loadingStates['trending'] && <div className="flex-shrink-0 w-40 flex items-center justify-center"><LoadingSpinner size="sm" /></div>}
                  </>
                )}
              </div>
              </div>
            </div>
            {/* Popular */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Popular</h2>
                <div className="h-[2px] w-16 sm:w-24 bg-red-600"></div>
              </div>
              <div className="relative group">
                <button type="button" onClick={() => scrollRowBy('popular', 'left')} className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState.popular?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll left"><ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
                <button type="button" onClick={() => scrollRowBy('popular', 'right')} className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState.popular?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll right"><ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
              <div ref={setRowRef('popular')} className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory" onScroll={(e) => { handleScroll(e, 'popular'); updateRowNav('popular'); }}>
                {popularTvShows.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start"><TvShowCardSkeleton /></div>
                  ))
                ) : (
                  <>
                    {popularTvShows.map((tvShow) => (
                      <TVShowCard key={tvShow._id} tvShow={tvShow} onPlay={handlePlayTvShow} onAddToWatchlist={handleAddToWatchlist} onRemoveFromWatchlist={handleRemoveFromWatchlist} isInWatchlist={watchlist.includes(tvShow._id)} />
                    ))}
                    {loadingStates['popular'] && <div className="flex-shrink-0 w-40 flex items-center justify-center"><LoadingSpinner size="sm" /></div>}
                  </>
                )}
              </div>
              </div>
            </div>
            {/* Top Rated */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Top Rated</h2>
                <div className="h-[2px] w-16 sm:w-24 bg-red-600"></div>
              </div>
              <div className="relative group">
                <button type="button" onClick={() => scrollRowBy('top-rated', 'left')} className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState['top-rated']?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll left"><ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
                <button type="button" onClick={() => scrollRowBy('top-rated', 'right')} className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState['top-rated']?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll right"><ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
              <div ref={setRowRef('top-rated')} className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory" onScroll={(e) => { handleScroll(e, 'top-rated'); updateRowNav('top-rated'); }}>
                {topRatedTvShows.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start"><TvShowCardSkeleton /></div>
                  ))
                ) : (
                  <>
                    {topRatedTvShows.map((tvShow) => (
                      <TVShowCard key={tvShow._id} tvShow={tvShow} onPlay={handlePlayTvShow} onAddToWatchlist={handleAddToWatchlist} onRemoveFromWatchlist={handleRemoveFromWatchlist} isInWatchlist={watchlist.includes(tvShow._id)} />
                    ))}
                    {loadingStates['top-rated'] && <div className="flex-shrink-0 w-40 flex items-center justify-center"><LoadingSpinner size="sm" /></div>}
                  </>
                )}
              </div>
              </div>
            </div>
            {/* Genre rows */}
            {genresWithCounts.slice(0, 7).map((genre) => {
              const slug = genreToSlug(genre.name);
              const genreTvShows = tvShowsByGenreSlug[slug] || [];
              const isLoading = genreTvShows.length === 0;
              return (
                <div key={slug} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">{genre.name}</h2>
                    <div className="h-[2px] w-16 sm:w-24 bg-red-600"></div>
                  </div>
                  <div className="relative group">
                  <button type="button" onClick={() => scrollRowBy(slug, 'left')} className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState[slug]?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll left"><ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
                  <button type="button" onClick={() => scrollRowBy(slug, 'right')} className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState[slug]?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll right"><ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
                  <div ref={setRowRef(slug)} className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory" onScroll={(e) => { handleScroll(e, slug); updateRowNav(slug); }}>
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start"><TvShowCardSkeleton /></div>
                      ))
                    ) : (
                      <>
                        {genreTvShows.map((tvShow) => (
                          <TVShowCard key={tvShow._id} tvShow={tvShow} onPlay={handlePlayTvShow} onAddToWatchlist={handleAddToWatchlist} onRemoveFromWatchlist={handleRemoveFromWatchlist} isInWatchlist={watchlist.includes(tvShow._id)} />
                        ))}
                        {loadingStates[slug] && <div className="flex-shrink-0 w-40 flex items-center justify-center"><LoadingSpinner size="sm" /></div>}
                      </>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filtered content: show only the selected category when not "All" */}
        {!isSearching && !searchQuery && selectedCategory && selectedCategory !== 'all' && (
          <div className="space-y-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">{selectedCategoryLabel}</h2>
                <div className="h-[2px] w-16 sm:w-24 bg-red-600"></div>
              </div>
              <div className="relative group">
              <button type="button" onClick={() => scrollRowBy(selectedCategory, 'left')} className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState[selectedCategory]?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll left"><ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
              <button type="button" onClick={() => scrollRowBy(selectedCategory, 'right')} className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${rowNavState[selectedCategory]?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'}`} aria-label="Scroll right"><ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" /></button>
              <div
                ref={setRowRef(selectedCategory)}
                className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory"
                onScroll={(e) => { handleScroll(e, selectedCategory); updateRowNav(selectedCategory); }}
              >
                {(() => {
                  const list = getCategoryTvShows(selectedCategory);
                  const isLoadingMain = list.length === 0;
                  if (isLoadingMain) {
                    return Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <TvShowCardSkeleton />
                      </div>
                    ));
                  }
                  return (
                    <>
                      {list.map((tvShow) => (
                        <TVShowCard
                          key={tvShow._id}
                          tvShow={tvShow}
                          onPlay={handlePlayTvShow}
                          onAddToWatchlist={handleAddToWatchlist}
                          onRemoveFromWatchlist={handleRemoveFromWatchlist}
                          isInWatchlist={watchlist.includes(tvShow._id)}
                        />
                      ))}
                      {loadingStates[selectedCategory] && (
                        <div className="flex-shrink-0 w-40 flex items-center justify-center">
                          <LoadingSpinner size="sm" />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Play Modal */}
      {selectedTvShowToPlay && (
        <TvShowPlayModal
          tvShow={selectedTvShowToPlay}
          onClose={() => setSelectedTvShowToPlay(null)}
          onAddToWatchlist={handleAddToWatchlist}
          onRemoveFromWatchlist={handleRemoveFromWatchlist}
          isInWatchlist={watchlist.includes(selectedTvShowToPlay._id)}
          autoPlay={false}
        />
      )}
    </div>
  );
};

export default TVShowsPage;
