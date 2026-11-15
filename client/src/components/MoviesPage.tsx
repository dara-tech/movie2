import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import MovieCard from './MovieCard';
import MovieCardSkeleton from './MovieCardSkeleton';
import LoadingSpinner from './LoadingSpinner';
import SearchResults from './SearchResults';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
// Icons removed - not currently used
import { trackEvent } from '../utils/activityTracker';
import { moviePath } from '../utils/paths';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MoviePlayModal from './MoviePlayModal';

const STANDARD_MOVIE_CATEGORIES = new Set([
  'latest',
  'trending',
  'popular',
  'topRated',
  'upcoming',
  'action',
  'comedy',
  'drama',
  'horror',
  'romance',
  'sci-fi',
  'thriller'
]);

const CATEGORY_KEY_MAP: Record<string, string> = {
  latest: 'latest',
  trending: 'trending',
  popular: 'popular',
  'top-rated': 'topRated',
  toprated: 'topRated',
  topRated: 'topRated',
  upcoming: 'upcoming',
  action: 'action',
  comedy: 'comedy',
  drama: 'drama',
  horror: 'horror',
  romance: 'romance',
  'sci-fi': 'sci-fi',
  scifi: 'sci-fi',
  thriller: 'thriller'
};

const CATEGORY_LABELS: Record<string, string> = {
  latest: 'Latest',
  trending: 'Trending',
  popular: 'Popular',
  topRated: 'Top Rated',
  upcoming: 'Upcoming',
  action: 'Action',
  comedy: 'Comedy',
  drama: 'Drama',
  horror: 'Horror',
  romance: 'Romance',
  'sci-fi': 'Sci-Fi',
  thriller: 'Thriller'
};

const normalizeCategoryParam = (value: string | null): string => {
  if (!value) return '';
  const key = CATEGORY_KEY_MAP[value.toLowerCase()];
  return key ?? '';
};

const formatCategoryLabel = (category: string): string => {
  return CATEGORY_LABELS[category] || category.replace(/-/g, ' ');
};

export interface SearchFilters {
  query: string;
  genres: string[];
  year: string;
  rating: string;
  sortBy: string;
  order: 'asc' | 'desc';
  provider?: number | null;
}

interface Movie {
  _id: string;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  runtime?: number;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
  tmdbId?: number;
  imdbId?: string;
}

// Removed unused MovieVideo interface

interface Genre {
  _id: string;
  name: string;
  tmdbId?: number;
}

const MoviesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = normalizeCategoryParam(searchParams.get('category'));
  const { user } = useAuth();
  const { showToast } = useToast();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [searchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: searchParams.get('search') || '',
    genres: [],
    year: 'all',
    rating: 'all',
    sortBy: 'popularity',
    order: 'desc',
    provider: null
  });
  const [isSearching] = useState(false);
  const [movies] = useState<Movie[]>([]);
  
  // Category data
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([]);
  // Dynamic genre movies storage - use a map instead of individual state variables
  const [genreMovies, setGenreMovies] = useState<{[key: string]: Movie[]}>({});
  
  // Keep old state for backward compatibility
  const [actionMovies, setActionMovies] = useState<Movie[]>([]);
  const [comedyMovies, setComedyMovies] = useState<Movie[]>([]);
  const [dramaMovies, setDramaMovies] = useState<Movie[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Movie[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<Movie[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<Movie[]>([]);
  const [thrillerMovies, setThrillerMovies] = useState<Movie[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const [lastScrollTime, setLastScrollTime] = useState<{[key: string]: number}>({});
  const [loadingMovieId] = useState<string | null>(null);
  const [watchHistory, setWatchHistory] = useState<{[key: string]: { lastPosition: number; completed: boolean }}>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedMovieToPlay, setSelectedMovieToPlay] = useState<Movie | null>(null);
  const navigate = useNavigate();

  // Hero section with trailer
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
  // Removed unused state: featuredMovie, featuredTrailer, featuredLoading

  // Pagination state for each category
  const [categoryPages, setCategoryPages] = useState<{[key: string]: number}>({
    trending: 1,
    popular: 1,
    topRated: 1,
    upcoming: 1,
    action: 1,
    comedy: 1,
    drama: 1,
    horror: 1,
    romance: 1,
    'sci-fi': 1,
    thriller: 1
  });

  const [categoryTotals, setCategoryTotals] = useState<{[key: string]: number}>({
    trending: 0,
    popular: 0,
    topRated: 0,
    upcoming: 0,
    action: 0,
    comedy: 0,
    drama: 0,
    horror: 0,
    romance: 0,
    'sci-fi': 0,
    thriller: 0
  });

  const [genrePages, setGenrePages] = useState<{[key: string]: number}>({
    action: 1,
    comedy: 1,
    drama: 1,
    horror: 1,
    romance: 1,
    'sci-fi': 1,
    thriller: 1
  });
  
  // Track which genre sections have been loaded to prevent duplicate fetches
  const [loadedGenres, setLoadedGenres] = useState<Set<string>>(new Set());
  const [genreLoadingFlags, setGenreLoadingFlags] = useState<{[key: string]: boolean}>({});
  const [rowNavState, setRowNavState] = useState<{[key: string]: { canLeft: boolean; canRight: boolean }}>({});
  const rowRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const updateRowNav = useCallback((key: string) => {
    const el = rowRefs.current[key];
    if (!el) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setRowNavState((prev) => ({
      ...prev,
      [key]: {
        canLeft: el.scrollLeft > 8,
        canRight: el.scrollLeft < maxScrollLeft - 8
      }
    }));
  }, []);

  const setRowRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      rowRefs.current[key] = el;
      if (el) {
        requestAnimationFrame(() => updateRowNav(key));
      }
    },
    [updateRowNav]
  );

  const scrollRowBy = useCallback(
    (key: string, direction: 'left' | 'right') => {
      const el = rowRefs.current[key];
      if (!el) return;
      const distance = Math.max(280, Math.floor(el.clientWidth * 0.85));
      el.scrollBy({
        left: direction === 'left' ? -distance : distance,
        behavior: 'smooth'
      });
      requestAnimationFrame(() => updateRowNav(key));
    },
    [updateRowNav]
  );

  const fetchGenres = async () => {
    try {
      const response = await api.get('/api/genres');
      // Handle both old format (array) and new format ({ success, genres })
      const genresData = response.data?.genres || response.data || [];
      setGenres(Array.isArray(genresData) ? genresData : []);
    } catch (error) {
      console.error('Error fetching genres:', error);
      setGenres([]);
    }
  };

  const fetchCategoryMovies = useCallback(
    async (category: string, page: number = 1, append: boolean = false) => {
      const normalized = normalizeCategoryParam(category) || category;
      if (!STANDARD_MOVIE_CATEGORIES.has(normalized)) {
        if (!append) {
          setCategoryLoading(false);
        }
        return;
      }

      try {
        if (!append) setCategoryLoading(true);

        const limit = 20;
        let response: any;

        switch (normalized) {
          case 'trending':
            response = await api.get(`/api/movies/trending?limit=${limit}&page=${page}`);
            setTrendingMovies((prev) =>
              append ? [...prev, ...(response.data.movies || [])] : response.data.movies || []
            );
            setCategoryTotals((prev) => ({ ...prev, trending: response.data.total }));
            break;
          case 'popular':
            response = await api.get(`/api/movies/popular?limit=${limit}&page=${page}`);
            setPopularMovies((prev) =>
              append ? [...prev, ...(response.data.movies || [])] : response.data.movies || []
            );
            setCategoryTotals((prev) => ({ ...prev, popular: response.data.total }));
            break;
          case 'topRated':
            response = await api.get(`/api/movies/top-rated?limit=${limit}&page=${page}`);
            setTopRatedMovies((prev) =>
              append ? [...prev, ...(response.data.movies || [])] : response.data.movies || []
            );
            setCategoryTotals((prev) => ({ ...prev, topRated: response.data.total }));
            break;
          case 'upcoming':
            response = await api.get(`/api/movies/upcoming?limit=${limit}&page=${page}`);
            setUpcomingMovies((prev) =>
              append ? [...prev, ...(response.data.movies || [])] : response.data.movies || []
            );
            setCategoryTotals((prev) => ({ ...prev, upcoming: response.data.total }));
            break;
          default:
            break;
        }

        setCategoryPages((prev) => ({ ...prev, [normalized]: page }));
      } catch (error: any) {
        // Silent fail
      } finally {
        if (!append) setCategoryLoading(false);
      }
    },
    []
  );

  // Fetch movies by genre with pagination support
  const fetchMoviesByGenre = useCallback(async (genreName: string, page: number = 1, append: boolean = false) => {
    // Prevent duplicate fetches for the same genre/page
    const cacheKey = `${genreName}-${page}`;
    if (!append && loadedGenres.has(cacheKey)) {
      return;
    }
    
    // Set loading flag
    setGenreLoadingFlags(prev => ({ ...prev, [genreName]: true }));
    
    try {
      // Wait for genres to be loaded first
      if (genres.length === 0) {
        setTimeout(() => fetchMoviesByGenre(genreName, page, append), 1000);
        setGenreLoadingFlags(prev => ({ ...prev, [genreName]: false }));
        return;
      }


      // Find the genre ID by name (prioritize genres with tmdbId)
      const matchingGenres = genres.filter(g => 
        g.name.toLowerCase() === genreName.toLowerCase() ||
        g.name.toLowerCase().includes(genreName.toLowerCase()) ||
        genreName.toLowerCase().includes(g.name.toLowerCase())
      );
      
      // Prioritize genres with tmdbId (they have actual movie data)
      const genre = matchingGenres.find(g => g.tmdbId) || matchingGenres[0];
      
      if (genre) {
        const response = await api.get(`/api/movies?genre=${genre._id}&limit=20&page=${page}`);
        
        // Convert genre name to slug for storage
        const genreSlug = genreName.toLowerCase()
          .replace(/&/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/science-fiction|sci-fi|scifi/g, 'sci-fi');

        // Store in dynamic genre movies map (works for ALL genres)
        if (append) {
          setGenreMovies(prev => ({
            ...prev,
            [genreSlug]: [...(prev[genreSlug] || []), ...(response.data.movies || [])]
          }));
        } else {
          setGenreMovies(prev => ({
            ...prev,
            [genreSlug]: response.data.movies || []
          }));
        }
        
        setCategoryTotals(prev => ({ ...prev, [genreSlug]: response.data.total || 0 }));
        
        // Mark as loaded
        if (!append) {
          setLoadedGenres(prev => new Set(prev).add(cacheKey));
        }

        // Also update legacy state for backward compatibility with hardcoded genres
        const legacyGenreMap: {[key: string]: any} = {
          'Action': { setter: setActionMovies, key: 'action' },
          'Comedy': { setter: setComedyMovies, key: 'comedy' },
          'Drama': { setter: setDramaMovies, key: 'drama' },
          'Horror': { setter: setHorrorMovies, key: 'horror' },
          'Romance': { setter: setRomanceMovies, key: 'romance' },
          'Science Fiction': { setter: setSciFiMovies, key: 'sci-fi' },
          'Thriller': { setter: setThrillerMovies, key: 'thriller' }
        };

        const legacyGenreInfo = legacyGenreMap[genreName];
        if (legacyGenreInfo) {
          if (append) {
            legacyGenreInfo.setter((prev: Movie[]) => [...prev, ...(response.data.movies || [])]);
          } else {
            legacyGenreInfo.setter(response.data.movies || []);
          }
        }
      } else {
        // Fallback: try to fetch from main categories if genre not found
        const fallbackResponse = await api.get(`/api/movies/popular?limit=20&page=${page}`);
        
        const genreMap: {[key: string]: any} = {
          'Action': { setter: setActionMovies, key: 'action' },
          'Comedy': { setter: setComedyMovies, key: 'comedy' },
          'Drama': { setter: setDramaMovies, key: 'drama' },
          'Horror': { setter: setHorrorMovies, key: 'horror' },
          'Romance': { setter: setRomanceMovies, key: 'romance' },
          'Science Fiction': { setter: setSciFiMovies, key: 'sci-fi' },
          'Thriller': { setter: setThrillerMovies, key: 'thriller' }
        };

        const genreInfo = genreMap[genreName];
        if (genreInfo) {
          genreInfo.setter(fallbackResponse.data.movies || []);
          setCategoryTotals(prev => ({ ...prev, [genreInfo.key]: fallbackResponse.data.total || 0 }));
          
          // Mark as loaded
          if (!append) {
            setLoadedGenres(prev => new Set(prev).add(cacheKey));
          }
        }
      }
    } catch (error: any) {
      // Silent fail
      // Silently fail for genre movies - don't break the UI
    } finally {
      setCategoryLoading(false);
      setGenreLoadingFlags(prev => ({ ...prev, [genreName]: false }));
    }
  }, [genres, loadedGenres]);

  // Load more movies for a specific genre with smart loading
  const loadMoreGenreMovies = async (genreName: string) => {
    // Map genre names to the correct keys used in genrePages state
    const genreKeyMap: {[key: string]: string} = {
      Action: 'action',
      Comedy: 'comedy',
      Drama: 'drama',
      Horror: 'horror',
      Romance: 'romance',
      'Science Fiction': 'sci-fi',
      Thriller: 'thriller'
    };
    
    const genreKey = genreKeyMap[genreName];
    if (genreKey) {
      // Check if already loading this genre
      if (loadingStates[genreKey]) {
        return;
      }

      const newPage = genrePages[genreKey] + 1;
      const totalPages = Math.ceil((categoryTotals[genreKey] || 0) / 20);
      
      // Check if we've reached the maximum pages
      if (newPage > totalPages) {
        return;
      }

      // Set loading state for this genre
      setLoadingStates(prev => ({ ...prev, [genreKey]: true }));
      setGenrePages(prev => ({ ...prev, [genreKey]: newPage }));
      
      try {
        await fetchMoviesByGenre(genreName, newPage, true);
      } catch (error) {
      } finally {
        // Clear loading state for this genre
        setLoadingStates(prev => ({ ...prev, [genreKey]: false }));
      }
    }
  };


  // Fetch featured movies and trailer
  const fetchFeaturedMovies = useCallback(async () => {
    try {
      // Get top 5 trending movies for carousel
      const response = await api.get('/api/movies/trending?limit=5&page=1');
      if (response.data.movies && response.data.movies.length > 0) {
        setFeaturedMovies(response.data.movies);
        // Removed unused: setFeaturedMovie, setFeaturedTrailer, setFeaturedLoading
      }
    } catch (error) {
      // Error handling
    }
  }, []);

  // Update featured movie when carousel index changes
  // Removed unused featuredMovie and featuredTrailer state updates
  useEffect(() => {
    if (featuredMovies.length > 0 && currentFeaturedIndex < featuredMovies.length) {
      // Carousel index updated - can be used for future features
    }
  }, [currentFeaturedIndex, featuredMovies]);

  // Auto-rotate carousel every 10 seconds
  useEffect(() => {
    if (featuredMovies.length > 1) {
      const interval = setInterval(() => {
        setCurrentFeaturedIndex((prev) => (prev + 1) % featuredMovies.length);
      }, 10000); // Change every 10 seconds

      return () => clearInterval(interval);
    }
  }, [featuredMovies.length]);

  useEffect(() => {
    fetchGenres();
    fetchFeaturedMovies();
    // Fetch initial pages for all categories
    fetchCategoryMovies('trending', 1);
    fetchCategoryMovies('popular', 1);
    fetchCategoryMovies('topRated', 1);
    fetchCategoryMovies('upcoming', 1);
  }, [fetchFeaturedMovies, fetchCategoryMovies]);

  // Fetch genre movies after genres are loaded - batch load in groups to prevent overload
  useEffect(() => {
    if (genres.length > 0) {
      // Batch 1: Load first 2 genres immediately
      fetchMoviesByGenre('Action', 1);
      fetchMoviesByGenre('Comedy', 1);
      
      // Batch 2: Load next 2 genres after 500ms
      setTimeout(() => {
        fetchMoviesByGenre('Drama', 1);
        fetchMoviesByGenre('Horror', 1);
      }, 500);
      
      // Batch 3: Load remaining genres after 1s
      setTimeout(() => {
        fetchMoviesByGenre('Romance', 1);
        fetchMoviesByGenre('Science Fiction', 1);
        fetchMoviesByGenre('Thriller', 1);
      }, 1000);
    }
  }, [genres, fetchMoviesByGenre]);

  // Handle search and category from URL parameters
  useEffect(() => {
    const rawCategory = searchParams.get('category');
    const normalizedCategory = normalizeCategoryParam(rawCategory);

    if (normalizedCategory) {
      setSelectedCategory(normalizedCategory);

      // Check if it's a genre category (not a standard category like trending, popular, etc.)
      if (!STANDARD_MOVIE_CATEGORIES.has(normalizedCategory)) {
        // It's a genre - find the genre name from the slug
        // Try to find matching genre from database
        const genreFromSlug = genres.find(g => {
          const genreSlug = g.name.toLowerCase()
            .replace(/&/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
          return genreSlug === normalizedCategory;
        });
        
        if (genreFromSlug) {
          fetchMoviesByGenre(genreFromSlug.name, 1, false);
        } else {
          // Fallback to hardcoded map for common genres
          const genreNameMap: {[key: string]: string} = {
            action: 'Action',
            comedy: 'Comedy',
            drama: 'Drama',
            horror: 'Horror',
            romance: 'Romance',
            'sci-fi': 'Science Fiction',
            scifi: 'Science Fiction',
            thriller: 'Thriller',
            adventure: 'Adventure',
            animation: 'Animation',
            crime: 'Crime',
            documentary: 'Documentary',
            family: 'Family',
            fantasy: 'Fantasy',
            history: 'History',
            music: 'Music',
            mystery: 'Mystery',
            war: 'War',
            western: 'Western'
          };

          const genreName = genreNameMap[normalizedCategory];
          if (genreName) {
            fetchMoviesByGenre(genreName, 1, false);
          }
        }
      } else {
        fetchCategoryMovies(normalizedCategory, 1, false);
      }
    } else {
      setSelectedCategory('');
    }
  }, [fetchCategoryMovies, fetchMoviesByGenre, searchParams, genres]);

  // Get movies based on selected category
  const getCategoryMovies = (category: string): Movie[] => {
    switch (category) {
      case 'latest':
        return movies.slice(0, 20); // Show latest from main movies
      case 'trending':
        return trendingMovies;
      case 'popular':
        return popularMovies;
      case 'top-rated':
      case 'topRated':
        return topRatedMovies;
      case 'upcoming':
        return upcomingMovies;
      case 'action':
        return actionMovies.length > 0 ? actionMovies : (genreMovies['action'] || []);
      case 'comedy':
        return comedyMovies.length > 0 ? comedyMovies : (genreMovies['comedy'] || []);
      case 'drama':
        return dramaMovies.length > 0 ? dramaMovies : (genreMovies['drama'] || []);
      case 'horror':
        return horrorMovies.length > 0 ? horrorMovies : (genreMovies['horror'] || []);
      case 'romance':
        return romanceMovies.length > 0 ? romanceMovies : (genreMovies['romance'] || []);
      case 'sci-fi':
        return sciFiMovies.length > 0 ? sciFiMovies : (genreMovies['sci-fi'] || []);
      case 'thriller':
        return thrillerMovies.length > 0 ? thrillerMovies : (genreMovies['thriller'] || []);
      default:
        // Try to get from dynamic genre movies map
        if (genreMovies[category]) {
          return genreMovies[category];
        }
        return movies;
    }
  };

  const currentCategoryPage = selectedCategory ? categoryPages[selectedCategory] || 1 : 1;
  const currentCategoryTotalPages = selectedCategory
    ? Math.max(1, Math.ceil((categoryTotals[selectedCategory] || 0) / 20))
    : 1;


  const handlePlayMovie = (movie: Movie) => {
    trackEvent({
      eventType: 'movie_play',
      path: '/movies',
      contentType: 'movie',
      contentId: movie._id,
      metadata: {
        title: movie.title,
        source: 'movies_page',
        category: selectedCategory || 'featured'
      }
    });
    navigate(moviePath(movie));
  };
  
  const handleMovieDetail = (movie: Movie) => {
    navigate(moviePath(movie));
  };

  // Fetch watch history for movies
  useEffect(() => {
    const fetchWatchHistory = async () => {
      if (!user) return;
      
      try {
        const response = await api.get('/api/history/recent?limit=1000');
        const historyData = response.data?.recent || response.data || [];
        const historyMap: {[key: string]: { lastPosition: number; completed: boolean }} = {};
        
        (Array.isArray(historyData) ? historyData : []).forEach((item: any) => {
          if (item.movie?._id) {
            historyMap[item.movie._id] = {
              lastPosition: item.lastPosition || 0,
              completed: item.completed || false
            };
          }
        });
        
        setWatchHistory(historyMap);
      } catch (error) {
        // Silently fail - watch history is optional
      }
    };

    fetchWatchHistory();
  }, [user]);

  // Fetch user's watchlist
  useEffect(() => {
    const fetchWatchlist = async () => {
      if (!user) {
        setWatchlist([]);
        return;
      }
      
      try {
        const response = await api.get('/api/watchlist');
        const watchlistItems = response.data.watchlist || [];
        const movieIds = watchlistItems
          .filter((item: any) => item.type === 'movie' && (item.movie?._id || item.tmdbId))
          .map((item: any) => item.movie?._id || `tmdb_${item.tmdbId}`);
        setWatchlist(movieIds);
      } catch (error) {
      }
    };

    fetchWatchlist();
  }, [user]);

  // Fetch user's favorites
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavorites([]);
        return;
      }
      
      try {
        const response = await api.get('/api/watchlist/favorites');
        const favoriteItems = response.data.favorites || [];
        const movieIds = favoriteItems
          .filter((item: any) => item.type === 'movie' && (item.movie?._id || item.tmdbId))
          .map((item: any) => item.movie?._id || `tmdb_${item.tmdbId}`);
        setFavorites(movieIds);
      } catch (error) {
        // Silently fail - favorites are optional
      }
    };

    fetchFavorites();
  }, [user]);

  useEffect(() => {
    const onResize = () => {
      Object.keys(rowRefs.current).forEach((key) => updateRowNav(key));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateRowNav]);

  // Handle add to watchlist
  const handleAddToWatchlist = async (movie: Movie) => {
    if (!user) {
      showToast('Please log in to add movies to your watchlist', 'error');
      return;
    }
    
    try {
      const movieId = movie._id || `tmdb_${movie.tmdbId}`;
      await api.post(`/api/movies/${movie._id || movie.tmdbId}/watchlist`);
      setWatchlist(prev => [...prev, movieId]);
      showToast(`"${movie.title}" added to watchlist!`, 'success');
      trackEvent({
        eventType: 'watchlist_add',
        path: '/movies',
        contentType: 'movie',
        contentId: movie._id || movie.tmdbId,
        metadata: {
          title: movie.title,
          source: 'movies_page'
        }
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        showToast('Please log in to add movies to your watchlist', 'error');
      } else if (error.response?.status === 400) {
        showToast('This movie is already in your watchlist!', 'error');
      } else {
        showToast('Failed to add movie to watchlist. Please try again.', 'error');
      }
      throw error;
    }
  };

  // Handle remove from watchlist
  const handleRemoveFromWatchlist = async (movie: Movie) => {
    if (!user) {
      showToast('Please log in to manage your watchlist', 'error');
      return;
    }
    
    try {
      const movieId = movie._id || `tmdb_${movie.tmdbId}`;
      await api.delete(`/api/movies/${movie._id || movie.tmdbId}/watchlist`);
      setWatchlist(prev => prev.filter(id => id !== movieId));
      showToast(`"${movie.title}" removed from watchlist!`, 'success');
      trackEvent({
        eventType: 'watchlist_remove',
        path: '/movies',
        contentType: 'movie',
        contentId: movie._id || movie.tmdbId,
        metadata: {
          title: movie.title,
          source: 'movies_page'
        }
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        showToast('Please log in to manage your watchlist', 'error');
      } else {
        showToast('Failed to remove movie from watchlist. Please try again.', 'error');
      }
      throw error;
    }
  };

  // Handle toggle favorite
  const handleToggleFavorite = async (movie: Movie) => {
    if (!user) {
      showToast('Please log in to manage your favorites', 'error');
      return;
    }
    
    try {
      const movieId = movie._id || `tmdb_${movie.tmdbId}`;
      const isCurrentlyFavorite = favorites.includes(movieId);
      
      await api.post(`/api/watchlist/movies/${movie._id || movie.tmdbId}/favorite`);
      
      if (isCurrentlyFavorite) {
        setFavorites(prev => prev.filter(id => id !== movieId));
        showToast(`"${movie.title}" removed from favorites!`, 'success');
      } else {
        setFavorites(prev => [...prev, movieId]);
        showToast(`"${movie.title}" added to favorites!`, 'success');
      }
      
      trackEvent({
        eventType: isCurrentlyFavorite ? 'favorite_remove' : 'favorite_add',
        path: '/movies',
        contentType: 'movie',
        contentId: movie._id || movie.tmdbId,
        metadata: {
          title: movie.title,
          source: 'movies_page'
        }
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        showToast('Please log in to manage your favorites', 'error');
      } else {
        showToast('Failed to update favorites. Please try again.', 'error');
      }
      throw error;
    }
  };

  // Load more movies for a specific category with smart loading
  const loadMoreMovies = async (category: string) => {
    // Check if already loading this category
    if (loadingStates[category]) {
      return;
    }

    const newPage = categoryPages[category] + 1;
    const totalPages = Math.ceil((categoryTotals[category] || 0) / 20);
    
    // Check if we've reached the maximum pages
    if (newPage > totalPages) {
      return;
    }

    // Set loading state for this category
    setLoadingStates(prev => ({ ...prev, [category]: true }));
    setCategoryPages(prev => ({ ...prev, [category]: newPage }));
    
    try {
      await fetchCategoryMovies(category, newPage, true);
    } catch (error) {
    } finally {
      // Clear loading state for this category
      setLoadingStates(prev => ({ ...prev, [category]: false }));
    }
  };

  // Smart infinite scroll handler for horizontal sections
  const handleScroll = (e: React.UIEvent<HTMLDivElement>, category: string) => {
    const element = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    
    // Calculate scroll percentage
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
    const isNearEnd = scrollPercentage >= 0.8; // Trigger at 80% scroll
    
    // Throttle scroll events (only allow one per 500ms per category)
    const now = Date.now();
    const lastTime = lastScrollTime[category] || 0;
    if (now - lastTime < 500) {
      return;
    }
    setLastScrollTime(prev => ({ ...prev, [category]: now }));
    
    // Check if we're already loading this specific category to prevent multiple requests
    if (loadingStates[category]) {
      return;
    }
    
    // Check if user has scrolled near the end
    if (isNearEnd) {
      // Get current movies and totals
      let currentMovies: Movie[] = [];
      const totalMovies = categoryTotals[category] || 0;
      
      switch (category) {
        case 'trending':
          currentMovies = trendingMovies;
          break;
        case 'popular':
          currentMovies = popularMovies;
          break;
        case 'topRated':
          currentMovies = topRatedMovies;
          break;
        case 'upcoming':
          currentMovies = upcomingMovies;
          break;
        default:
          return;
      }
      
      // Smart loading conditions
      const hasMoreMovies = currentMovies.length < totalMovies;
      const hasReasonableAmount = currentMovies.length >= 20; // Ensure we have some content
      const isNotAtMaxPages = categoryPages[category] < Math.ceil(totalMovies / 20);
      
      if (hasMoreMovies && hasReasonableAmount && isNotAtMaxPages) {
        loadMoreMovies(category);
      }
    }
  };

  // Smart infinite scroll handler for genre sections
  const handleGenreScroll = (e: React.UIEvent<HTMLDivElement>, genreName: string) => {
    const element = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    
    // Calculate scroll percentage
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
    const isNearEnd = scrollPercentage >= 0.8; // Trigger at 80% scroll
    
    // Throttle scroll events (only allow one per 500ms per genre)
    const now = Date.now();
    const lastTime = lastScrollTime[genreName] || 0;
    if (now - lastTime < 500) {
      return;
    }
    setLastScrollTime(prev => ({ ...prev, [genreName]: now }));
    
    // Check if we're already loading this specific genre to prevent multiple requests
    if (loadingStates[genreName]) {
      return;
    }
    
    // Check if user has scrolled near the end
    if (isNearEnd) {
      const genreKeyMap: {[key: string]: string} = {
        Action: 'action',
        Comedy: 'comedy',
        Drama: 'drama',
        Horror: 'horror',
        Romance: 'romance',
        'Science Fiction': 'sci-fi',
        Thriller: 'thriller'
      };
      
      const genreKey = genreKeyMap[genreName];
      if (genreKey) {
        let currentMovies: Movie[] = [];
        const totalMovies = categoryTotals[genreKey] || 0;
        
        switch (genreKey) {
          case 'action':
            currentMovies = actionMovies;
            break;
          case 'comedy':
            currentMovies = comedyMovies;
            break;
          case 'drama':
            currentMovies = dramaMovies;
            break;
          case 'horror':
            currentMovies = horrorMovies;
            break;
          case 'romance':
            currentMovies = romanceMovies;
            break;
      case 'sci-fi':
            currentMovies = sciFiMovies;
            break;
          case 'thriller':
            currentMovies = thrillerMovies;
            break;
          default:
            return;
        }
        
        // Smart loading conditions
        const hasMoreMovies = currentMovies.length < totalMovies;
        const hasReasonableAmount = currentMovies.length >= 20; // Ensure we have some content
        const isNotAtMaxPages = genrePages[genreKey] < Math.ceil(totalMovies / 20);
        
        if (hasMoreMovies && hasReasonableAmount && isNotAtMaxPages) {
          loadMoreGenreMovies(genreName);
        }
      }
    }
  };



  return (
    <div className="min-h-screen bg-black">

   
     

    

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Search Results */}
        {isSearching && searchQuery && (
          <SearchResults
            query={searchQuery}
            filters={searchFilters}
            onPlay={handlePlayMovie}
            onFilterChange={(newFilters) => setSearchFilters(prev => ({ ...prev, ...newFilters }))}
          />
        )}

        {/* Category-specific content or general categories */}
        {!isSearching && selectedCategory ? (
          <div className="space-y-6 sm:space-y-8">
            {/* Category Header */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent capitalize">
                  {formatCategoryLabel(selectedCategory)} Movies
                </h2>
                <div className="w-8 sm:w-12 md:w-16 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
              </div>
              <p className="text-gray-400 text-sm sm:text-base md:text-lg">
                {getCategoryMovies(selectedCategory).length} movies available
              </p>
            </div>

            {/* Category Movies Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
              {categoryLoading ? (
                Array.from({ length: 20 }).map((_, index) => (
                  <MovieCardSkeleton key={index} />
                ))
              ) : getCategoryMovies(selectedCategory).length > 0 ? (
                getCategoryMovies(selectedCategory).map((movie) => (
                  <MovieCard
                    key={movie._id}
                    movie={movie}
                    onPlay={handlePlayMovie}
                    onDetail={handleMovieDetail}
                    onAddToWatchlist={handleAddToWatchlist}
                    onRemoveFromWatchlist={handleRemoveFromWatchlist}
                    isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                    isFavorite={movie._id ? favorites.includes(movie._id) : (movie.tmdbId ? favorites.includes(`tmdb_${movie.tmdbId}`) : false)}
                    onToggleFavorite={handleToggleFavorite}
                    isLoading={loadingMovieId === movie._id}
                    isDetailLoading={false}
                    watchHistory={watchHistory[movie._id]}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-400 text-lg">No movies found in this category</p>
          </div>
              )}
            </div>

            {/* Pagination for Category Pages */}
            {getCategoryMovies(selectedCategory).length > 0 && (
              <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-6 sm:mt-8">
                <Button
                  onClick={async () => {
                    const currentPage = categoryPages[selectedCategory] || 1;
                    const newPage = currentPage - 1;
                    if (newPage >= 1) {
                      setCategoryPages(prev => ({ ...prev, [selectedCategory]: newPage }));
                      setCategoryLoading(true);
                      
                      // Scroll to top smoothly
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      
                      // Check if it's a genre-based category
                      if (['action', 'comedy', 'drama', 'horror', 'romance', 'sci-fi', 'thriller'].includes(selectedCategory)) {
        const genreNameMap: {[key: string]: string} = {
          action: 'Action',
          comedy: 'Comedy',
          drama: 'Drama',
          horror: 'Horror',
          romance: 'Romance',
          'sci-fi': 'Science Fiction',
          thriller: 'Thriller'
                        };
                        const genreName = genreNameMap[selectedCategory];
                        if (genreName) {
                          await fetchMoviesByGenre(genreName, newPage, false);
                        }
                      } else {
                        await fetchCategoryMovies(selectedCategory, newPage);
                      }
                    }
                  }}
                  disabled={currentCategoryPage <= 1 || categoryLoading}
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 sm:px-6 py-2"
                >
                  {categoryLoading ? <LoadingSpinner size="sm" /> : 'Previous'}
                </Button>
                
                <span className="text-gray-300 text-xs sm:text-sm">
                  Page {currentCategoryPage} of {currentCategoryTotalPages}
                </span>
                
                <Button
                  onClick={async () => {
                    const currentPage = categoryPages[selectedCategory] || 1;
                    const totalPages = Math.max(1, Math.ceil((categoryTotals[selectedCategory] || 0) / 20));
                    const newPage = currentPage + 1;
                    if (newPage <= totalPages) {
                      setCategoryPages(prev => ({ ...prev, [selectedCategory]: newPage }));
                      setCategoryLoading(true);
                      
                      // Scroll to top smoothly
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      
                      // Check if it's a genre-based category
                      if (['action', 'comedy', 'drama', 'horror', 'romance', 'sci-fi', 'thriller'].includes(selectedCategory)) {
        const genreNameMap: {[key: string]: string} = {
          action: 'Action',
          comedy: 'Comedy',
          drama: 'Drama',
          horror: 'Horror',
          romance: 'Romance',
          'sci-fi': 'Science Fiction',
          thriller: 'Thriller'
                        };
                        const genreName = genreNameMap[selectedCategory];
                        if (genreName) {
                          await fetchMoviesByGenre(genreName, newPage, false);
                        }
                      } else {
                        await fetchCategoryMovies(selectedCategory, newPage);
                      }
                    }
                  }}
                  disabled={currentCategoryPage >= currentCategoryTotalPages || categoryLoading}
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 sm:px-6 py-2"
                >
                  {categoryLoading ? <LoadingSpinner size="sm" /> : 'Next'}
                </Button>
              </div>
            )}
          </div>
        ) : !isSearching && !searchQuery ? (
          <div className="space-y-6 sm:space-y-8">
            {/* Netflix-style Category Sections */}
            {/* Latest Movies - Most Recent First */}
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Latest Movies</h2>
                <div className="w-12 sm:w-16 h-0.5 bg-rose-500/80 rounded-full" aria-hidden />
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('latest', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.latest?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('latest', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.latest?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('latest')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={() => updateRowNav('latest')}
                >
                  {categoryLoading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    (() => {
                      // Combine all movies and deduplicate by _id or tmdbId
                      const allMovies = [...trendingMovies, ...popularMovies, ...topRatedMovies, ...upcomingMovies];
                      const seen = new Set<string>();
                      const uniqueMovies = allMovies.filter(movie => {
                        const id = movie._id || `tmdb_${movie.tmdbId}`;
                        if (seen.has(id)) {
                          return false;
                        }
                        seen.add(id);
                        return true;
                      });
                      
                      return uniqueMovies
                        .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
                        .slice(0, 20)
                        .map((movie, index) => (
                          <MovieCard
                            key={`latest-${movie._id || movie.tmdbId}-${index}`}
                            movie={movie}
                            onPlay={handlePlayMovie}
                            onDetail={handleMovieDetail}
                            onAddToWatchlist={handleAddToWatchlist}
                            onRemoveFromWatchlist={handleRemoveFromWatchlist}
                            isInWatchlist={movie._id ? watchlist.includes(movie._id) : false}
                            isFavorite={movie._id ? favorites.includes(movie._id) : false}
                            onToggleFavorite={handleToggleFavorite}
                            isDetailLoading={false}
                          />
                        ));
                    })()
                  )}
                </div>
              </div>
            </div>

            {/* Trending Now */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Trending Now</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {trendingMovies.length} of {categoryTotals.trending} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('trending', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.trending?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('trending', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.trending?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('trending')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('trending');
                    handleScroll(e, 'trending');
                  }}
                >
                  {categoryLoading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    trendingMovies.map((movie, index) => (
                      <MovieCard
                        key={`trending-${movie._id}-${index}`}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Popular Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Popular Movies</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {popularMovies.length} of {categoryTotals.popular} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('popular', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.popular?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('popular', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.popular?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('popular')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('popular');
                    handleScroll(e, 'popular');
                  }}
                >
                  {categoryLoading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    popularMovies.map((movie, index) => (
                      <MovieCard
                        key={`popular-${movie._id}-${index}`}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Top Rated */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Top Rated</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {topRatedMovies.length} of {categoryTotals.topRated} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('topRated', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.topRated?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('topRated', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.topRated?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('topRated')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('topRated');
                    handleScroll(e, 'topRated');
                  }}
                >
                  {categoryLoading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    topRatedMovies.map((movie, index) => (
                      <MovieCard
                        key={`toprated-${movie._id}-${index}`}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Upcoming</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {upcomingMovies.length} of {categoryTotals.upcoming} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('upcoming', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.upcoming?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('upcoming', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.upcoming?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('upcoming')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('upcoming');
                    handleScroll(e, 'upcoming');
                  }}
                >
                  {categoryLoading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    upcomingMovies.map((movie, index) => (
                      <MovieCard
                        key={`upcoming-${movie._id}-${index}`}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Action Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Action Movies</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {actionMovies.length} of {categoryTotals.action} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('action', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.action?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('action', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.action?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('action')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('action');
                    handleGenreScroll(e, 'Action');
                  }}
                >
                  {genreLoadingFlags['Action'] || actionMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    actionMovies.map((movie, index) => (
                      <MovieCard
                        key={`action-${movie._id}-${index}`}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Comedy Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Comedy Movies</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {comedyMovies.length} of {categoryTotals.comedy} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('comedy', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.comedy?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('comedy', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.comedy?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('comedy')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('comedy');
                    handleGenreScroll(e, 'Comedy');
                  }}
                >
                  {genreLoadingFlags['Comedy'] || comedyMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    comedyMovies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Drama Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Drama Movies</h2>
                <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('drama', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.drama?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('drama', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.drama?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('drama')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('drama');
                    handleGenreScroll(e, 'Drama');
                  }}
                >
                  {genreLoadingFlags['Drama'] || dramaMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    dramaMovies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Horror Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Horror Movies</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {horrorMovies.length} of {categoryTotals.horror} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('horror', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.horror?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('horror', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.horror?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('horror')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('horror');
                    handleGenreScroll(e, 'Horror');
                  }}
                >
                  {genreLoadingFlags['Horror'] || horrorMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    horrorMovies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Romance Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Romance Movies</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {romanceMovies.length} of {categoryTotals.romance} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('romance', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.romance?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('romance', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.romance?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('romance')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('romance');
                    handleGenreScroll(e, 'Romance');
                  }}
                >
                  {genreLoadingFlags['Romance'] || romanceMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    romanceMovies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
                </div>
              </div>
              
            {/* Science Fiction Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Science Fiction</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {sciFiMovies.length} of {categoryTotals['sci-fi']} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('sci-fi', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState['sci-fi']?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('sci-fi', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState['sci-fi']?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('sci-fi')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('sci-fi');
                    handleGenreScroll(e, 'Science Fiction');
                  }}
                >
                  {genreLoadingFlags['Science Fiction'] || sciFiMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    sciFiMovies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Thriller Movies */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Thriller Movies</h2>
                  <div className="w-8 sm:w-12 h-0.5 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {thrillerMovies.length} of {categoryTotals.thriller} movies
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => scrollRowBy('thriller', 'left')}
                  className={`absolute left-0 sm:left-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.thriller?.canLeft ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRowBy('thriller', 'right')}
                  className={`absolute right-0 sm:right-1 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center bg-transparent p-2 sm:p-3 text-white transition [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.95))] ${
                    rowNavState.thriller?.canRight ? 'cursor-pointer opacity-100 hover:opacity-90' : 'pointer-events-none opacity-40'
                  }`}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
                </button>
                <div
                  ref={setRowRef('thriller')}
                  className="flex overflow-x-auto scrollbar-hide space-x-3 sm:space-x-4 pb-4 snap-x snap-mandatory scroll-smooth"
                  onScroll={(e) => {
                    updateRowNav('thriller');
                    handleGenreScroll(e, 'Thriller');
                  }}
                >
                  {genreLoadingFlags['Thriller'] || thrillerMovies.length === 0 ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <div key={index} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
                        <MovieCardSkeleton />
                      </div>
                    ))
                  ) : (
                    thrillerMovies.map((movie) => (
                      <MovieCard
                        key={movie._id}
                        movie={movie}
                        onPlay={handlePlayMovie}
                        onDetail={handleMovieDetail}
                        onAddToWatchlist={handleAddToWatchlist}
                        onRemoveFromWatchlist={handleRemoveFromWatchlist}
                        isInWatchlist={movie._id ? watchlist.includes(movie._id) : (movie.tmdbId ? watchlist.includes(`tmdb_${movie.tmdbId}`) : false)}
                        isLoading={loadingMovieId === movie._id}
                        isDetailLoading={false}
                        watchHistory={watchHistory[movie._id]}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>


          </div>
        ) : null}

      </div>

      {/* Play Modal */}
      {selectedMovieToPlay && (
        <MoviePlayModal
          movie={selectedMovieToPlay}
          onClose={() => setSelectedMovieToPlay(null)}
          onAddToWatchlist={handleAddToWatchlist}
          onRemoveFromWatchlist={handleRemoveFromWatchlist}
          isInWatchlist={
            selectedMovieToPlay._id
              ? watchlist.includes(selectedMovieToPlay._id)
              : selectedMovieToPlay.tmdbId
              ? watchlist.includes(`tmdb_${selectedMovieToPlay.tmdbId}`)
              : false
          }
          autoPlay={true}
        />
      )}
    </div>
  );
};

export default MoviesPage;
