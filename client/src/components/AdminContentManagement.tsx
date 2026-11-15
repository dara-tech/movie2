import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  Film,
  Tv,
  Search,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPagination } from './admin/AdminPagination';
import { AdminEmptyState } from './admin/AdminEmptyState';

interface AdminContentManagementProps {
  contentType?: 'movies' | 'tvshows';
}

interface Movie {
  _id: string;
  title: string;
  overview: string;
  releaseDate: string;
  posterPath: string;
  backdropPath: string;
  genres: Array<{ _id: string; name: string }>;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  isAvailable: boolean;
  vidsrcUrl?: string;
  streamingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface TvShow {
  _id: string;
  name: string;
  originalName?: string;
  overview: string;
  firstAirDate: string;
  lastAirDate?: string;
  posterPath: string;
  backdropPath: string;
  genres: Array<{ _id: string; name: string }>;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  isAvailable: boolean;
  status?: string;
  type?: string;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  streamingUrl?: string;
  vidsrcUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const AdminContentManagement: React.FC<AdminContentManagementProps> = ({ contentType: propContentType }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Determine content type from route or prop
  const getContentTypeFromRoute = (): 'movies' | 'tvshows' => {
    if (location.pathname.includes('/tvshows')) return 'tvshows';
    return 'movies';
  };
  
  const contentType = propContentType || getContentTypeFromRoute();
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [tvShows, setTvShows] = useState<TvShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  const [genres, setGenres] = useState<Array<{ _id: string; name: string }>>([]);

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await api.get('/api/genres');
        // Handle new response format
        const genresData = response.data?.genres || response.data || [];
        setGenres(Array.isArray(genresData) ? genresData : []);
      } catch (error) {
      }
    };
    
