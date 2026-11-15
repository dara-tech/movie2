import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { Tag, Edit, Trash2, Search, RefreshCw, AlertTriangle, Calendar, Star, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminPagination } from './admin/AdminPagination';
import { AdminEmptyState } from './admin/AdminEmptyState';

interface Genre {
  _id: string;
  name: string;
  tmdbId?: number;
  createdAt: string;
  updatedAt?: string;
  tvShowCount?: number;
}

const AdminGenreManagement: React.FC = () => {
  const { user } = useAuth();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  
  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [genreToDelete, setGenreToDelete] = useState<Genre | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Sync states
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchGenres = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/genres/with-counts');
      const genresData = response.data?.genres || response.data || [];
      if (Array.isArray(genresData)) {
        setGenres(genresData);
        setTotalPages(Math.ceil(genresData.length / itemsPerPage) || 1);
      } else {
        setError('Invalid response format');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch genres');
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    if (user && ['admin', 'super_admin'].includes(user.role)) {
      fetchGenres();
    }
  }, [user, fetchGenres]);

  const filteredGenres = genres
    .filter(genre =>
      genre.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'tmdbId':
          aValue = a.tmdbId || 0;
          bValue = b.tmdbId || 0;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const paginatedGenres = filteredGenres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setTotalPages(Math.ceil(filteredGenres.length / itemsPerPage) || 1);
  }, [filteredGenres.length, itemsPerPage]);

  const handleDeleteClick = (genre: Genre) => {
    setGenreToDelete(genre);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!genreToDelete) return;
    
    try {
      setDeleting(true);
      await api.delete(`/api/genres/${genreToDelete._id}`);
      setGenres(genres.filter(g => g._id !== genreToDelete._id));
      setDeleteModalOpen(false);
      setGenreToDelete(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete genre');
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncFromTMDB = async () => {
    try {
      setSyncing(true);
      setSyncMessage('Syncing genres from TMDB...');
      setError(null);
      
      await api.post('/api/sync/genres');
      setSyncMessage('Genres synced successfully! Refreshing...');
      
      await fetchGenres();
      
      setTimeout(() => {
        setSyncMessage(null);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync genres from TMDB');
      setSyncMessage(null);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && genres.length === 0) {
    return <LoadingSpinner fullScreen text="Loading genres..." color="blue" size="lg" />;
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Sync / Status Banners */}
      {syncMessage && (
        <div className="p-3 bg-green-900/20 border border-green-500/40 rounded flex items-center gap-2 text-xs text-green-300">
          <RefreshCw size={14} className="animate-spin" />
          <span>{syncMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/40 rounded flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle size={14} />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Filters and Search Control Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="var(--sys-cyan)" />
            <span>Genre Filters &amp; Actions</span>
          </div>
          <button
            type="button"
            onClick={handleSyncFromTMDB}
            disabled={syncing}
            className="sys-btn sys-btn-primary"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync TMDB Genres'}</span>
          </button>
        </div>

        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <div className="sys-label">
                <span>Search Genres</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-[var(--sys-text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="sys-input font-mono pl-9"
                />
              </div>
            </div>

            <div>
              <div className="sys-label">
                <span>Sort Order</span>
              </div>
              <Select 
                value={`${sortBy}-${sortOrder}`} 
                onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-9">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-panel-header)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="tmdbId-asc">TMDB ID Low-High</SelectItem>
                  <SelectItem value="tmdbId-desc">TMDB ID High-Low</SelectItem>
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Genres Grid Control Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={16} />
            <span>Genres Catalog</span>
          </div>
          <span className="sys-badge sys-badge-green font-mono">
            {filteredGenres.length} Genres
          </span>
        </div>

        <div className="ctrl-panel-body p-4">
          {paginatedGenres.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {paginatedGenres.map((genre) => (
                <div 
                  key={genre._id} 
                  className="ctrl-panel p-3 border border-[var(--sys-border)] hover:border-[var(--sys-border-hover)] transition-all group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                      <Tag size={14} />
                    </div>
                    {genre.tmdbId && (
                      <span className="sys-badge font-mono text-[10px]">
                        ID {genre.tmdbId}
                      </span>
                    )}
                  </div>

                  <h4 className="font-semibold text-xs sm:text-sm text-[var(--sys-text)] truncate mb-1">
                    {genre.name}
                  </h4>

                  <div className="text-[11px] text-[var(--sys-text-dim)] flex items-center justify-between mt-2 pt-2 border-t border-[var(--sys-border)]">
                    <span>{genre.tvShowCount || 0} titles</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(genre)}
                      className="text-red-400 hover:text-red-300 p-1 rounded"
                      title="Delete genre"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState
              icon={<Tag size={28} />}
              title="No Genres Found"
              description="No genres match your current search query. Try clicking 'Sync TMDB Genres'."
            />
          )}
        </div>

        {/* Standardized Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[var(--sys-border)] bg-[var(--sys-surface)]">
            <AdminPagination
              currentPage={currentPage}
              totalItems={filteredGenres.length}
              pageSize={itemsPerPage}
              onPageChange={setCurrentPage}
              itemName="genres"
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-[var(--sys-panel-header)] border-[var(--sys-border)] text-[var(--sys-text)]">
          <DialogHeader>
            <DialogTitle>Confirm Delete Genre</DialogTitle>
            <DialogDescription className="text-[var(--sys-text-muted)]">
              Are you sure you want to delete the genre &quot;{genreToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="sys-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="sys-btn sys-btn-danger"
            >
              {deleting ? 'Deleting...' : 'Delete Genre'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGenreManagement;
