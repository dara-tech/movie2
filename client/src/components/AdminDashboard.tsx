import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import {
  MdPeople,
  MdMovie,
  MdTv,
  MdTimeline,
  MdAccessTime,
  MdWarning,
  MdStorage,
  MdSave,
  MdMemory,
  MdArrowUpward,
  MdArrowDownward,
  MdRemove,
} from 'react-icons/md';
import { Bookmark } from 'lucide-react';
import { Card } from './ui/card';

interface DashboardStats {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  content: {
    movies: number;
    tvShows: number;
    newMoviesThisMonth: number;
    /** @deprecated API legacy field; prefer movies */
    cachedMovies?: number;
    /** @deprecated API legacy field; prefer tvShows */
    cachedTvShows?: number;
    source?: string;
    note?: string;
  };
  engagement: {
    watchlists: number;
    watchHistory: number;
  };
  recentUsers: Array<{
    _id: string;
    username: string;
    email: string;
    lastLogin: string;
    createdAt: string;
  }>;
  /** Top titles by how often users added them to watchlists (platform demand). */
  watchlistLeaders: {
    movies: Array<{
      title: string;
      posterPath?: string | null;
      tmdbId?: number | string | null;
      saves: number;
    }>;
    tvShows: Array<{
      title: string;
      posterPath?: string | null;
      tmdbId?: number | string | null;
      saves: number;
    }>;
  };
}

interface SystemHealth {
  database: {
    collections: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
  };
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  nodeVersion: string;
}

const DEFAULT_STATS: DashboardStats = {
  users: {
    total: 0,
    active: 0,
    newThisMonth: 0
  },
  content: {
    movies: 0,
    tvShows: 0,
    newMoviesThisMonth: 0
  },
  engagement: {
    watchlists: 0,
    watchHistory: 0
  },
  recentUsers: [],
  watchlistLeaders: { movies: [], tvShows: [] }
};

