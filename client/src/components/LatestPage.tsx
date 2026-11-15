import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MovieCard from './MovieCard';
import TvShowCard from './TvShowCard';
import MovieCardSkeleton from './MovieCardSkeleton';
import MoviePlayModal from './MoviePlayModal';
import TvShowPlayModal from './TvShowPlayModal';
import LoadingSpinner from './LoadingSpinner';
import { trackEvent } from '../utils/activityTracker';
import { moviePath, tvShowPath } from '../utils/paths';

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
}

interface TvShow {
  _id: string;
  name: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate: string;
  voteAverage: number;
  genres: Array<{ name: string }>;
  overview?: string;
  streamingUrl?: string;
  vidsrcUrl?: string;
}

const LatestPage: React.FC = () => {
  const navigate = useNavigate();
  // State for each section - Movies
  const [newTodayMovies, setNewTodayMovies] = useState<Movie[]>([]);
  const [comingThisWeekMovies, setComingThisWeekMovies] = useState<Movie[]>([]);
  const [comingNextWeekMovies, setComingNextWeekMovies] = useState<Movie[]>([]);
  const [worthTheWaitMovies, setWorthTheWaitMovies] = useState<Movie[]>([]);
  
  // State for each section - TV Shows
  const [newTodayTvShows, setNewTodayTvShows] = useState<TvShow[]>([]);
  const [comingThisWeekTvShows, setComingThisWeekTvShows] = useState<TvShow[]>([]);
  const [comingNextWeekTvShows, setComingNextWeekTvShows] = useState<TvShow[]>([]);
  const [worthTheWaitTvShows, setWorthTheWaitTvShows] = useState<TvShow[]>([]);

  // Selected item to play in modal
  const [selectedMovieToPlay, setSelectedMovieToPlay] = useState<Movie | null>(null);
  const [selectedTvShowToPlay, setSelectedTvShowToPlay] = useState<TvShow | null>(null);
  
  // Pagination state
  const [newTodayPage, setNewTodayPage] = useState(1);
  const [comingThisWeekPage, setComingThisWeekPage] = useState(1);
  const [comingNextWeekPage, setComingNextWeekPage] = useState(1);
  const [worthTheWaitPage, setWorthTheWaitPage] = useState(1);
  
  const [newTodayTotalPages, setNewTodayTotalPages] = useState(1);
  const [comingThisWeekTotalPages, setComingThisWeekTotalPages] = useState(1);
  const [comingNextWeekTotalPages, setComingNextWeekTotalPages] = useState(1);
  const [worthTheWaitTotalPages, setWorthTheWaitTotalPages] = useState(1);
  
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const sectionScrollTimes = useRef<{[key: string]: number}>({});
  const isLoadingRef = useRef<{[key: string]: boolean}>({});
  
  // Filter state for New Today section
  const [newTodayFilter, setNewTodayFilter] = useState<'all' | 'top' | 'country'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  
  const TOP_COUNTRIES = [
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

  // Helper to get date ranges
  const getDateRanges = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeekStart = new Date(today);
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
    
    const nextWeekStart = new Date(thisWeekEnd);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    
    return {
      today: today.toISOString().split('T')[0],
      thisWeekStart: thisWeekStart.toISOString().split('T')[0],
      thisWeekEnd: thisWeekEnd.toISOString().split('T')[0],
      nextWeekStart: nextWeekStart.toISOString().split('T')[0],
      nextWeekEnd: nextWeekEnd.toISOString().split('T')[0]
    };
  };

  // Fetch New Today movies - all movies released today, sorted by rating (highest first)
  const fetchNewToday = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['newToday']) return;
    isLoadingRef.current['newToday'] = true;
    setLoadingStates(prev => ({ ...prev, newToday: true }));
    try {
      const { today } = getDateRanges();
      
      // Build params based on filter
      const params: any = {
        page,
        limit: 100, // Fetch more to filter client-side
        releaseDateGte: today,
        releaseDateLte: today
      };
      
      // Apply filters
      if (newTodayFilter === 'top') {
        // Top-rated: sort by rating, filter for 7.0+
        params.sortBy = 'voteAverage';
        params.order = 'desc';
      } else if (newTodayFilter === 'country' && selectedCountry) {
        // Country filter: fetch from movies endpoint with country filter
        // Show recent movies from the selected country (last 30 days, prioritizing today)
        const countryResponse = await api.get('/api/movies', {
          params: {
            page,
            limit: 100,
            country: selectedCountry,
            sortBy: 'releaseDate',
            order: 'desc'
          }
        });
        
        const allCountryMovies = countryResponse.data.movies || [];
        const todayStr = today;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        // Filter for movies with poster images released in the last 30 days
        // Prioritize movies released today
        const filtered = allCountryMovies
          .filter((movie: Movie) => {
            if (!movie.releaseDate || !movie.posterPath) return false;
            const releaseDate = new Date(movie.releaseDate).toISOString().split('T')[0];
            return releaseDate >= thirtyDaysAgoStr && releaseDate <= todayStr;
          })
          .sort((a: Movie, b: Movie) => {
            // Sort: today's releases first, then by release date (newest first)
            const aDate = new Date(a.releaseDate).toISOString().split('T')[0];
            const bDate = new Date(b.releaseDate).toISOString().split('T')[0];
            const aIsToday = aDate === todayStr;
            const bIsToday = bDate === todayStr;
            
            if (aIsToday && !bIsToday) return -1;
            if (!aIsToday && bIsToday) return 1;
            return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
          });
        
        if (append) {
          setNewTodayMovies(prev => [...prev, ...filtered]);
        } else {
          setNewTodayMovies(filtered);
        }
        setNewTodayTotalPages(countryResponse.data.totalPages || 1);
        setNewTodayPage(page);
        isLoadingRef.current['newToday'] = false;
        setLoadingStates(prev => ({ ...prev, newToday: false }));
        return;
      } else {
        // All: sort by rating (highest first)
        params.sortBy = 'voteAverage';
        params.order = 'desc';
      }
      
      const response = await api.get('/api/movies/by-date-range', { params });
      
      let allMovies = response.data.movies || [];
      
      // Apply client-side filters
      if (newTodayFilter === 'top') {
        // Filter for top-rated movies (7.0+)
        allMovies = allMovies.filter((movie: Movie) => movie.voteAverage >= 7.0);
      }
      
      // Filter for movies with poster images only
      const moviesWithImages = allMovies.filter((movie: Movie) => !!movie.posterPath);
      
      if (append) {
        setNewTodayMovies(prev => [...prev, ...moviesWithImages]);
      } else {
        setNewTodayMovies(moviesWithImages);
      }
      setNewTodayTotalPages(response.data.totalPages || 1);
      setNewTodayPage(page);
    } catch (error) {
    } finally {
      isLoadingRef.current['newToday'] = false;
      setLoadingStates(prev => ({ ...prev, newToday: false }));
    }
  }, [newTodayFilter, selectedCountry]);

  // Fetch Coming This Week movies - next 7 days (using TMDB release dates)
  const fetchComingThisWeek = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['comingThisWeek']) return;
    isLoadingRef.current['comingThisWeek'] = true;
    setLoadingStates(prev => ({ ...prev, comingThisWeek: true }));
    try {
      const { thisWeekStart, thisWeekEnd } = getDateRanges();
      // Use TMDB date filtering - movies releasing this week
      const response = await api.get('/api/movies/by-date-range', {
        params: {
          page,
          limit: 100, // Fetch more to filter
          releaseDateGte: thisWeekStart,
          releaseDateLte: thisWeekEnd,
          sortBy: 'releaseDate',
          order: 'asc'
        }
      });
      
      let movies = (response.data.movies || []).filter(
        (movie: Movie) => !!movie.posterPath
      );
      
      // If no results from date filter, use upcoming movies as fallback
      if (movies.length === 0 && !append) {
        const fallbackResponse = await api.get('/api/movies/upcoming', {
          params: { page, limit: 20 }
        });
        const allUpcoming = fallbackResponse.data.movies || [];
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        movies = allUpcoming.filter((movie: Movie) => {
          if (!movie.posterPath || !movie.releaseDate) return false;
          const releaseDate = new Date(movie.releaseDate);
          return releaseDate > today && releaseDate <= weekEnd;
        });
      }
      
      if (append) {
        setComingThisWeekMovies(prev => [...prev, ...movies]);
      } else {
        setComingThisWeekMovies(movies);
      }
      setComingThisWeekTotalPages(response.data.totalPages || 1);
      setComingThisWeekPage(page);
    } catch (error) {
      console.error('Error fetching Coming This Week:', error);
      // Fallback: if date filtering fails, try fetching upcoming movies
      try {
        const fallbackResponse = await api.get('/api/movies/upcoming', {
          params: { page, limit: 20 }
        });
        const fallbackMovies = (fallbackResponse.data.movies || []).filter(
          (movie: Movie) => !!movie.posterPath
        );
        if (append) {
          setComingThisWeekMovies(prev => [...prev, ...fallbackMovies]);
        } else {
          setComingThisWeekMovies(fallbackMovies);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      isLoadingRef.current['comingThisWeek'] = false;
      setLoadingStates(prev => ({ ...prev, comingThisWeek: false }));
    }
  }, []);

  // Fetch Coming Next Week movies - 7-14 days from now (using TMDB release dates)
  const fetchComingNextWeek = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['comingNextWeek']) return;
    isLoadingRef.current['comingNextWeek'] = true;
    setLoadingStates(prev => ({ ...prev, comingNextWeek: true }));
    try {
      const { nextWeekStart, nextWeekEnd } = getDateRanges();
      // Use TMDB date filtering - movies releasing next week
      const response = await api.get('/api/movies/by-date-range', {
        params: {
          page,
          limit: 100, // Fetch more to filter
          releaseDateGte: nextWeekStart,
          releaseDateLte: nextWeekEnd,
          sortBy: 'releaseDate',
          order: 'asc'
        }
      });
      
      let movies = (response.data.movies || []).filter(
        (movie: Movie) => !!movie.posterPath
      );
      
      // If no results from date filter, use upcoming movies as fallback
      if (movies.length === 0 && !append) {
        const fallbackResponse = await api.get('/api/movies/upcoming', {
          params: { page, limit: 20 }
        });
        const allUpcoming = fallbackResponse.data.movies || [];
        const today = new Date();
        const nextWeekStartDate = new Date(today);
        nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 7);
        const nextWeekEndDate = new Date(today);
        nextWeekEndDate.setDate(nextWeekEndDate.getDate() + 14);
        
        movies = allUpcoming.filter((movie: Movie) => {
          if (!movie.posterPath || !movie.releaseDate) return false;
          const releaseDate = new Date(movie.releaseDate);
          return releaseDate > nextWeekStartDate && releaseDate <= nextWeekEndDate;
        });
      }
      
      if (append) {
        setComingNextWeekMovies(prev => [...prev, ...movies]);
      } else {
        setComingNextWeekMovies(movies);
      }
      setComingNextWeekTotalPages(response.data.totalPages || 1);
      setComingNextWeekPage(page);
    } catch (error) {
      console.error('Error fetching Coming Next Week:', error);
      // Fallback: if date filtering fails, try fetching upcoming movies
      try {
        const fallbackResponse = await api.get('/api/movies/upcoming', {
          params: { page, limit: 20 }
        });
        const fallbackMovies = (fallbackResponse.data.movies || []).filter(
          (movie: Movie) => !!movie.posterPath
        );
        if (append) {
          setComingNextWeekMovies(prev => [...prev, ...fallbackMovies]);
        } else {
          setComingNextWeekMovies(fallbackMovies);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      isLoadingRef.current['comingNextWeek'] = false;
      setLoadingStates(prev => ({ ...prev, comingNextWeek: false }));
    }
  }, []);

  // Fetch Worth the Wait - Expert calculated: High-rated upcoming movies from TMDB
  // Uses TMDB release dates and filters for upcoming movies with high ratings
  const fetchWorthTheWait = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['worthTheWait']) return;
    isLoadingRef.current['worthTheWait'] = true;
    setLoadingStates(prev => ({ ...prev, worthTheWait: true }));
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Fetch upcoming movies from TMDB (future releases) sorted by vote average
      // Filter for movies with vote average >= 7.5 (high-rated upcoming)
      const response = await api.get('/api/movies/by-date-range', {
        params: {
          page,
          limit: 100, // Fetch more to filter
          releaseDateGte: todayStr, // Only upcoming movies
          sortBy: 'voteAverage',
          order: 'desc'
        }
      });
      
      let allMovies = response.data.movies || [];
      // Filter for high-rated movies (7.5+) that also have a poster image
      let filtered = allMovies
        .filter((movie: Movie) => movie.voteAverage >= 7.5 && !!movie.posterPath)
        .sort((a: Movie, b: Movie) => {
          // Sort by rating first, then by release date (soonest first)
          if (Math.abs(b.voteAverage - a.voteAverage) > 0.1) {
            return b.voteAverage - a.voteAverage;
          }
          return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
        });
      
      // If no results, use top-rated as fallback
      if (filtered.length === 0 && !append) {
        const fallbackResponse = await api.get('/api/movies/top-rated', {
          params: { page, limit: 20 }
        });
        filtered = (fallbackResponse.data.movies || []).filter(
          (movie: Movie) => movie.voteAverage >= 7.5 && !!movie.posterPath
        );
      }
      
      if (append) {
        setWorthTheWaitMovies(prev => [...prev, ...filtered]);
      } else {
        setWorthTheWaitMovies(filtered);
      }
      setWorthTheWaitTotalPages(response.data.totalPages || 1);
      setWorthTheWaitPage(page);
    } catch (error) {
      console.error('Error fetching Worth the Wait:', error);
      // Fallback: if date filtering fails, try fetching top-rated movies
      try {
        const fallbackResponse = await api.get('/api/movies/top-rated', {
          params: { page, limit: 20 }
        });
        const fallbackMovies = (fallbackResponse.data.movies || []).filter(
          (movie: Movie) => movie.voteAverage >= 7.5 && !!movie.posterPath
        );
        if (append) {
          setWorthTheWaitMovies(prev => [...prev, ...fallbackMovies]);
        } else {
          setWorthTheWaitMovies(fallbackMovies);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      isLoadingRef.current['worthTheWait'] = false;
      setLoadingStates(prev => ({ ...prev, worthTheWait: false }));
    }
  }, []);

  // Fetch New Today TV Shows - Use trending/popular instead of strict date filtering
  const fetchNewTodayTvShows = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['newTodayTv']) return;
    isLoadingRef.current['newTodayTv'] = true;
    setLoadingStates(prev => ({ ...prev, newTodayTv: true }));
    try {
      let allTvShows: TvShow[] = [];
      
      // Handle country filter
      if (newTodayFilter === 'country' && selectedCountry) {
        // Fetch TV shows by country - show recent TV shows from the selected country
        const countryResponse = await api.get('/api/tvshows', {
          params: {
            page,
            limit: 100,
            country: selectedCountry,
            sortBy: 'firstAirDate',
            order: 'desc'
          }
        });
        
        allTvShows = countryResponse.data.tvShows || [];
        
        // Filter for TV shows with poster images
        allTvShows = allTvShows.filter((tvShow: TvShow) => !!tvShow.posterPath);
        
        // Sort by firstAirDate descending (newest first)
        allTvShows = allTvShows.sort((a: TvShow, b: TvShow) => {
          if (!a.firstAirDate || !b.firstAirDate) return 0;
          return new Date(b.firstAirDate).getTime() - new Date(a.firstAirDate).getTime();
        });
        
        if (append) {
          setNewTodayTvShows(prev => [...prev, ...allTvShows]);
        } else {
          setNewTodayTvShows(allTvShows);
        }
        setNewTodayTotalPages(countryResponse.data.totalPages || 1);
        setNewTodayPage(page);
        isLoadingRef.current['newTodayTv'] = false;
        setLoadingStates(prev => ({ ...prev, newTodayTv: false }));
        return;
      }
      
      // Default: Fetch trending TV shows (latest/current) from TMDB
      const response = await api.get('/api/tvshows/trending', {
        params: {
          page,
          limit: 100 // Fetch more to filter
        }
      });
      
      allTvShows = response.data.tvShows || [];
      
      // Filter for TV shows with poster images only
      allTvShows = allTvShows.filter((tvShow: TvShow) => !!tvShow.posterPath);
      
      // Apply rating filter if needed
      let finalTvShows = allTvShows;
      if (newTodayFilter === 'top') {
        finalTvShows = allTvShows.filter((tvShow: TvShow) => tvShow.voteAverage >= 7.0);
      }
      
      // Sort by firstAirDate descending (newest first) if available
      finalTvShows = finalTvShows.sort((a: TvShow, b: TvShow) => {
        if (!a.firstAirDate || !b.firstAirDate) return 0;
        return new Date(b.firstAirDate).getTime() - new Date(a.firstAirDate).getTime();
      });
      
      if (append) {
        setNewTodayTvShows(prev => [...prev, ...finalTvShows]);
      } else {
        setNewTodayTvShows(finalTvShows);
      }
      setNewTodayTotalPages(response.data.totalPages || 1);
      setNewTodayPage(page);
    } catch (error) {
      console.error('Error fetching TV shows:', error);
    } finally {
      isLoadingRef.current['newTodayTv'] = false;
      setLoadingStates(prev => ({ ...prev, newTodayTv: false }));
    }
  }, [newTodayFilter, selectedCountry]);

  // Fetch Coming This Week TV Shows - Smart method: Use trending/popular and filter by firstAirDate
  const fetchComingThisWeekTvShows = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['comingThisWeekTv']) return;
    isLoadingRef.current['comingThisWeekTv'] = true;
    setLoadingStates(prev => ({ ...prev, comingThisWeekTv: true }));
    try {
      getDateRanges(); // ensure date ranges are in sync
      const today = new Date();
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      // Fetch multiple pages of trending/popular TV shows to get enough data
      const [trendingResponse, popularResponse] = await Promise.all([
        api.get('/api/tvshows/trending', { params: { page, limit: 50 } }),
        api.get('/api/tvshows/popular', { params: { page, limit: 50 } })
      ]);
      
      const allTvShows = [
        ...(trendingResponse.data.tvShows || []),
        ...(popularResponse.data.tvShows || [])
      ];
      
      // Remove duplicates by _id
      const uniqueTvShows = Array.from(
        new Map(allTvShows.map((tv: TvShow) => [tv._id, tv])).values()
      );
      
      // Filter for TV shows with poster images and firstAirDate in the next 7 days
      const filtered = uniqueTvShows.filter((tvShow: TvShow) => {
        if (!tvShow.posterPath || !tvShow.firstAirDate) return false;
        const airDate = new Date(tvShow.firstAirDate);
        return airDate > today && airDate <= weekEnd;
      });
      
      // Sort by firstAirDate (soonest first)
      filtered.sort((a: TvShow, b: TvShow) => {
        return new Date(a.firstAirDate).getTime() - new Date(b.firstAirDate).getTime();
      });
      
      // If no results from date filtering and not appending, use trending as fallback
      if (filtered.length === 0 && !append) {
        const fallbackResponse = await api.get('/api/tvshows/trending', {
          params: { page, limit: 20 }
        });
        const fallbackTvShows = (fallbackResponse.data.tvShows || []).filter(
          (tvShow: TvShow) => !!tvShow.posterPath
        );
        setComingThisWeekTvShows(fallbackTvShows);
      } else {
        if (append) {
          setComingThisWeekTvShows(prev => [...prev, ...filtered]);
        } else {
          setComingThisWeekTvShows(filtered);
        }
      }
    } catch (error) {
      console.error('Error fetching Coming This Week TV Shows:', error);
      // Fallback: use trending TV shows
      try {
        const fallbackResponse = await api.get('/api/tvshows/trending', {
          params: { page, limit: 20 }
        });
        const fallbackTvShows = (fallbackResponse.data.tvShows || []).filter(
          (tvShow: TvShow) => !!tvShow.posterPath
        );
        if (append) {
          setComingThisWeekTvShows(prev => [...prev, ...fallbackTvShows]);
        } else {
          setComingThisWeekTvShows(fallbackTvShows);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      isLoadingRef.current['comingThisWeekTv'] = false;
      setLoadingStates(prev => ({ ...prev, comingThisWeekTv: false }));
    }
  }, []);

  // Fetch Coming Next Week TV Shows - Smart method: Use trending/popular and filter by firstAirDate
  const fetchComingNextWeekTvShows = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['comingNextWeekTv']) return;
    isLoadingRef.current['comingNextWeekTv'] = true;
    setLoadingStates(prev => ({ ...prev, comingNextWeekTv: true }));
    try {
      getDateRanges(); // ensure date ranges are in sync
      const today = new Date();
      const nextWeekStartDate = new Date(today);
      nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 7);
      const nextWeekEndDate = new Date(today);
      nextWeekEndDate.setDate(nextWeekEndDate.getDate() + 14);
      
      // Fetch multiple pages of trending/popular TV shows to get enough data
      const [trendingResponse, popularResponse] = await Promise.all([
        api.get('/api/tvshows/trending', { params: { page, limit: 50 } }),
        api.get('/api/tvshows/popular', { params: { page, limit: 50 } })
      ]);
      
      const allTvShows = [
        ...(trendingResponse.data.tvShows || []),
        ...(popularResponse.data.tvShows || [])
      ];
      
      // Remove duplicates by _id
      const uniqueTvShows = Array.from(
        new Map(allTvShows.map((tv: TvShow) => [tv._id, tv])).values()
      );
      
      // Filter for TV shows with poster images and firstAirDate in 7-14 days
      const filtered = uniqueTvShows.filter((tvShow: TvShow) => {
        if (!tvShow.posterPath || !tvShow.firstAirDate) return false;
        const airDate = new Date(tvShow.firstAirDate);
        return airDate > nextWeekStartDate && airDate <= nextWeekEndDate;
      });
      
      // Sort by firstAirDate (soonest first)
      filtered.sort((a: TvShow, b: TvShow) => {
        return new Date(a.firstAirDate).getTime() - new Date(b.firstAirDate).getTime();
      });
      
      // If no results from date filtering and not appending, use trending as fallback
      if (filtered.length === 0 && !append) {
        const fallbackResponse = await api.get('/api/tvshows/trending', {
          params: { page, limit: 20 }
        });
        const fallbackTvShows = (fallbackResponse.data.tvShows || []).filter(
          (tvShow: TvShow) => !!tvShow.posterPath
        );
        setComingNextWeekTvShows(fallbackTvShows);
      } else {
        if (append) {
          setComingNextWeekTvShows(prev => [...prev, ...filtered]);
        } else {
          setComingNextWeekTvShows(filtered);
        }
      }
    } catch (error) {
      console.error('Error fetching Coming Next Week TV Shows:', error);
      // Fallback: use trending TV shows
      try {
        const fallbackResponse = await api.get('/api/tvshows/trending', {
          params: { page, limit: 20 }
        });
        const fallbackTvShows = (fallbackResponse.data.tvShows || []).filter(
          (tvShow: TvShow) => !!tvShow.posterPath
        );
        if (append) {
          setComingNextWeekTvShows(prev => [...prev, ...fallbackTvShows]);
        } else {
          setComingNextWeekTvShows(fallbackTvShows);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      isLoadingRef.current['comingNextWeekTv'] = false;
      setLoadingStates(prev => ({ ...prev, comingNextWeekTv: false }));
    }
  }, []);

  // Fetch Worth the Wait TV Shows - Expert calculated: High-rated upcoming TV shows
  const fetchWorthTheWaitTvShows = useCallback(async (page: number = 1, append: boolean = false) => {
    if (isLoadingRef.current['worthTheWaitTv']) return;
    isLoadingRef.current['worthTheWaitTv'] = true;
    setLoadingStates(prev => ({ ...prev, worthTheWaitTv: true }));
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch top-rated TV shows (high-rated upcoming)
      const [topRatedResponse, trendingResponse] = await Promise.all([
        api.get('/api/tvshows/top-rated', { params: { page, limit: 50 } }),
        api.get('/api/tvshows/trending', { params: { page, limit: 50 } })
      ]);
      
      const allTvShows = [
        ...(topRatedResponse.data.tvShows || []),
        ...(trendingResponse.data.tvShows || [])
      ];
      
      // Remove duplicates by _id
      const uniqueTvShows = Array.from(
        new Map(allTvShows.map((tv: TvShow) => [tv._id, tv])).values()
      );
      
      // Filter for high-rated TV shows (7.5+) with poster images and upcoming air dates
      let filtered = uniqueTvShows
        .filter((tvShow: TvShow) => {
          if (!tvShow.posterPath || !tvShow.firstAirDate) return false;
          if (tvShow.voteAverage < 7.5) return false;
          const airDate = new Date(tvShow.firstAirDate);
          return airDate >= today; // Upcoming or recent
        })
        .sort((a: TvShow, b: TvShow) => {
          // Sort by rating first, then by air date (soonest first)
          if (Math.abs(b.voteAverage - a.voteAverage) > 0.1) {
            return b.voteAverage - a.voteAverage;
          }
          return new Date(a.firstAirDate).getTime() - new Date(b.firstAirDate).getTime();
        });
      
      // If no results from filtering and not appending, use top-rated as fallback
      if (filtered.length === 0 && !append) {
        const fallbackResponse = await api.get('/api/tvshows/top-rated', {
          params: { page, limit: 20 }
        });
        filtered = (fallbackResponse.data.tvShows || []).filter(
          (tvShow: TvShow) => tvShow.voteAverage >= 7.5 && !!tvShow.posterPath
        );
      }
      
      if (append) {
        setWorthTheWaitTvShows(prev => [...prev, ...filtered]);
      } else {
        setWorthTheWaitTvShows(filtered);
      }
    } catch (error) {
      console.error('Error fetching Worth the Wait TV Shows:', error);
      // Fallback: use top-rated TV shows
      try {
        const fallbackResponse = await api.get('/api/tvshows/top-rated', {
          params: { page, limit: 20 }
        });
        const fallbackTvShows = (fallbackResponse.data.tvShows || []).filter(
          (tvShow: TvShow) => tvShow.voteAverage >= 7.5 && !!tvShow.posterPath
        );
        if (append) {
          setWorthTheWaitTvShows(prev => [...prev, ...fallbackTvShows]);
        } else {
          setWorthTheWaitTvShows(fallbackTvShows);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      isLoadingRef.current['worthTheWaitTv'] = false;
      setLoadingStates(prev => ({ ...prev, worthTheWaitTv: false }));
    }
  }, []);

  // Load initial data
  useEffect(() => {
    if (selectedMediaType === 'all' || selectedMediaType === 'movie') {
      fetchNewToday(1, false);
      fetchComingThisWeek(1, false);
      fetchComingNextWeek(1, false);
      fetchWorthTheWait(1, false);
    }
    if (selectedMediaType === 'all' || selectedMediaType === 'tv') {
      fetchNewTodayTvShows(1, false);
      fetchComingThisWeekTvShows(1, false);
      fetchComingNextWeekTvShows(1, false);
      fetchWorthTheWaitTvShows(1, false);
    }
  }, [fetchNewToday, fetchComingThisWeek, fetchComingNextWeek, fetchWorthTheWait, fetchNewTodayTvShows, fetchComingThisWeekTvShows, fetchComingNextWeekTvShows, fetchWorthTheWaitTvShows, selectedMediaType]);
  
  // Refetch New Today when filter changes
  useEffect(() => {
    setNewTodayPage(1);
    if (selectedMediaType === 'all' || selectedMediaType === 'movie') {
      fetchNewToday(1, false);
    }
    if (selectedMediaType === 'all' || selectedMediaType === 'tv') {
      fetchNewTodayTvShows(1, false);
    }
  }, [newTodayFilter, selectedCountry, selectedMediaType, fetchNewToday, fetchNewTodayTvShows]);

  // Horizontal scroll handler
  const handleSectionScroll = (e: React.UIEvent<HTMLDivElement>, section: string) => {
    const element = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
    const isNearEnd = scrollPercentage >= 0.8;

    const now = Date.now();
    const lastTime = sectionScrollTimes.current[section] || 0;
    if (now - lastTime < 500) return;
    sectionScrollTimes.current[section] = now;

    if (isLoadingRef.current[section]) return;

    if (isNearEnd) {
      let currentPage = 1;
      let totalPages = 1;
      let loadMore: () => void;

      switch (section) {
        case 'newToday':
          currentPage = newTodayPage;
          totalPages = newTodayTotalPages;
          loadMore = () => {
            if (selectedMediaType === 'all' || selectedMediaType === 'movie') {
              fetchNewToday(currentPage + 1, true);
            }
            if (selectedMediaType === 'all' || selectedMediaType === 'tv') {
              fetchNewTodayTvShows(currentPage + 1, true);
            }
          };
          break;
        case 'comingThisWeek':
          currentPage = comingThisWeekPage;
          totalPages = comingThisWeekTotalPages;
          loadMore = () => {
            if (selectedMediaType === 'all' || selectedMediaType === 'movie') {
              fetchComingThisWeek(currentPage + 1, true);
            }
            if (selectedMediaType === 'all' || selectedMediaType === 'tv') {
              fetchComingThisWeekTvShows(currentPage + 1, true);
            }
          };
          break;
        case 'comingNextWeek':
          currentPage = comingNextWeekPage;
          totalPages = comingNextWeekTotalPages;
          loadMore = () => {
            if (selectedMediaType === 'all' || selectedMediaType === 'movie') {
              fetchComingNextWeek(currentPage + 1, true);
            }
            if (selectedMediaType === 'all' || selectedMediaType === 'tv') {
              fetchComingNextWeekTvShows(currentPage + 1, true);
            }
          };
          break;
        case 'worthTheWait':
          currentPage = worthTheWaitPage;
          totalPages = worthTheWaitTotalPages;
          loadMore = () => {
            if (selectedMediaType === 'all' || selectedMediaType === 'movie') {
              fetchWorthTheWait(currentPage + 1, true);
            }
            if (selectedMediaType === 'all' || selectedMediaType === 'tv') {
              fetchWorthTheWaitTvShows(currentPage + 1, true);
            }
          };
          break;
        default:
          return;
      }

      // Load more if there are more pages available
      // For TV shows, we'll always try to load more since we filter client-side
      if (currentPage < totalPages) {
        loadMore();
      } else if (section === 'comingThisWeek' || section === 'comingNextWeek' || section === 'worthTheWait') {
        // For TV show sections, try loading more even if movie pages are exhausted
        // This allows loading more TV shows when filtering client-side
        loadMore();
      }
    }
  };

  const handlePlayMovie = (movie: Movie) => {
    trackEvent({
      eventType: 'movie_play',
      path: '/latest',
      contentType: 'movie',
      contentId: movie._id,
      metadata: {
        title: movie.title,
        source: 'latest_page'
      }
    });
    navigate(moviePath(movie));
  };

  const handlePlayTvShow = (tvShow: TvShow) => {
    trackEvent({
      eventType: 'tv_play',
      path: '/latest',
      contentType: 'tvshow',
      contentId: tvShow._id,
      metadata: {
        title: tvShow.name,
        source: 'latest_page'
      }
    });
    navigate(tvShowPath(tvShow as any));
  };

  const renderSection = (
    title: string,
    movies: Movie[],
    sectionKey: string,
    isLoading: boolean,
    showFilters?: boolean,
    tvShows?: TvShow[]
  ) => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>
        <div className="h-[2px] w-16 sm:w-24 bg-red-600"></div>
      </div>
      
      {/* Filter buttons for New Today section */}
      {showFilters && (
        <div className="space-y-2 mt-1">
          {/* Media Type Filter */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'movie', 'tv'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedMediaType(type)}
                className={`px-3 py-1 border rounded-none uppercase tracking-[0.3em] text-xs transition-all ${
                  selectedMediaType === type
                    ? 'bg-white text-black border-white'
                    : 'text-gray-400 border-white/20 hover:text-white'
                }`}
              >
                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
              </button>
            ))}
          </div>
          
          {/* Filter buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setNewTodayFilter('all');
                setSelectedCountry(null);
              }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border rounded-none transition-all ${
                newTodayFilter === 'all' && !selectedCountry
                  ? 'bg-red-600 text-white border-red-500'
                  : 'text-gray-400 border-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              Show All
            </button>
            <button
              onClick={() => {
                setNewTodayFilter('top');
                setSelectedCountry(null);
              }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border rounded-none transition-all ${
                newTodayFilter === 'top' && !selectedCountry
                  ? 'bg-red-600 text-white border-red-500'
                  : 'text-gray-400 border-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              Top
            </button>
            <button
              onClick={() => {
                setNewTodayFilter('country');
                // Auto-select first country if none selected
                if (!selectedCountry) {
                  setSelectedCountry(TOP_COUNTRIES[0].code);
                }
              }}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border rounded-none transition-all ${
                newTodayFilter === 'country'
                  ? 'bg-red-600 text-white border-red-500'
                  : 'text-gray-400 border-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              Top Country
            </button>
            
            {/* Country dropdown when Top Country is selected */}
            {newTodayFilter === 'country' && (
              <>
                {TOP_COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => {
                      setSelectedCountry(country.code);
                    }}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] border rounded-none transition-all ${
                      selectedCountry === country.code
                        ? 'bg-red-600 text-white border-red-500'
                        : 'text-gray-400 border-white/10 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {country.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      
      <div
        className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x snap-mandatory"
        onScroll={(e) => handleSectionScroll(e, sectionKey)}
      >
        {isLoading && movies.length === 0 && (!tvShows || tvShows.length === 0) ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-36 sm:w-40 md:w-44 lg:w-48 xl:w-52 snap-start">
              <MovieCardSkeleton />
            </div>
          ))
        ) : (
          <>
            {/* Show movies if All or Movies selected */}
            {(selectedMediaType === 'all' || selectedMediaType === 'movie') && movies.map((movie) => (
              <MovieCard
                key={movie._id}
                movie={movie}
                onPlay={handlePlayMovie}
              />
            ))}
            {/* Show TV shows if All or TV Shows selected */}
            {tvShows && (selectedMediaType === 'all' || selectedMediaType === 'tv') && tvShows.map((tvShow) => (
              <TvShowCard
                key={tvShow._id}
                tvShow={tvShow}
                onPlay={handlePlayTvShow}
              />
            ))}
            {loadingStates[sectionKey] && (
              <div className="flex-shrink-0 w-40 flex items-center justify-center">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black  pb-12">
      <div className="p-6 overflow-visible">
        <div className="space-y-6">
          {/* New Today */}
          {renderSection(
            'New Today',
            newTodayMovies,
            'newToday',
            loadingStates['newToday'] || loadingStates['newTodayTv'] || false,
            true, // Show filters
            newTodayTvShows // TV shows
          )}

          {/* Coming This Week */}
          {renderSection(
            'Coming This Week',
            comingThisWeekMovies,
            'comingThisWeek',
            loadingStates['comingThisWeek'] || loadingStates['comingThisWeekTv'] || false,
            false, // No filters
            comingThisWeekTvShows // TV shows
          )}

          {/* Coming Next Week */}
          {renderSection(
            'Coming Next Week',
            comingNextWeekMovies,
            'comingNextWeek',
            loadingStates['comingNextWeek'] || loadingStates['comingNextWeekTv'] || false,
            false, // No filters
            comingNextWeekTvShows // TV shows
          )}

          {/* Worth the Wait */}
          {renderSection(
            'Worth the Wait',
            worthTheWaitMovies,
            'worthTheWait',
            loadingStates['worthTheWait'] || loadingStates['worthTheWaitTv'] || false,
            false, // No filters
            worthTheWaitTvShows // TV shows
          )}
        </div>
      </div>

      {/* Play Modals */}
      {selectedMovieToPlay && (
        <MoviePlayModal
          movie={selectedMovieToPlay}
          onClose={() => setSelectedMovieToPlay(null)}
          autoPlay={true}
        />
      )}

      {selectedTvShowToPlay && (
        <TvShowPlayModal
          tvShow={selectedTvShowToPlay}
          onClose={() => setSelectedTvShowToPlay(null)}
          autoPlay={false}
        />
      )}
    </div>
  );
};

export default LatestPage;
