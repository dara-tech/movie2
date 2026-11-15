import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Clock, 
  Database, 
  AlertCircle, 
  CheckCircle, 
  Film, 
  Tv, 
  Eye, 
  EyeOff, 
  Sliders, 
  Activity,
  Layers,
  FileText
} from 'lucide-react';
import api from '../services/api';
import AdminEmptyState from './admin/AdminEmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface SyncStatus {
  isRunning: boolean;
  lastSync: string | null;
  stats: {
    totalMovies: number;
    newMovies: number;
    updatedMovies: number;
    totalTvShows: number;
    newTvShows: number;
    updatedTvShows: number;
    vidsrcUrls: number;
    errors: number;
  };
  scheduledJobs: string[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const AutoSyncPanel: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  const [syncConfig, setSyncConfig] = useState({
    pages: 5,
    includeTrending: true,
    includePopular: true,
    includeTopRated: false,
    includeUpcoming: false,
    schedule: 'daily',
    customCron: '0 2 * * *',
    dailyHour: 2
  });

  const addLog = (type: LogEntry['type'], message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get('/api/auto-sync/status');
      const newStatus = response.data.data;
      
      if (status && status.isRunning !== newStatus.isRunning) {
        addLog(newStatus.isRunning ? 'success' : 'info', `Auto-sync daemon ${newStatus.isRunning ? 'started' : 'stopped'}`);
      }
      
      setStatus(newStatus);
    } catch (error) {
    }
  }, [status]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, status?.isRunning ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, status?.isRunning]);

  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const startAutoSync = async () => {
    setLoading(true);
    addLog('info', 'Starting auto-sync daemon...');
    try {
      const schedule = syncConfig.schedule === 'custom' 
        ? syncConfig.customCron 
        : syncConfig.schedule === 'daily' 
          ? `0 ${syncConfig.dailyHour} * * *`
          : syncConfig.schedule === 'hourly'
            ? '0 * * * *'
            : syncConfig.schedule === 'twiceDaily'
              ? '0 2,14 * * *'
              : '0 2 * * 0';

      const response = await api.post('/api/auto-sync/start', {
        schedule,
        pages: syncConfig.pages,
        includeTrending: syncConfig.includeTrending,
        includePopular: syncConfig.includePopular,
        includeTopRated: syncConfig.includeTopRated,
        includeUpcoming: syncConfig.includeUpcoming
      });

      if (response.data.success) {
        addLog('success', 'Auto-sync daemon armed and online');
        await fetchStatus();
      } else {
        addLog('error', response.data.message || 'Failed to start auto-sync');
      }
    } catch (error: any) {
      addLog('error', error.response?.data?.message || 'Failed to start auto-sync');
    } finally {
      setLoading(false);
    }
  };

  const stopAutoSync = async () => {
    setLoading(true);
    addLog('info', 'Halting auto-sync daemon...');
    try {
      const response = await api.post('/api/auto-sync/stop');
      if (response.data.success) {
        addLog('warning', 'Auto-sync daemon halted');
        await fetchStatus();
      } else {
        addLog('error', response.data.message || 'Failed to stop auto-sync');
      }
    } catch (error: any) {
      addLog('error', error.response?.data?.message || 'Failed to stop auto-sync');
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    setLoading(true);
    addLog('info', 'Triggering one-off immediate ingestion pipeline...');
    try {
      const response = await api.post('/api/auto-sync/sync-now', {
        pages: syncConfig.pages,
        includeTrending: syncConfig.includeTrending,
        includePopular: syncConfig.includePopular,
        includeTopRated: syncConfig.includeTopRated,
        includeUpcoming: syncConfig.includeUpcoming
      });
      
      if (response.data && response.data.success) {
        addLog('success', 'Sync dispatched to background worker');
        addLog('info', `Target: ${syncConfig.pages} pages across selected categories`);
        await fetchStatus();
      } else {
        addLog('warning', 'Worker failed to accept ingestion task');
      }
    } catch (error) {
      addLog('error', 'Immediate ingestion pipeline trigger failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      default: return 'text-[var(--sys-cyan)]';
    }
  };

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Stat Cards */}
      {status ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Catalog Movies</span>
              <Film className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-100">{status.stats.totalMovies}</div>
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">+{status.stats.newMovies} ingested</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Catalog TV</span>
              <Tv className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-100">{status.stats.totalTvShows || 0}</div>
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">+{status.stats.newTvShows || 0} ingested</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Updated Items</span>
              <RefreshCw className="w-3.5 h-3.5 text-[var(--sys-amber)]" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-100">
              {status.stats.updatedMovies + (status.stats.updatedTvShows || 0)}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">refreshed metadata</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Sync Status</span>
              {status.isRunning ? (
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              ) : (
                <Pause className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`status-led led-${status.isRunning ? 'green' : 'amber'}`} />
              <span className="text-sm font-bold font-mono text-zinc-100 uppercase">
                {status.isRunning ? 'Active Daemon' : 'Standby'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-1">
              Last: {formatDate(status.lastSync)}
            </div>
          </div>
        </div>
      ) : (
        <div className="ctrl-panel p-4 text-center">
          <LoadingSpinner text="Connecting to scheduler socket..." color="red" />
        </div>
      )}

      {/* Scheduler Configuration & Execution */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Automated Sync Daemon Parameters</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="sys-btn"
            >
              {showLogs ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              <span>{showLogs ? 'Hide Console' : 'Console Stream'}</span>
            </button>
          </div>
        </div>

        <div className="ctrl-panel-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="sys-label">Pages to Ingest (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={syncConfig.pages}
                onChange={(e) => setSyncConfig({ ...syncConfig, pages: parseInt(e.target.value) || 1 })}
                className="sys-input font-mono"
              />
              <span className="text-[10px] font-mono text-zinc-500 mt-1 block">
                20 items per page fetched from TMDB discovery endpoint
              </span>
            </div>

            <div>
              <label className="sys-label">Daemon Interval Schedule</label>
              <Select
                value={syncConfig.schedule}
                onValueChange={(val) => setSyncConfig({ ...syncConfig, schedule: val })}
              >
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md font-mono">
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="hourly">Hourly (0 * * * *)</SelectItem>
                  <SelectItem value="daily">Daily (Specified Hour UTC)</SelectItem>
                  <SelectItem value="twiceDaily">Twice Daily (02:00 & 14:00 UTC)</SelectItem>
                  <SelectItem value="weekly">Weekly (Sunday 02:00 UTC)</SelectItem>
                  <SelectItem value="custom">Custom Cron Expression</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {syncConfig.schedule === 'daily' && (
              <div className="md:col-span-2">
                <label className="sys-label">Daily Execution Hour (UTC 0-23)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={syncConfig.dailyHour}
                  onChange={(e) => setSyncConfig({ ...syncConfig, dailyHour: parseInt(e.target.value) || 0 })}
                  className="sys-input font-mono"
                />
              </div>
            )}

            {syncConfig.schedule === 'custom' && (
              <div className="md:col-span-2">
                <label className="sys-label">Custom Cron Format (min hour dom mon dow)</label>
                <input
                  type="text"
                  value={syncConfig.customCron}
                  onChange={(e) => setSyncConfig({ ...syncConfig, customCron: e.target.value })}
                  placeholder="0 2 * * *"
                  className="sys-input font-mono"
                />
              </div>
            )}
          </div>

          <div>
            <label className="sys-label mb-2 block">Content Categories Filter</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'trending', label: 'Trending', configKey: 'includeTrending' as const, checked: syncConfig.includeTrending },
                { id: 'popular', label: 'Popular', configKey: 'includePopular' as const, checked: syncConfig.includePopular },
                { id: 'topRated', label: 'Top Rated', configKey: 'includeTopRated' as const, checked: syncConfig.includeTopRated },
                { id: 'upcoming', label: 'Upcoming', configKey: 'includeUpcoming' as const, checked: syncConfig.includeUpcoming }
              ].map(({ id, label, configKey, checked }) => (
                <div key={id} className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-900">
                  <span className="text-xs text-zinc-300 font-medium">{label}</span>
                  <label className="sys-switch">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setSyncConfig({ ...syncConfig, [configKey]: e.target.checked })}
                    />
                    <span className="sys-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
            <button
              onClick={startAutoSync}
              disabled={loading || status?.isRunning}
              className="sys-btn sys-btn-primary"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Start Daemon
            </button>
            <button
              onClick={stopAutoSync}
              disabled={loading || !status?.isRunning}
              className="sys-btn sys-btn-danger"
            >
              <Pause className="w-3.5 h-3.5 mr-1.5" />
              Halt Daemon
            </button>
            <button
              onClick={syncNow}
              disabled={loading}
              className="sys-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Execute Immediate Run
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Logs Console */}
      {showLogs && (
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
              <span className="ctrl-panel-title">Scheduler Execution Log Stream</span>
            </div>
            <span className="sys-badge font-mono text-[10px]">
              Buffer: {logs.length}/50 events
            </span>
          </div>

          <div className="ctrl-panel-body p-0">
            <div className="bg-black p-3.5 h-64 overflow-y-auto font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <AdminEmptyState
                  icon={FileText}
                  title="No Stream Events"
                  description="Scheduler has not logged any events in the active session buffer"
                />
              ) : (
                <>
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2.5 py-1 border-b border-zinc-900/60 last:border-0">
                      <span className="text-zinc-600 text-[10px] whitespace-nowrap pt-0.5">{log.timestamp}</span>
                      <span className={`font-semibold text-[10px] uppercase ${getLogColor(log.type)}`}>
                        [{log.type}]
                      </span>
                      <span className="text-zinc-300 break-all">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoSyncPanel;