const DEFAULT_SYSTEM_HEALTH: SystemHealth = {
  database: {
    collections: 0,
    dataSize: 0,
    storageSize: 0,
    indexes: 0
  },
  uptime: 0,
  memory: {
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0
  },
  nodeVersion: ''
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const [statsResponse, healthResponse] = await Promise.all([
        api.get('/api/admin/dashboard/stats'),
        api.get('/api/admin/system/health')
      ]);
      
      if (statsResponse.data && statsResponse.data.data) {
        const receivedStats = statsResponse.data.data as Partial<DashboardStats>;
        setStats({
          ...DEFAULT_STATS,
          ...receivedStats,
          users: {
            ...DEFAULT_STATS.users,
            ...(receivedStats.users || {})
          },
          content: {
            ...DEFAULT_STATS.content,
            ...(receivedStats.content || {}),
            movies:
              receivedStats.content?.movies ??
              receivedStats.content?.cachedMovies ??
              DEFAULT_STATS.content.movies,
            tvShows:
              receivedStats.content?.tvShows ??
              receivedStats.content?.cachedTvShows ??
              DEFAULT_STATS.content.tvShows,
            newMoviesThisMonth:
              receivedStats.content?.newMoviesThisMonth ?? DEFAULT_STATS.content.newMoviesThisMonth
          },
          engagement: {
            ...DEFAULT_STATS.engagement,
            ...(receivedStats.engagement || {})
          },
          recentUsers: receivedStats.recentUsers || [],
          watchlistLeaders: (() => {
            const wl = receivedStats.watchlistLeaders;
            if (wl) {
              return {
                movies: wl.movies || [],
                tvShows: wl.tvShows || [],
              };
            }
            const legacy = (receivedStats as Partial<DashboardStats> & { popularMovies?: Array<{ title?: string; posterPath?: string; tmdbId?: number | string; watchlistCount?: number; saves?: number }> }).popularMovies;
            if (Array.isArray(legacy) && legacy.length > 0) {
              return {
                movies: legacy.map((m) => ({
                  title: m.title || 'Unknown',
                  posterPath: m.posterPath,
                  tmdbId: m.tmdbId,
                  saves: Number(m.saves ?? m.watchlistCount ?? 0),
                })),
                tvShows: [],
              };
            }
            return DEFAULT_STATS.watchlistLeaders;
          })(),
        });
      }
      
      if (healthResponse.data && healthResponse.data.data) {
        const receivedHealth = healthResponse.data.data as Partial<SystemHealth>;
        setSystemHealth({
          ...DEFAULT_SYSTEM_HEALTH,
          ...receivedHealth,
          database: {
            ...DEFAULT_SYSTEM_HEALTH.database,
            ...(receivedHealth?.database || {})
          },
          memory: {
            ...DEFAULT_SYSTEM_HEALTH.memory,
            ...(receivedHealth?.memory || {})
          }
        });
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch dashboard data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const canAccess = !!user && ['admin', 'super_admin'].includes(user.role);
    setHasAccess(canAccess);

    if (canAccess) {
      fetchDashboardData();
    } else {
      setStats(null);
      setSystemHealth(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchDashboardData, user]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getGrowthIcon = (current: number, previous: number): React.ReactElement => {
    if (current > previous) return <MdArrowUpward className="h-4 w-4 text-red-500" />;
    if (current < previous) return <MdArrowDownward className="h-4 w-4 text-red-500" />;
    return <MdRemove className="h-4 w-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <LoadingSpinner fullScreen text="Loading dashboard..." color="red" size="xl" />
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <div className="flex items-center justify-center">
            <div className="p-4 bg-gray-900 rounded-full border border-gray-800">
              <MdWarning className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Restricted Area</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
            You don&apos;t have permission to view the admin dashboard. Please contact an administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const safeStats = stats || DEFAULT_STATS;
  const safeSystemHealth = systemHealth || DEFAULT_SYSTEM_HEALTH;
  const usersStats = safeStats.users || DEFAULT_STATS.users;
  const contentStats = safeStats.content || DEFAULT_STATS.content;
  const recentUsers = safeStats.recentUsers || [];
  const watchlistLeaders = safeStats.watchlistLeaders || DEFAULT_STATS.watchlistLeaders;
  const engagementStats = safeStats.engagement || DEFAULT_STATS.engagement;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <MdWarning className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-3 bg-red-600 text-white  hover:bg-red-700 transition-colors font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Stats Grid */}
      {safeStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Users Card */}
          <div className="ctrl-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--sys-text-muted)] uppercase tracking-wider">
                Total Users
              </span>
              <div className="w-7 h-7 rounded-md bg-red-600/10 text-red-500 border border-red-500/20 flex items-center justify-center">
                <MdPeople className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--sys-text)] mb-1">
              {usersStats.total.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--sys-text-dim)] flex items-center gap-1">
              <span className="sys-badge sys-badge-green font-mono">+{usersStats.newThisMonth}</span>
              <span>new this month</span>
            </div>
          </div>

          {/* Active Users Card */}
          <div className="ctrl-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--sys-text-muted)] uppercase tracking-wider">
                Active Users
              </span>
              <div className="w-7 h-7 rounded-md bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
                <MdTimeline className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--sys-text)] mb-1">
              {usersStats.active.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--sys-text-dim)] flex items-center gap-1">
              <span className="sys-badge sys-badge-cyan font-mono">
                {usersStats.total > 0 ? ((usersStats.active / usersStats.total) * 100).toFixed(1) : '0.0'}%
              </span>
              <span>of total accounts</span>
            </div>
          </div>

          {/* Movies Card */}
          <div className="ctrl-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--sys-text-muted)] uppercase tracking-wider">
                Movies Library
              </span>
              <div className="w-7 h-7 rounded-md bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <MdMovie className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--sys-text)] mb-1">
              {contentStats.movies.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--sys-text-dim)] flex items-center gap-1">
              <span className="sys-badge sys-badge-green font-mono">+{contentStats.newMoviesThisMonth}</span>
              <span>added this month</span>
            </div>
          </div>

          {/* TV Shows Card */}
          <div className="ctrl-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--sys-text-muted)] uppercase tracking-wider">
                TV Series Library
              </span>
              <div className="w-7 h-7 rounded-md bg-amber-600/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                <MdTv className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--sys-text)] mb-1">
              {contentStats.tvShows.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--sys-text-dim)] flex items-center gap-1">
              <span className="sys-badge sys-badge-amber font-mono">Catalog Ready</span>
            </div>
          </div>
        </div>
      )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Recent Users */}
          <div className="ctrl-panel">
            <div className="ctrl-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdPeople className="h-4 w-4 text-[var(--sys-cyan)]" />
                <span>Recent Users</span>
              </div>
              <span className="sys-badge sys-badge-cyan font-mono">
                {recentUsers.length} Logins
              </span>
            </div>
            <div className="ctrl-panel-body">
              {recentUsers.length > 0 ? (
                <div className="space-y-2">
                  {recentUsers.map((recentUser, index) => (
                    <div
                      key={recentUser._id || `${recentUser.email || 'user'}-${index}`}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-[var(--sys-surface)] transition-colors border border-transparent hover:border-[var(--sys-border)]"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        {recentUser.username ? recentUser.username.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--sys-text)] truncate">
                          {recentUser.username}
                        </p>
                        <p className="text-[11px] text-[var(--sys-text-dim)] truncate">
                          {recentUser.email}
                        </p>
                      </div>
                      <div className="text-[11px] text-[var(--sys-text-muted)] font-mono flex-shrink-0">
                        {recentUser.lastLogin ? new Date(recentUser.lastLogin).toLocaleDateString() : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--sys-text-muted)] text-center py-6">
                  No recent users
                </p>
              )}
            </div>
          </div>

          {/* Watchlist demand — real saves from your users */}
          <div className="ctrl-panel">
            <div className="ctrl-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bookmark className="h-4 w-4 text-[var(--sys-amber)]" />
                <span>Watchlist Demand</span>
              </div>
              <span className="sys-badge sys-badge-amber font-mono">
                {engagementStats.watchlists.toLocaleString()} Saves
              </span>
            </div>
            <div className="ctrl-panel-body space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
              <div>
                <span className="text-[11px] font-semibold text-[var(--sys-text-muted)] uppercase tracking-wider block mb-2">
                  Top Saved Movies
                </span>
                {watchlistLeaders.movies.length > 0 ? (
                  <div className="space-y-2">
                    {watchlistLeaders.movies.map((row, index) => (
                      <div
                        key={`m-${row.tmdbId ?? row.title}-${index}`}
                        className="flex items-center gap-3 p-1.5 rounded-md hover:bg-[var(--sys-surface)] transition-colors"
                      >
                        <div className="w-8 h-12 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                          {row.posterPath ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${row.posterPath}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <MdMovie className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--sys-text)] truncate">{row.title}</p>
                          <p className="text-[11px] text-amber-500 font-mono mt-0.5">{row.saves} saves</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--sys-text-dim)] py-2">No movie watchlist data yet.</p>
                )}
              </div>

              <div className="border-t border-[var(--sys-border)] pt-3">
                <span className="text-[11px] font-semibold text-[var(--sys-text-muted)] uppercase tracking-wider block mb-2">
                  Top Saved TV Shows
                </span>
                {watchlistLeaders.tvShows.length > 0 ? (
                  <div className="space-y-2">
                    {watchlistLeaders.tvShows.map((row, index) => (
                      <div
                        key={`t-${row.tmdbId ?? row.title}-${index}`}
                        className="flex items-center gap-3 p-1.5 rounded-md hover:bg-[var(--sys-surface)] transition-colors"
                      >
                        <div className="w-8 h-12 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                          {row.posterPath ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${row.posterPath}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <MdTv className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--sys-text)] truncate">{row.title}</p>
                          <p className="text-[11px] text-amber-500 font-mono mt-0.5">{row.saves} saves</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--sys-text-dim)] py-2">No TV watchlist data yet.</p>
                )}
              </div>
              {watchlistLeaders.movies.length === 0 && watchlistLeaders.tvShows.length === 0 && (
                <p className="text-center text-gray-500 text-xs pt-2">
                  When users add movies or series to their watchlists, the most-saved titles appear here.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* System Health */}
        {safeSystemHealth && (
          <div className="ctrl-panel mb-4">
            <div className="ctrl-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdStorage className="h-4 w-4 text-[var(--sys-green)]" />
                <span>System Telemetry & Health</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-led led-green led-pulse" />
                <span className="sys-badge sys-badge-green font-mono">Online</span>
              </div>
            </div>
            <div className="ctrl-panel-body">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded-md">
                  <span className="text-[11px] font-medium text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                    Collections
                  </span>
                  <span className="text-lg font-bold font-mono text-[var(--sys-text)]">
                    {safeSystemHealth.database.collections}
                  </span>
                </div>

                <div className="text-center p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded-md">
                  <span className="text-[11px] font-medium text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                    Database Size
                  </span>
                  <span className="text-lg font-bold font-mono text-[var(--sys-text)]">
                    {formatBytes(safeSystemHealth.database.dataSize)}
                  </span>
                </div>

                <div className="text-center p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded-md">
                  <span className="text-[11px] font-medium text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                    Heap Memory
                  </span>
                  <span className="text-lg font-bold font-mono text-[var(--sys-text)]">
                    {formatBytes(safeSystemHealth.memory.heapUsed)}
                  </span>
                </div>

                <div className="text-center p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded-md">
                  <span className="text-[11px] font-medium text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                    Process Uptime
                  </span>
                  <span className="text-lg font-bold font-mono text-[var(--sys-text)]">
                    {formatUptime(safeSystemHealth.uptime)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default AdminDashboard;