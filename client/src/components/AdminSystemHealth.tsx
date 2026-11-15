import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import {
  MdStorage,
  MdMemory,
  MdComputer,
  MdTimeline
} from 'react-icons/md';
import { RefreshCw, Database, Cpu, Activity, Server } from 'lucide-react';

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

const AdminSystemHealth: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const response = await api.get('/api/admin/system/health');
      setHealth(response.data.data);
    } catch {
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading system health..." color="blue" size="xl" />;
  }

  if (!health) {
    return (
      <div className="sys-flush-stack">
        <div className="ctrl-panel p-6 text-center">
          <p className="text-red-400 text-sm">Failed to load system telemetry.</p>
          <button
            type="button"
            onClick={() => fetchHealth(true)}
            className="sys-btn sys-btn-primary mt-3"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const memoryPercent = health.memory.heapTotal > 0
    ? Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100)
    : 0;

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Live Telemetry Status Header */}
      <div className="ctrl-panel" style={{ borderLeft: '4px solid var(--sys-green)' }}>
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="status-led led-green led-pulse" />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  All Core Microservices Operational
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  Node.js <span className="font-mono text-[var(--sys-cyan)]">{health.nodeVersion}</span> · Uptime: <span className="font-mono text-[var(--sys-text)]">{formatUptime(health.uptime)}</span> · Refreshes every 30s
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              className="sys-btn"
              title="Refresh telemetry"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              <span>Poll Status</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Telemetry Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Database Telemetry */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} color="var(--sys-cyan)" />
              <span>MongoDB Atlas Cluster Telemetry</span>
            </div>
            <span className="sys-badge sys-badge-green font-mono">Connected</span>
          </div>

          <div className="ctrl-panel-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded text-center">
                <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                  Active Collections
                </span>
                <span className="text-xl font-bold font-mono text-[var(--sys-text)]">
                  {health.database.collections}
                </span>
              </div>

              <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded text-center">
                <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                  Total Indexes
                </span>
                <span className="text-xl font-bold font-mono text-[var(--sys-text)]">
                  {health.database.indexes}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-[var(--sys-border)] text-xs">
              <span className="text-[var(--sys-text-muted)]">Uncompressed Data Size</span>
              <span className="font-mono font-medium text-[var(--sys-text)]">
                {formatBytes(health.database.dataSize)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-[var(--sys-border)] text-xs">
              <span className="text-[var(--sys-text-muted)]">Disk Storage Allocation</span>
              <span className="font-mono font-medium text-[var(--sys-text)]">
                {formatBytes(health.database.storageSize)}
              </span>
            </div>
          </div>
        </div>

        {/* Node Process Memory */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} color="var(--sys-purple)" />
              <span>V8 Runtime Heap &amp; Memory</span>
            </div>
            <span className={`sys-badge ${memoryPercent > 80 ? 'sys-badge-red' : 'sys-badge-purple'} font-mono`}>
              {memoryPercent}% Heap
            </span>
          </div>

          <div className="ctrl-panel-body space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[var(--sys-text-muted)]">Heap Utilization</span>
                <span className="font-mono text-[var(--sys-text)]">
                  {formatBytes(health.memory.heapUsed)} / {formatBytes(health.memory.heapTotal)}
                </span>
              </div>
              <div className="w-full bg-[var(--sys-surface)] border border-[var(--sys-border)] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(memoryPercent, 100)}%`,
                    background: memoryPercent > 80 ? 'var(--sys-red)' : 'var(--sys-purple)'
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-[var(--sys-border)] text-xs">
              <span className="text-[var(--sys-text-muted)]">Resident Set Size (RSS)</span>
              <span className="font-mono font-medium text-[var(--sys-text)]">
                {formatBytes(health.memory.rss)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-[var(--sys-border)] text-xs">
              <span className="text-[var(--sys-text-muted)]">External C++ Memory</span>
              <span className="font-mono font-medium text-[var(--sys-text)]">
                {formatBytes(health.memory.external)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemHealth;
