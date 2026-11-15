/* eslint-disable react/no-unknown-property, @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Database,
  Film,
  Tv,
  Tag,
  Users,
  Clock,
  Loader2,
  Play,
  Square,
  Settings,
  Download,
  FileText
} from 'lucide-react';
import AdminEmptyState from './admin/AdminEmptyState';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SyncLog {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface SyncJob {
  _id?: string;
  id?: string;
  name: string;
  type: 'movies' | 'tvshows' | 'genres' | 'users' | 'all';
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  lastRun?: string;
  nextRun?: string;
  isEnabled: boolean;
  description: string;
  estimatedTime?: string;
  itemsProcessed?: number;
  totalItems?: number;
  errorMessage?: string;
  lastError?: string;
  successCount?: number;
  failureCount?: number;
  config?: any;
  logs?: SyncLog[];
}

const getJobId = (job: SyncJob): string => {
  return job._id || job.id || '';
};

interface SyncStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  lastSyncTime?: string;
  totalItemsSynced: number;
  syncSuccessRate: number;
}

const AdminSyncManagement: React.FC = () => {
  const { user } = useAuth();
  
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  
  // Modal states
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null);
  const [selectedJobLogs, setSelectedJobLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  const fetchSyncData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const jobsResponse = await api.get('/api/admin/sync/jobs');
      setSyncJobs(jobsResponse.data || []);

      const statsResponse = await api.get('/api/admin/sync/stats');
      setSyncStats(statsResponse.data || null);

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch sync data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && ['admin', 'super_admin'].includes(user.role)) {
      fetchSyncData();
      
      const interval = setInterval(() => {
        fetchSyncData();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [user, fetchSyncData]);

  const runSyncJob = async (jobId: string) => {
    try {
      setRunningJobs(prev => new Set(prev).add(jobId));
      setError(null);
      setSyncMessage(`Starting sync job...`);

      await api.post(`/api/admin/sync/run/${jobId}`);
      
      setSyncMessage(`Sync job completed successfully!`);
      setTimeout(() => setSyncMessage(null), 3000);
      await fetchSyncData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to run sync job');
    } finally {
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const runAllSyncJobs = async () => {
    try {
      setError(null);
      setSyncMessage(`Starting all sync jobs...`);

      await api.post('/api/admin/sync/run-all');
      
      setSyncMessage(`All sync jobs completed successfully!`);
      setTimeout(() => setSyncMessage(null), 3000);
      await fetchSyncData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to run all sync jobs');
    }
  };

  const toggleJob = async (jobId: string, enabled: boolean) => {
    try {
      await api.put(`/api/admin/sync/jobs/${jobId}`, { isEnabled: enabled });
      
      setSyncJobs(prev => prev.map(job => 
        getJobId(job) === jobId ? { ...job, isEnabled: enabled } : job
      ));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update job');
    }
  };

  const stopSyncJob = async (jobId: string) => {
    try {
      setRunningJobs(prev => new Set(prev).add(jobId));
      setError(null);
      setSyncMessage(`Stopping sync job...`);

      await api.post(`/api/admin/sync/stop/${jobId}`);
      
      setSyncMessage(`Sync job stopped successfully`);
      setTimeout(() => setSyncMessage(null), 3000);
      await fetchSyncData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to stop sync job');
    } finally {
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const updateJobConfig = async () => {
    if (!selectedJob) return;

    try {
      await api.put(`/api/admin/sync/jobs/${getJobId(selectedJob)}`, {
        isEnabled: selectedJob.isEnabled,
        autoSyncEnabled
      });

      setSyncJobs(prev => prev.map(job => 
        getJobId(job) === getJobId(selectedJob)
          ? { ...job, isEnabled: selectedJob.isEnabled }
          : job
      ));

      setConfigModalOpen(false);
      setSelectedJob(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update job configuration');
    }
  };

  const handleConfigClick = (job: SyncJob) => {
    setSelectedJob(job);
    setAutoSyncEnabled(job.isEnabled);
    setConfigModalOpen(true);
  };

  const handleViewLogs = async (job: SyncJob) => {
    setSelectedJob(job);
    setLogsModalOpen(true);
    setLogsLoading(true);
    setSelectedJobLogs([]);

    try {
      const jobId = getJobId(job);
      const response = await api.get(`/api/admin/sync/jobs/${jobId}/logs`);
      setSelectedJobLogs(response.data.logs || []);
      
      if (job.status === 'running' || runningJobs.has(jobId)) {
        const intervalId = setInterval(async () => {
          try {
            const refreshResponse = await api.get(`/api/admin/sync/jobs/${jobId}/logs`);
            setSelectedJobLogs(refreshResponse.data.logs || []);
          } catch (err) {
          }
        }, 3000);

        (window as any).logsCleanup = () => clearInterval(intervalId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const getJobIcon = (type: SyncJob['type']) => {
    switch (type) {
      case 'movies': return <Film className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />;
      case 'tvshows': return <Tv className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />;
      case 'genres': return <Tag className="w-3.5 h-3.5 text-[var(--sys-amber)]" />;
      case 'users': return <Users className="w-3.5 h-3.5 text-[var(--sys-green)]" />;
      default: return <Database className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getStatusBadge = (job: SyncJob) => {
    const isRunning = job.status === 'running' || runningJobs.has(getJobId(job));
    if (isRunning) {
      return (
        <span className="sys-badge sys-badge-cyan">
          <Loader2 className="w-2.5 h-2.5 animate-spin mr-1 inline" />
          Running
        </span>
      );
    }
    if (job.status === 'completed') {
      return (
        <span className="sys-badge sys-badge-green">
          <CheckCircle className="w-2.5 h-2.5 mr-1 inline" />
          Ready
        </span>
      );
    }
    if (job.status === 'failed') {
      return (
        <span className="sys-badge sys-badge-red">
          <XCircle className="w-2.5 h-2.5 mr-1 inline" />
          Failed
        </span>
      );
    }
    return (
      <span className="sys-badge">
        <Clock className="w-2.5 h-2.5 mr-1 inline" />
        Idle
      </span>
    );
  };

  const getLogLevelColor = (level: SyncLog['level']) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'success': return 'text-emerald-400';
      default: return 'text-zinc-400';
    }
  };

  if (loading && !syncJobs.length) {
    return <LoadingSpinner fullScreen text="Loading sync daemon..." color="blue" size="lg" />;
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {syncMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 font-mono">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Sync Telemetry Strip */}
      {syncStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Total Jobs</span>
              <Database className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-100">{syncStats.totalJobs}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{syncStats.activeJobs} active workers</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Success Rate</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{syncStats.syncSuccessRate}%</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{syncStats.completedJobs} completed</div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Failed Jobs</span>
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-xl font-bold font-mono text-red-400">{syncStats.failedJobs}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {syncStats.failedJobs > 0 ? 'Requires attention' : 'Nominal operation'}
            </div>
          </div>

          <div className="ctrl-panel p-3">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
              <span>Items Ingested</span>
              <Download className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
            </div>
            <div className="text-xl font-bold font-mono text-zinc-100">{syncStats.totalItemsSynced}</div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {syncStats.lastSyncTime ? `Last: ${new Date(syncStats.lastSyncTime).toLocaleDateString()}` : 'Never'}
            </div>
          </div>
        </div>
      )}

      {/* Control Strip & Jobs Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Data Ingestion Workers</span>
            <span className="sys-badge font-mono text-[10px]">
              {syncJobs.filter(j => j.isEnabled).length}/{syncJobs.length} Active
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={runAllSyncJobs}
              disabled={runningJobs.size > 0}
              className="sys-btn sys-btn-primary"
            >
              {runningJobs.size > 0 ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 inline" />
                  Running All...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1 inline" />
                  Execute All
                </>
              )}
            </button>
            <button 
              onClick={fetchSyncData}
              disabled={loading}
              className="sys-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="ctrl-panel-body p-0">
          {syncJobs.length > 0 ? (
            <div className="divide-y divide-zinc-800/60">
              {syncJobs.map((job) => {
                const isRunning = job.status === 'running' || runningJobs.has(getJobId(job));
                const jobId = getJobId(job);

                return (
                  <div key={jobId} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-900/40 transition-colors">
                    <div className="flex items-start md:items-center gap-3 min-w-0">
                      <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-none shrink-0 mt-0.5 md:mt-0">
                        {getJobIcon(job.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs text-zinc-100">{job.name}</span>
                          {getStatusBadge(job)}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5 max-w-xl">{job.description}</p>
                        
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-1">
                          {job.lastRun && <span>Last run: {new Date(job.lastRun).toLocaleString()}</span>}
                          {job.estimatedTime && <span>Est: {job.estimatedTime}</span>}
                        </div>

                        {job.progress > 0 && (
                          <div className="flex items-center gap-2 mt-1.5 w-48">
                            <div className="flex-1 bg-zinc-800 h-1.5 overflow-hidden">
                              <div 
                                className="bg-[var(--sys-cyan)] h-full transition-all duration-300"
                                style={{ width: `${Math.min(Math.max(job.progress ?? 0, 0), 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">{job.progress}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-zinc-400">Enabled</span>
                        <label className="sys-switch">
                          <input
                            type="checkbox"
                            checked={job.isEnabled}
                            onChange={(e) => toggleJob(jobId, e.target.checked)}
                          />
                          <span className="sys-slider" />
                        </label>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isRunning ? (
                          <button
                            onClick={() => stopSyncJob(jobId)}
                            disabled={!runningJobs.has(jobId)}
                            className="sys-btn sys-btn-danger"
                            title="Abort Worker"
                          >
                            <Square className="w-3 h-3 text-red-300" />
                          </button>
                        ) : (
                          <button
                            onClick={() => runSyncJob(jobId)}
                            disabled={!job.isEnabled}
                            className="sys-btn sys-btn-primary"
                            title="Execute Worker"
                          >
                            <Play className="w-3 h-3 text-[var(--sys-cyan)]" />
                          </button>
                        )}

                        <button
                          onClick={() => handleConfigClick(job)}
                          className="sys-btn"
                          title="Configure Parameters"
                        >
                          <Settings className="w-3.5 h-3.5 text-zinc-400" />
                        </button>

                        <button
                          onClick={() => handleViewLogs(job)}
                          className="sys-btn"
                          title="View Worker Logs"
                        >
                          <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState 
              icon={Database}
              title="No Ingestion Workers"
              description="Configure background sync routines to initiate automatic data pipelines"
            />
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-md mx-auto rounded-none">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--sys-cyan)]" />
              Configure Ingestion Routine
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Tune execution parameters for {selectedJob?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800">
              <div>
                <div className="text-xs font-medium text-zinc-200">Scheduled Trigger</div>
                <div className="text-[11px] text-zinc-500">Run this job on internal cron ticker</div>
              </div>
              <label className="sys-switch">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                />
                <span className="sys-slider" />
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setConfigModalOpen(false)}
              className="sys-btn"
            >
              Cancel
            </button>
            <button
              onClick={updateJobConfig}
              className="sys-btn sys-btn-primary"
            >
              Save Configuration
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Modal */}
      <Dialog open={logsModalOpen} onOpenChange={(open) => {
        setLogsModalOpen(open);
        if (!open && (window as any).logsCleanup) {
          (window as any).logsCleanup();
          delete (window as any).logsCleanup;
        }
      }}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-4xl mx-auto max-h-[85vh] flex flex-col rounded-none">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--sys-cyan)]" />
                  Telemetry & Ingestion Logs
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs font-mono">
                  {selectedJob?.name}
                  {(selectedJob?.status === 'running' || runningJobs.has(getJobId(selectedJob || {} as SyncJob))) && (
                    <span className="ml-2 text-emerald-400">● Live Stream</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-2">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--sys-cyan)]" />
                <span className="ml-2 text-xs font-mono text-zinc-400">Streaming logs...</span>
              </div>
            ) : selectedJobLogs.length === 0 ? (
              <AdminEmptyState 
                icon={FileText}
                title="No Log Records Found"
                description="Worker has not emitted any stream telemetry for this session"
              />
            ) : (
              <div className="bg-black border border-zinc-900 p-3 space-y-1.5 font-mono text-xs max-h-[55vh] overflow-y-auto">
                {selectedJobLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 py-1 border-b border-zinc-900/60 last:border-0">
                    <span className="text-zinc-600 text-[10px] whitespace-nowrap pt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`font-semibold uppercase text-[10px] ${getLogLevelColor(log.level)}`}>
                      [{log.level}]
                    </span>
                    <span className={`flex-1 break-all ${getLogLevelColor(log.level)}`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-3">
            <button
              onClick={() => setLogsModalOpen(false)}
              className="sys-btn"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSyncManagement;
