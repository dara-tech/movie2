import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { 
  Clock, 
  Search, 
  Trash2, 
  RefreshCw, 
  Film, 
  Tv, 
  CheckCircle, 
  AlertTriangle,
  Play
} from 'lucide-react';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPagination from './admin/AdminPagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface WatchHistoryItem {
  _id: string;
  user: {
    _id: string;
    username: string;
    email: string;
  };
  movie?: {
    _id: string;
    title: string;
    posterPath?: string;
  };
  tvShow?: {
    _id: string;
    name: string;
    posterPath?: string;
  };
  watchedAt: string;
  duration: number;
  completed: boolean;
  lastPosition: number;
  season?: number;
  episode?: number;
}

const AdminHistoryManagement: React.FC = () => {
  const { showToast } = useToast();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [contentFilter, setContentFilter] = useState('all');
  const [cleaningUp, setCleaningUp] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/watchhistory');
      if (response.data.success) {
        setHistory(response.data.data.history || []);
        setTotalCount(response.data.data.pagination?.total || response.data.data.history?.length || 0);
        setSelectedItems(new Set());
      } else {
        showToast('Failed to fetch history', 'error');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch history';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleCleanup = async () => {
    if (!window.confirm('Delete all watch history older than 1 day?')) {
      return;
    }

    try {
      setCleaningUp(true);
      const response = await api.delete('/api/admin/watchhistory/cleanup');
      showToast(`Successfully deleted ${response.data.deletedCount} entries`, 'success');
      setSelectedItems(new Set());
      fetchHistory();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to cleanup history', 'error');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      showToast('Please select items to delete', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedItems.size} selected item(s)?`)) {
      return;
    }

    try {
      setBulkDeleting(true);
      const response = await api.post('/api/admin/watchhistory/bulk-delete', {
        historyIds: Array.from(selectedItems)
      });
      showToast(`Successfully deleted ${response.data.deletedCount} item(s)`, 'success');
      setSelectedItems(new Set());
      fetchHistory();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete items', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const title = item.movie?.title || item.tvShow?.name || '';
        const username = item.user?.username || '';
        if (!title.toLowerCase().includes(search) && !username.toLowerCase().includes(search)) {
          return false;
        }
      }
      if (contentFilter === 'movies' && !item.movie) return false;
      if (contentFilter === 'tvshows' && !item.tvShow) return false;
      return true;
    });
  }, [history, searchTerm, contentFilter]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const pagedHistory = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, page, itemsPerPage]);

  const toggleSelectAll = () => {
    if (selectedItems.size === pagedHistory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pagedHistory.map(h => h._id)));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading && history.length === 0) {
    return <LoadingSpinner fullScreen text="Loading watch history subsystem..." color="blue" size="xl" />;
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Total Events</span>
            <Clock className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">{totalCount}</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">user playback sessions</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Movie Sessions</span>
            <Film className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--sys-cyan)]">
            {history.filter(h => h.movie).length}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">feature streamings</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>TV Episodes</span>
            <Tv className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {history.filter(h => h.tvShow).length}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">episode streamings</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Completed</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {history.filter(h => h.completed).length}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">watched to 90%+</div>
        </div>
      </div>

      {/* Query Filters & Actions */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Playback History Ledger</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="sys-btn sys-btn-danger"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span>Delete Selected ({selectedItems.size})</span>
              </button>
            )}
            <button
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="sys-btn"
              title="Prune watch history older than 1 day"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Prune Old (1d+)</span>
            </button>
            <button
              onClick={fetchHistory}
              className="sys-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="sys-label">Search Context</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search user, movie or show title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="sys-input font-mono pl-7"
                />
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="sys-label">Content Filter</label>
              <Select value={contentFilter} onValueChange={(val) => setContentFilter(val)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Content" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="all">All Content</SelectItem>
                  <SelectItem value="movies">Movies Only</SelectItem>
                  <SelectItem value="tvshows">TV Shows Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-body p-0">
          {filteredHistory.length === 0 ? (
            <AdminEmptyState
              icon={Clock}
              title="No Watch History"
              description="No playback records matched your search or filter parameters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="sys-table">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        checked={pagedHistory.length > 0 && selectedItems.size === pagedHistory.length}
                        onChange={toggleSelectAll}
                        className="rounded-none bg-zinc-900 border-zinc-700"
                      />
                    </th>
                    <th>User</th>
                    <th>Content</th>
                    <th>Completion</th>
                    <th>Watched Duration</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item._id)}
                          onChange={() => toggleItemSelection(item._id)}
                          className="rounded-none bg-zinc-900 border-zinc-700"
                        />
                      </td>
                      <td>
                        <div>
                          <div className="font-semibold text-xs text-zinc-200">{item.user?.username || 'Guest'}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{item.user?.email}</div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {item.movie ? (
                            <>
                              <Film className="w-3.5 h-3.5 text-[var(--sys-cyan)] shrink-0" />
                              <span className="text-xs text-zinc-200">{item.movie.title}</span>
                            </>
                          ) : (
                            <>
                              <Tv className="w-3.5 h-3.5 text-[var(--sys-magenta)] shrink-0" />
                              <span className="text-xs text-zinc-200">
                                {item.tvShow?.name} {item.season && item.episode && `S${item.season} · E${item.episode}`}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        {item.completed ? (
                          <span className="sys-badge sys-badge-green font-mono text-[10px]">
                            <CheckCircle className="w-2.5 h-2.5 mr-1 inline" />
                            Completed
                          </span>
                        ) : (
                          <span className="sys-badge font-mono text-[10px]">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-zinc-300 whitespace-nowrap">
                        {formatDuration(item.duration)}
                      </td>
                      <td className="font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {formatDate(item.watchedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-3 border-t border-zinc-800/80">
              <AdminPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredHistory.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminHistoryManagement;
