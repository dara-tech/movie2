import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Server, Database, Cpu, RefreshCw, Shield, Layers, HardDrive } from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import AdminEmptyState from './admin/AdminEmptyState';

type PeriodOption = '7d' | '30d' | '90d' | '1y';

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

interface ActivityByAction {
  _id: string;
  count: number;
}

interface ActivityByAdmin {
  admin: {
    username?: string;
    email?: string;
  };
  count: number;
}

interface RecentActivity {
  _id: string;
  action: string;
  resource?: string;
  description?: string;
  createdAt: string;
  success?: boolean;
}

interface ActivityStats {
  total: number;
  success: number;
  failed: number;
  successRate: string | number;
  byAction: ActivityByAction[];
  byAdmin: ActivityByAdmin[];
  recent: RecentActivity[];
}

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodOption }> = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' }
];

const DEFAULT_HEALTH: SystemHealth = {
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

const DEFAULT_STATS: ActivityStats = {
  total: 0,
  success: 0,
  failed: 0,
  successRate: 0,
  byAction: [],
  byAdmin: [],
  recent: []
};

const AdminAnalyticsSystem: React.FC = () => {
  const [period, setPeriod] = useState<PeriodOption>('30d');
  const [health, setHealth] = useState<SystemHealth>(DEFAULT_HEALTH);
  const [stats, setStats] = useState<ActivityStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchAll(period);
  }, [period]);

  const fetchAll = async (selectedPeriod: PeriodOption) => {
    try {
      setLoading(true);
      setError(null);
      const [healthRes, statsRes] = await Promise.all([
        api.get('/api/admin/analytics/system-health'),
        api.get('/api/admin/activity/stats', { params: { period: selectedPeriod } })
      ]);

      const healthData = healthRes.data?.data;
      if (healthData) {
        setHealth({
          database: {
            collections: healthData.database?.collections ?? 0,
            dataSize: healthData.database?.dataSize ?? 0,
            storageSize: healthData.database?.storageSize ?? 0,
            indexes: healthData.database?.indexes ?? 0
          },
          uptime: healthData.uptime ?? 0,
          memory: {
            rss: healthData.memory?.rss ?? 0,
            heapTotal: healthData.memory?.heapTotal ?? 0,
            heapUsed: healthData.memory?.heapUsed ?? 0,
            external: healthData.memory?.external ?? 0
          },
          nodeVersion: healthData.nodeVersion || ''
        });
      }

      const statsData = statsRes.data?.data;
      if (statsData) {
        setStats({
          total: statsData.total ?? 0,
          success: statsData.success ?? 0,
          failed: statsData.failed ?? 0,
          successRate: statsData.successRate ?? 0,
          byAction: Array.isArray(statsData.byAction) ? statsData.byAction : [],
          byAdmin: Array.isArray(statsData.byAdmin) ? statsData.byAdmin : [],
          recent: Array.isArray(statsData.recent) ? statsData.recent : []
        });
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch analytics';
      setError(message);
      setHealth(DEFAULT_HEALTH);
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(2)} ${units[index]}`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
  };

  const successRateValue = useMemo(() => {
    if (typeof stats.successRate === 'string') {
      return parseFloat(stats.successRate);
    }
    return stats.successRate ?? 0;
  }, [stats.successRate]);

  if (loading && !health.nodeVersion) {
    return <LoadingSpinner fullScreen color="blue" size="xl" text="Probing infrastructure health..." />;
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Uptime</span>
            <Server className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">{formatUptime(health.uptime)}</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Node {health.nodeVersion || 'v20'}</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Heap Memory</span>
            <Cpu className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {formatBytes(health.memory.heapUsed)}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
            of {formatBytes(health.memory.heapTotal)} allocated
          </div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Collections</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {health.database.collections}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
            {formatBytes(health.database.dataSize)} data size
          </div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Action Success</span>
            <Shield className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--sys-cyan)]">
            {successRateValue.toFixed(1)}%
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{stats.total} total executions</div>
        </div>
      </div>

      {/* Control Strip & Window Filter */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">System Metrics Window</span>
          </div>

          <div className="flex items-center gap-1.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`sys-btn ${period === option.value ? 'sys-btn-primary' : ''}`}
              >
                <span>{option.label}</span>
              </button>
            ))}

            <button
              onClick={() => fetchAll(period)}
              className="sys-btn ml-2"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Breakdown & Admin Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Actions */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
              <span className="ctrl-panel-title">Top Administrative Operations</span>
            </div>
          </div>
          <div className="ctrl-panel-body p-0">
            {stats.byAction.length === 0 ? (
              <AdminEmptyState
                icon={Activity}
                title="No Actions Logged"
                description="No operations found within the selected period window"
              />
            ) : (
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th className="text-right">Execution Count</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byAction.map((item) => (
                    <tr key={item._id}>
                      <td className="font-mono text-xs uppercase text-zinc-200">
                        {item._id || 'unknown'}
                      </td>
                      <td className="font-mono text-xs text-right text-zinc-300">
                        {item.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Most Active Admins */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="ctrl-panel-title">Active Operator Accounts</span>
            </div>
          </div>
          <div className="ctrl-panel-body p-0">
            {stats.byAdmin.length === 0 ? (
              <AdminEmptyState
                icon={Shield}
                title="No Operator Activity"
                description="No administrative logins or edits recorded in this timeframe"
              />
            ) : (
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Operator</th>
                    <th className="text-right">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byAdmin.map((item, index) => (
                    <tr key={`${item.admin?.email || 'admin'}-${index}`}>
                      <td>
                        <div className="font-semibold text-xs text-zinc-200">
                          {item.admin?.username || item.admin?.email || 'Unknown Admin'}
                        </div>
                        {item.admin?.email && (
                          <div className="text-[10px] font-mono text-zinc-500">{item.admin.email}</div>
                        )}
                      </td>
                      <td className="font-mono text-xs text-right text-zinc-300">
                        {item.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Environment Details */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">V8 Runtime & Storage Allocation</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 bg-zinc-950 border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block uppercase">Node.js Engine</span>
              <span className="text-zinc-200 font-bold">{health.nodeVersion || 'Unknown'}</span>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block uppercase">Heap Total</span>
              <span className="text-zinc-200 font-bold">{formatBytes(health.memory.heapTotal)}</span>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block uppercase">RSS Allocation</span>
              <span className="text-zinc-200 font-bold">{formatBytes(health.memory.rss)}</span>
            </div>
            <div className="p-2.5 bg-zinc-950 border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block uppercase">Database Indexes</span>
              <span className="text-zinc-200 font-bold">{health.database.indexes} active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsSystem;