    fetchGenres();
  }, []);

  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(genreFilter && { genre: genreFilter }),
        ...(yearFilter && yearFilter !== 'all' && { year: yearFilter }),
        ...(availabilityFilter && { isAvailable: availabilityFilter }),
        sortBy,
        order: sortOrder
      });

      const response = await api.get(`/api/admin/movies?${params}`);
      setMovies(response.data.data.movies);
      setTotalPages(response.data.data.pagination.totalPages);
      setTotalItems(response.data.data.pagination.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch movies');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, genreFilter, yearFilter, availabilityFilter, sortBy, sortOrder]);

  const fetchTvShows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(genreFilter && { genre: genreFilter }),
        ...(yearFilter && yearFilter !== 'all' && { year: yearFilter }),
        ...(availabilityFilter && { isAvailable: availabilityFilter }),
        sortBy,
        order: sortOrder
      });

      const response = await api.get(`/api/admin/tvshows?${params}`);
      
      if (response.data.success && response.data.data) {
        setTvShows(response.data.data.tvShows || []);
        setTotalPages(response.data.data.pagination?.totalPages || 1);
        setTotalItems(response.data.data.pagination?.total || 0);
      } else {
        setError('Invalid response format');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch TV shows');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, genreFilter, yearFilter, availabilityFilter, sortBy, sortOrder]);

  useEffect(() => {
    // Only fetch data if user has admin access
    if (user && ['admin', 'super_admin'].includes(user.role)) {
      if (contentType === 'movies') {
        fetchMovies();
      } else {
        fetchTvShows();
      }
    }
  }, [user, contentType, fetchMovies, fetchTvShows]);

  const toggleMovieAvailability = async (movieId: string, isAvailable: boolean) => {
    try {
      await api.put(`/api/admin/movies/${movieId}/availability`, { isAvailable });
      setMovies(movies.map(movie => 
        movie._id === movieId ? { ...movie, isAvailable } : movie
      ));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update movie availability');
    }
  };

  const deleteMovie = async (movieId: string) => {
    if (!window.confirm('Are you sure you want to delete this movie? This action cannot be undone.')) return;
    
    try {
      await api.delete(`/api/admin/movies/${movieId}`);
      setMovies(movies.filter(movie => movie._id !== movieId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete movie');
    }
  };

  const deleteTvShow = async (tvShowId: string) => {
    if (!window.confirm('Are you sure you want to delete this TV show? This action cannot be undone.')) return;
    
    try {
      await api.delete(`/api/admin/tvshows/${tvShowId}`);
      setTvShows(tvShows.filter(tvShow => tvShow._id !== tvShowId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete TV show');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAvailabilityBadge = (isAvailable: boolean) => {
    return isAvailable ? (
      <span className="sys-badge sys-badge-green">
        <CheckCircle className="h-3 w-3 mr-1" />
        Available
      </span>
    ) : (
      <span className="sys-badge sys-badge-red">
        <XCircle className="h-3 w-3 mr-1" />
        Unavailable
      </span>
    );
  };

  if (loading && movies.length === 0 && tvShows.length === 0) {
    return (
      <LoadingSpinner fullScreen text="Loading content..." color="red" size="lg" />
    );
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Error Message */}
      {error && (
        <div className="sys-toast-notification toast-error relative bottom-auto right-auto mb-2">
          <div className="toast-icon">
            <AlertTriangle size={16} />
          </div>
          <div className="toast-content">
            <span className="toast-text">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Filters and Search Control Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={15} />
            <span>Search & Library Filters</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {totalItems} {contentType === 'movies' ? 'Movies' : 'TV Shows'} Found
          </span>
        </div>
        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="sys-label">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={contentType === 'movies' ? 'Search movies...' : 'Search TV shows...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="sys-label">
                Genre
              </label>
              <Select value={genreFilter || "all"} onValueChange={(value) => setGenreFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Genres" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="all">All Genres</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem 
                      key={genre._id} 
                      value={genre._id}
                    >
                      {genre.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">
                Year
              </label>
              <Select value={yearFilter || "all"} onValueChange={(value) => setYearFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                  <SelectItem value="2021">2021</SelectItem>
                  <SelectItem value="2020">2020</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">
                Availability
              </label>
              <Select value={availabilityFilter || "all"} onValueChange={(value) => setAvailabilityFilter(value === "all" ? "" : value)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Available</SelectItem>
                  <SelectItem value="false">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">
                Sort By
              </label>
              <Select 
                value={`${sortBy}-${sortOrder}`} 
                onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="title-asc">Title A-Z</SelectItem>
                  <SelectItem value="title-desc">Title Z-A</SelectItem>
                  <SelectItem value="popularity-desc">Most Popular</SelectItem>
                  <SelectItem value="voteAverage-desc">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Catalog Control Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {contentType === 'movies' ? <Film size={16} /> : <Tv size={16} />}
            <span>{contentType === 'movies' ? 'Movies Catalog' : 'TV Shows Catalog'}</span>
          </div>
          <span className="sys-badge sys-badge-green font-mono">
            Page {currentPage} of {totalPages || 1}
          </span>
        </div>

        <div className="ctrl-panel-body p-4">
            {contentType === 'movies' ? (
              movies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                  {movies.map((movie) => (
                    <div key={movie._id} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700/50 overflow-hidden hover:shadow-2xl hover:border-gray-600/50 transition-all duration-300 group transform hover:-translate-y-1">
                      <div className="relative overflow-hidden">
                        <img
                          src={movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : '/placeholder-movie.jpg'}
                          alt={movie.title}
                          className="w-full h-48 sm:h-64 md:h-72 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Full Title Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 sm:p-3 md:p-4">
                          <h4 className="font-bold text-white text-xs sm:text-sm md:text-lg leading-tight line-clamp-2">
                            {movie.title}
                          </h4>
                        </div>
                        
                        {/* Availability Badge - Only show on xl+ */}
                        <div className="absolute top-3 right-3 z-10 hidden xl:block">
                          {getAvailabilityBadge(movie.isAvailable)}
                        </div>
                        
                        {/* Rating Badge - Only show on xl+ */}
                        <div className="absolute top-3 left-3 z-10 hidden xl:block">
                          <div className="flex items-center bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1.5">
                            <Star className="h-3.5 w-3.5 text-yellow-400 fill-current" />
                            <span className="text-xs text-white font-semibold ml-1">
                              {movie.voteAverage.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Hover Overlay with Quick Actions - Only on xl+ */}
                        <div className="hidden xl:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 items-center justify-center">
                          <div className="flex space-x-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <button
                              onClick={() => toggleMovieAvailability(movie._id, !movie.isAvailable)}
                              className={`p-3 rounded-full backdrop-blur-sm transition-all duration-200 ${
                                movie.isAvailable 
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300' 
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300'
                              }`}
                              title={movie.isAvailable ? 'Make Unavailable' : 'Make Available'}
                            >
                              {movie.isAvailable ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                            <button
                              onClick={() => deleteMovie(movie._id)}
                              className="p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 backdrop-blur-sm transition-all duration-200"
                              title="Delete Movie"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Quick Actions - Always visible on mobile/sm/md/lg */}
                        <div className="absolute top-1 right-1 flex flex-col gap-1.5 xl:hidden z-20">
                          <button
                            onClick={() => toggleMovieAvailability(movie._id, !movie.isAvailable)}
                            className={`p-1.5 rounded-full backdrop-blur-sm transition-all duration-200 ${
                              movie.isAvailable 
                                ? 'bg-red-500/40 text-red-200' 
                                : 'bg-green-500/40 text-green-200'
                            }`}
                            aria-label={movie.isAvailable ? 'Make Unavailable' : 'Make Available'}
                          >
                            {movie.isAvailable ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => deleteMovie(movie._id)}
                            className="p-1.5 rounded-full bg-red-500/40 text-red-200 backdrop-blur-sm transition-all duration-200"
                            aria-label="Delete Movie"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Card - Only name and year on mobile/sm/md/lg, full details on xl+ */}
                      <div className="p-2 sm:p-4 md:p-5">
                        {/* Year - Show on all screens up to lg */}
                        <div className="flex items-center text-xs sm:text-sm text-gray-400 mb-2 xl:hidden">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                          <span>{new Date(movie.releaseDate).getFullYear()}</span>
                        </div>
                        
                        {/* Full Details - Only show on xl+ */}
                        <div className="hidden xl:block mb-4">
                          <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1.5" />
                              <span>{new Date(movie.releaseDate).getFullYear()}</span>
                            </div>
                            <div className="text-xs bg-gray-700/50 px-2 py-1 rounded-full">
                              {formatDate(movie.createdAt)}
                            </div>
                          </div>
                        </div>

                        {/* Genres - Only show on xl+ */}
                        <div className="hidden xl:flex flex-wrap gap-1.5 mb-4">
                          {movie.genres.slice(0, 2).map((genre) => (
                            <span
                              key={genre._id}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 text-blue-100 shadow-sm"
                            >
                              {genre.name}
                            </span>
                          ))}
                          {movie.genres.length > 2 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-gray-600 to-gray-700 text-gray-200 shadow-sm">
                              +{movie.genres.length - 2}
                            </span>
                          )}
                        </div>

                        {/* Status Indicator - Only show on xl+ */}
                        <div className="hidden xl:flex items-center justify-between pt-3 border-t border-gray-700/50">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${movie.isAvailable ? 'bg-green-400' : 'bg-red-400'}`} />
                            <span className={`text-xs font-medium ${movie.isAvailable ? 'text-green-400' : 'text-red-400'}`}>
                              {movie.isAvailable ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {movie._id.slice(-6)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  icon={<Film size={28} />}
                  title="No movies found"
                  description="Try adjusting your search query, genre, or availability filter."
                />
              )
            ) : (
              tvShows.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                  {tvShows.map((tvShow) => (
                    <div key={tvShow._id} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg border border-gray-700/50 overflow-hidden hover:shadow-2xl hover:border-gray-600/50 transition-all duration-300 group transform hover:-translate-y-1">
                      <div className="relative overflow-hidden">
                        <img
                          src={tvShow.posterPath ? `https://image.tmdb.org/t/p/w500${tvShow.posterPath}` : '/placeholder-movie.jpg'}
                          alt={tvShow.name}
                          className="w-full h-48 sm:h-64 md:h-72 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Full Title Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 sm:p-3 md:p-4">
                          <h4 className="font-bold text-white text-xs sm:text-sm md:text-lg leading-tight line-clamp-2">
                            {tvShow.name}
                          </h4>
                        </div>
                        
                        {/* Availability Badge - Only show on xl+ */}
                        <div className="absolute top-3 right-3 z-10 hidden xl:block">
                          {getAvailabilityBadge(tvShow.isAvailable)}
                        </div>
                        
                        {/* Rating Badge - Only show on xl+ */}
                        <div className="absolute top-3 left-3 z-10 hidden xl:block">
                          <div className="flex items-center bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1.5">
                            <Star className="h-3.5 w-3.5 text-yellow-400 fill-current" />
                            <span className="text-xs text-white font-semibold ml-1">
                              {tvShow.voteAverage.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Hover Overlay with Quick Actions - Only on xl+ */}
                        <div className="hidden xl:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 items-center justify-center">
                          <div className="flex space-x-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <button
                              onClick={async () => {
                                try {
                                  await api.put(`/api/admin/tvshows/${tvShow._id}/availability`, { isAvailable: !tvShow.isAvailable });
                                  setTvShows(tvShows.map(show => 
                                    show._id === tvShow._id ? { ...show, isAvailable: !show.isAvailable } : show
                                  ));
                                } catch (err: any) {
                                  setError(err.response?.data?.message || 'Failed to update TV show availability');
                                }
                              }}
                              className={`p-3 rounded-full backdrop-blur-sm transition-all duration-200 ${
                                tvShow.isAvailable 
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300' 
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300'
                              }`}
                              title={tvShow.isAvailable ? 'Make Unavailable' : 'Make Available'}
                            >
                              {tvShow.isAvailable ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                            <button
                              onClick={() => deleteTvShow(tvShow._id)}
                              className="p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 backdrop-blur-sm transition-all duration-200"
                              title="Delete TV Show"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Quick Actions - Always visible on mobile/sm/md/lg */}
                        <div className="absolute top-1 right-1 flex flex-col gap-1.5 xl:hidden z-20">
                          <button
                            onClick={async () => {
                              try {
                                await api.put(`/api/admin/tvshows/${tvShow._id}/availability`, { isAvailable: !tvShow.isAvailable });
                                setTvShows(tvShows.map(show => 
                                  show._id === tvShow._id ? { ...show, isAvailable: !show.isAvailable } : show
                                ));
                              } catch (err: any) {
                                setError(err.response?.data?.message || 'Failed to update TV show availability');
                              }
                            }}
                            className={`p-1.5 rounded-full backdrop-blur-sm transition-all duration-200 ${
                              tvShow.isAvailable 
                                ? 'bg-red-500/40 text-red-200' 
                                : 'bg-green-500/40 text-green-200'
                            }`}
                            aria-label={tvShow.isAvailable ? 'Make Unavailable' : 'Make Available'}
                          >
                            {tvShow.isAvailable ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                          <button
                            onClick={() => deleteTvShow(tvShow._id)}
                            className="p-1.5 rounded-full bg-red-500/40 text-red-200 backdrop-blur-sm transition-all duration-200"
                            aria-label="Delete TV Show"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Card - Only name and year on mobile/sm/md/lg, full details on xl+ */}
                      <div className="p-2 sm:p-4 md:p-5">
                        {/* Year - Show on all screens up to lg */}
                        <div className="flex items-center text-xs sm:text-sm text-gray-400 mb-2 xl:hidden">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                          <span>{tvShow.firstAirDate ? new Date(tvShow.firstAirDate).getFullYear() : 'N/A'}</span>
                        </div>
                        
                        {/* Full Details - Only show on xl+ */}
                        <div className="hidden xl:block mb-4">
                          <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1.5" />
                              <span>{tvShow.firstAirDate ? new Date(tvShow.firstAirDate).getFullYear() : 'N/A'}</span>
                            </div>
                            <div className="text-xs bg-gray-700/50 px-2 py-1 rounded-full">
                              {formatDate(tvShow.createdAt)}
                            </div>
                          </div>
                        </div>

                        {/* Genres - Only show on xl+ */}
                        <div className="hidden xl:flex flex-wrap gap-1.5 mb-4">
                          {tvShow.genres.slice(0, 2).map((genre) => (
                            <span
                              key={genre._id}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 text-blue-100 shadow-sm"
                            >
                              {genre.name}
                            </span>
                          ))}
                          {tvShow.genres.length > 2 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-gray-600 to-gray-700 text-gray-200 shadow-sm">
                              +{tvShow.genres.length - 2}
                            </span>
                          )}
                        </div>

                        {/* Status Indicator - Only show on xl+ */}
                        <div className="hidden xl:flex items-center justify-between pt-3 border-t border-gray-700/50">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${tvShow.isAvailable ? 'bg-green-400' : 'bg-red-400'}`} />
                            <span className={`text-xs font-medium ${tvShow.isAvailable ? 'text-green-400' : 'text-red-400'}`}>
                              {tvShow.isAvailable ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {tvShow._id.slice(-6)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  icon={<Tv size={28} />}
                  title="No TV shows found"
                  description="Try adjusting your search query, genre, or availability filter."
                />
              )
            )}
          </div>

          {/* Standardized Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-[var(--sys-border)] bg-[var(--sys-surface)]">
              <AdminPagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
                itemName={contentType === 'movies' ? 'movies' : 'TV shows'}
              />
            </div>
          )}
        </div>
    </div>
  );
};

export default AdminContentManagement;
