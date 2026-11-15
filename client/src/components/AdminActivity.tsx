import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { 
  Activity, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Shield, 
  Database,
  Search,
  UserCheck
} from 'lucide-react';
import environment from '../config/environment';
import AdminPagination from './admin/AdminPagination';
import AdminEmptyState from './admin/AdminEmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface AdminActivityItem {
  _id: string;
  admin: {
    username: string;
    email: string;
    role: string;
  };
  action: string;
  resource: string;
  description: string;
  details: any;
  success: boolean;
  createdAt: string;
  ipAddress?: string;
}

interface ActivityStats {
  total: number;
  success: number;
  failed: number;
  successRate: string;
  byAction: Array<{ _id: string; count: number }>;
  byAdmin: Array<{ admin: { username: string; email: string }; count: number }>;
  recent: AdminActivityItem[];
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
};

const RESOURCE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Resources' },
  { value: 'user', label: 'User' },
  { value: 'movie', label: 'Movie' },
  { value: 'tvshow', label: 'TV Show' },
  { value: 'genre', label: 'Genre' },
  { value: 'system', label: 'System' },
  { value: 'settings', label: 'Settings' },
];

const ACTION_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'user_update', label: 'User Update' },
  { value: 'user_deactivate', label: 'User Deactivate' },
  { value: 'movie_availability', label: 'Movie Availability' },
  { value: 'movie_delete', label: 'Movie Delete' },
  { value: 'tvshow_availability', label: 'TV Show Availability' },
  { value: 'tvshow_delete', label: 'TV Show Delete' },
  { value: 'genre_delete', label: 'Genre Delete' },
];

const AdminActivity: React.FC = () => {
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: 'ALL',
    resource: 'ALL',
    success: 'ALL',
    adminId: ''
  });

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '25'
      };
      if (filters.action && filters.action !== 'ALL') {
        params.action = filters.action;
      }
      if (filters.resource && filters.resource !== 'ALL') {
        params.resource = filters.resource;
      }
      if (filters.success && filters.success !== 'ALL') {
        params.success = filters.success;
      }
      if (filters.adminId) {
        params.adminId = filters.adminId;
      }

      const queryParams = new URLSearchParams(params);
      const response = await fetch(`${environment.API_URL}/api/admin/activity?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.data.activities || []);
        setTotalPages(data.data.pagination.totalPages || 1);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [filters.action, filters.adminId, filters.resource, filters.success, page]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${environment.API_URL}/api/admin/activity/stats?period=30d`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [fetchActivities, fetchStats]);

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'text-red-400';
    if (action.includes('update')) return 'text-[var(--sys-cyan)]';
    if (action.includes('create')) return 'text-emerald-400';
    return 'text-zinc-400';
  };

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Total Audit Events</span>
              <Activity className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-100">{stats.total}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">30-day rolling window</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Successful</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{stats.success}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">verified changes</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Failed / Blocked</span>
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-xl font-bold font-mono text-red-400">{stats.failed}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">exceptions or rejections</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Success Rate</span>
              <Shield className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--sys-cyan)]">{stats.successRate}%</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">execution integrity</div>
          </div>
        </div>
      )}

      {/* Query Filters */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Audit Log Filtering</span>
          </div>
          <button 
            onClick={() => {
              setFilters({ action: 'ALL', resource: 'ALL', success: 'ALL', adminId: '' });
              setPage(1);
            }}
            className="sys-btn"
          >
            Reset Filters
          </button>
        </div>

        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="sys-label">Target Action</label>
              <Select
                value={filters.action}
                onValueChange={(val) => {
                  setFilters({ ...filters, action: val });
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  {ACTION_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">Resource Scope</label>
              <Select
                value={filters.resource}
                onValueChange={(val) => {
                  setFilters({ ...filters, resource: val });
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  {RESOURCE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">Execution Result</label>
              <Select
                value={filters.success}
                onValueChange={(val) => {
                  setFilters({ ...filters, success: val });
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="ALL">All Outcomes</SelectItem>
                  <SelectItem value="true">Success</SelectItem>
                  <SelectItem value="false">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">System Audit Log</span>
          </div>
          <span className="sys-badge font-mono text-[10px]">
            {activities.length} records loaded
          </span>
        </div>

        <div className="ctrl-panel-body p-0">
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Retrieving audit ledger..." color="blue" />
            </div>
          ) : activities.length === 0 ? (
            <AdminEmptyState
              icon={Activity}
              title="No Audit Records"
              description="No administrative activities matched the specified filter parameters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-none bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-[11px] text-[var(--sys-cyan)]">
                            {activity.admin?.username?.charAt(0)?.toUpperCase() || 'A'}
                          </div>
                          <div>
                            <div className="font-medium text-zinc-200 text-xs">{activity.admin?.username || 'System'}</div>
                            <div className="text-[10px] font-mono text-zinc-500">{activity.admin?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`font-mono text-xs ${getActionColor(activity.action)}`}>
                          {activity.action}
                        </span>
                      </td>
                      <td>
                        <span className="sys-badge font-mono text-[10px]">
                          {activity.resource}
                        </span>
                      </td>
                      <td className="max-w-md">
                        <span className="text-zinc-300 text-xs line-clamp-2">{activity.description}</span>
                      </td>
                      <td>
                        {activity.success ? (
                          <span className="sys-badge sys-badge-green font-mono text-[10px]">
                            <CheckCircle className="w-2.5 h-2.5 mr-1 inline" />
                            Success
                          </span>
                        ) : (
                          <span className="sys-badge sys-badge-red font-mono text-[10px]">
                            <XCircle className="w-2.5 h-2.5 mr-1 inline" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {formatDate(activity.createdAt)}
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
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminActivity;
