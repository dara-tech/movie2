import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  Monitor,
  Zap,
  Loader2,
  Tv,
  Star,
  Check,
  Eye,
  Sliders,
  Server
} from 'lucide-react';
import { 
  setDefaultServerId, 
  setDisabledServerIds
} from '../services/streamingService';

interface StreamingService {
  id: string;
  name: string;
  baseUrl: string;
  type?: string;
  quality?: string;
  description?: string;
  isEnabled: boolean;
  isDefault: boolean;
  isWorking?: boolean;
  lastChecked?: string;
  responseTime?: number;
}

const AdminStreamingManagement: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [streamingServices, setStreamingServices] = useState<StreamingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState<string | null>(null);
  const [autoDeactivateOnFail, setAutoDeactivateOnFail] = useState(true);

  const fetchStreamingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const servicesResponse = await api.get('/api/admin/streaming/services');
      const services: StreamingService[] = servicesResponse.data || [];
      setStreamingServices(services);

      const defaultOne = services.find((s) => s.isDefault);
      if (defaultOne) {
        setDefaultServerId(defaultOne.id);
      }
      const disabled = services.filter((s) => !s.isEnabled).map((s) => s.id);
      setDisabledServerIds(disabled);

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch streaming data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && ['admin', 'super_admin'].includes(user.role)) {
      fetchStreamingData();
    }
  }, [user, fetchStreamingData]);

  const handleSetDefault = async (serviceId: string) => {
    try {
      setSavingDefault(serviceId);
      setError(null);
      setSuccessMessage(null);

      const response = await api.put(`/api/admin/streaming/default/${encodeURIComponent(serviceId)}`);
      
      if (response.data?.success) {
        setStreamingServices((prev) =>
          prev.map((s) => ({
            ...s,
            isDefault: s.id === serviceId,
            isEnabled: s.id === serviceId ? true : s.isEnabled,
          }))
        );

        setDefaultServerId(serviceId);

        const currentDisabled = streamingServices
          .filter((s) => !s.isEnabled && s.id !== serviceId)
          .map((s) => s.id);
        setDisabledServerIds(currentDisabled);

        showToast(
          response.data.message || `Server '${serviceId}' is now the default streaming server!`,
          'success'
        );
      } else {
        setError(response.data?.message || 'Failed to update default server');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update default server');
    } finally {
      setSavingDefault(null);
    }
  };

  const handleToggleActive = async (serviceId: string, isEnabled: boolean) => {
    const targetService = streamingServices.find((s) => s.id === serviceId);
    if (!targetService) return;

    if (!isEnabled && targetService.isDefault) {
      showToast('Cannot deactivate the default server. Please set another server as default first.', 'warning');
      return;
    }

    try {
      setStreamingServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, isEnabled } : s))
      );

      const response = await api.put(`/api/admin/streaming/toggle/${encodeURIComponent(serviceId)}`, {
        isEnabled,
      });

      if (response.data?.success) {
        if (response.data.disabledServerIds) {
          setDisabledServerIds(response.data.disabledServerIds);
        }
        showToast(
          `Server '${targetService.name}' ${isEnabled ? 'activated' : 'deactivated'}.`,
          isEnabled ? 'success' : 'info'
        );
      } else {
        setStreamingServices((prev) =>
          prev.map((s) => (s.id === serviceId ? { ...s, isEnabled: !isEnabled } : s))
        );
        setError(response.data?.message || 'Failed to toggle server');
      }
    } catch (err: any) {
      setStreamingServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, isEnabled: !isEnabled } : s))
      );
      setError(err.response?.data?.message || err.message || 'Failed to toggle server');
    }
  };

  const testService = async (serviceId: string) => {
    try {
      setTesting(serviceId);
      setError(null);

      const response = await api.post(`/api/admin/streaming/test/${encodeURIComponent(serviceId)}`, {
        autoDeactivate: autoDeactivateOnFail,
      });

      if (response.data?.success) {
        const { isWorking, responseTime, autoDeactivated } = response.data;

        setStreamingServices((prev) =>
          prev.map((s) =>
            s.id === serviceId
              ? {
                  ...s,
                  isWorking,
                  responseTime,
                  isEnabled: autoDeactivated ? false : s.isEnabled,
                  lastChecked: new Date().toISOString(),
                }
              : s
          )
        );

        if (response.data.disabledServerIds) {
          setDisabledServerIds(response.data.disabledServerIds);
        }

        if (autoDeactivated) {
          showToast(`Server '${serviceId}' failed latency check and was auto-deactivated.`, 'warning');
        } else if (isWorking) {
          showToast(`Server '${serviceId}' pinged in ${responseTime}ms — operational!`, 'success');
        } else {
          showToast(`Server '${serviceId}' offline or unreachable.`, 'error');
        }
      }
    } catch (err: any) {
      showToast(`Test failed for ${serviceId}: ${err.message}`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const testAllServices = async () => {
    try {
      setTesting('ALL');
      setError(null);

      const response = await api.post('/api/admin/streaming/test-all', {
        autoDeactivate: autoDeactivateOnFail,
      });

      if (response.data?.success) {
        const { results, disabledServerIds: newDisabledIds, newlyDeactivatedCount } = response.data;
        const resultMap = new Map((results || []).map((r: any) => [r.id, r]));

        setStreamingServices((prev) =>
          prev.map((s) => {
            const res: any = resultMap.get(s.id);
            if (!res) return s;
            return {
              ...s,
              isWorking: res.ok,
              isEnabled: res.autoDeactivated ? false : s.isEnabled,
              responseTime: res.responseTime,
              lastChecked: new Date().toISOString(),
            };
          })
        );

        if (newDisabledIds) {
          setDisabledServerIds(newDisabledIds);
        }

        const onlineCount = (results || []).filter((r: any) => r.ok).length;
        if (newlyDeactivatedCount > 0) {
          showToast(
            `Test complete: ${onlineCount} online, ${newlyDeactivatedCount} broken stream(s) auto-deactivated.`,
            'warning'
          );
        } else {
          showToast(
            `All tested servers completed: ${onlineCount} online.`,
            'success'
          );
        }
      }
    } catch {
      for (const service of streamingServices) {
        await testService(service.id);
      }
    } finally {
      setTesting(null);
    }
  };

  if (loading && !streamingServices.length) {
    return <LoadingSpinner fullScreen text="Loading streaming management..." color="blue" size="lg" />;
  }

  const activeServices = streamingServices.filter((s) => s.isEnabled);
  const defaultService = streamingServices.find((s) => s.isDefault);

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Top Controls / Action Bar */}
      <div className="ctrl-panel" style={{ borderLeft: '4px solid var(--sys-cyan)' }}>
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="status-led led-blue led-pulse" />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  Active Streaming Embed Pipeline
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {activeServices.length} Active Streams · Default: <span className="font-mono text-[var(--sys-cyan)]">{defaultService?.name || 'None'}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoDeactivateOnFail}
                  onChange={(e) => setAutoDeactivateOnFail(e.target.checked)}
                  style={{ accentColor: 'var(--sys-red)' }}
                />
                <span>Auto-deactivate if broken</span>
              </label>

              <button
                type="button"
                onClick={testAllServices}
                disabled={testing !== null}
                className="sys-btn sys-btn-primary"
                title="Ping all streaming servers"
              >
                {testing === 'ALL' ? <Loader2 size={12} className="animate-spin" /> : <Monitor size={12} />}
                <span>Test All Streams</span>
              </button>

              <button
                type="button"
                onClick={fetchStreamingData}
                className="sys-btn"
                title="Refresh server status"
              >
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/40 rounded flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-900/20 border border-green-500/40 rounded flex items-center justify-between text-xs text-green-300">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Live Player Bar Preview */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} color="var(--sys-cyan)" />
            <span>Client Player Bar Preview (What Users See)</span>
          </div>
          <span className="sys-badge sys-badge-green font-mono">
            {activeServices.length} Active Streams
          </span>
        </div>

        <div className="ctrl-panel-body p-3">
          <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded flex items-center gap-3 overflow-x-auto">
            <span className="text-xs font-bold text-[var(--sys-text-muted)] flex items-center gap-1.5 shrink-0">
              <Tv size={14} color="var(--sys-cyan)" />
              <span>Server:</span>
            </span>
            <div className="flex items-center gap-2 overflow-x-auto">
              {activeServices.map((service, idx) => {
                const isDef = service.isDefault;
                const streamNum = idx + 1;
                return (
                  <div
                    key={service.id}
                    title={`${service.name} (${service.baseUrl})`}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border transition-all shrink-0 ${
                      isDef
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                        : 'bg-[var(--sys-panel-header)] border-[var(--sys-border)] text-[var(--sys-text-muted)]'
                    }`}
                  >
                    {isDef && <span className="status-led led-blue led-pulse" style={{ width: '6px', height: '6px' }} />}
                    <span>Stream {streamNum}</span>
                    <span className="text-[10px] text-[var(--sys-text-dim)] font-mono">
                      {service.quality || '1080p'}
                    </span>
                  </div>
                );
              })}
              {activeServices.length === 0 && (
                <span className="text-xs text-red-400 italic">No active servers enabled!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Server Availability & Default Configuration */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} />
            <span>Streaming Provider Endpoints</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="sys-badge sys-badge-green font-mono">{activeServices.length} Active</span>
            <span className="sys-badge font-mono">{streamingServices.length - activeServices.length} Inactive</span>
          </div>
        </div>

        <div className="ctrl-panel-body p-0 divide-y divide-[var(--sys-border)]">
          {streamingServices.map((service) => {
            const isDef = service.isDefault;
            const isAct = service.isEnabled;
            const isBeingTested = testing === service.id;
            const isBeingSaved = savingDefault === service.id;
            const activeIndex = activeServices.findIndex((s) => s.id === service.id);
            const streamBadge = activeIndex !== -1 ? `Stream ${activeIndex + 1}` : null;

            return (
              <div
                key={service.id}
                className={`p-3.5 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
                  isDef
                    ? 'bg-blue-950/10'
                    : isAct
                    ? 'hover:bg-[var(--sys-surface)]'
                    : 'opacity-60 hover:opacity-100 hover:bg-[var(--sys-surface)]'
                }`}
              >
                {/* Left: Server Info */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-[var(--sys-surface)] border border-[var(--sys-border)] flex items-center justify-center shrink-0">
                    <Server size={14} color={isDef ? 'var(--sys-cyan)' : isAct ? 'var(--sys-green)' : 'var(--sys-text-dim)'} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-xs sm:text-sm text-[var(--sys-text)] truncate">
                        {service.name}
                      </span>

                      {streamBadge ? (
                        <span className="sys-badge sys-badge-cyan font-mono text-[10px]">
                          {streamBadge}
                        </span>
                      ) : (
                        <span className="sys-badge font-mono text-[10px]">
                          Hidden
                        </span>
                      )}

                      <span className="sys-badge font-mono text-[10px]">
                        {service.quality || '1080p'}
                      </span>

                      {isDef && (
                        <span className="sys-badge sys-badge-green font-mono text-[10px]">
                          ★ Default
                        </span>
                      )}

                      {service.isWorking === false && (
                        <span className="sys-badge sys-badge-red font-mono text-[10px]">
                          Offline
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--sys-text-muted)] mt-1">
                      <a
                        href={service.baseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono hover:underline flex items-center gap-1"
                        style={{ color: 'var(--sys-text-dim)' }}
                      >
                        <span>{service.baseUrl}</span>
                        <ExternalLink size={10} />
                      </a>

                      {service.responseTime ? (
                        <span className="font-mono text-[var(--sys-cyan)]">
                          {service.responseTime}ms
                        </span>
                      ) : null}

                      {service.description ? (
                        <span className="text-[var(--sys-text-dim)] hidden lg:inline">· {service.description}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  {isDef ? (
                    <div className="flex items-center gap-1 text-xs text-blue-400 font-medium px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded">
                      <Check size={12} />
                      <span>Default</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(service.id)}
                      disabled={isBeingSaved}
                      className="sys-btn"
                      title="Set as user default server"
                    >
                      {isBeingSaved ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
                      <span>Set Default</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--sys-text-dim)]">
                      {isAct ? 'ON' : 'OFF'}
                    </span>
                    <label className="sys-switch">
                      <input
                        type="checkbox"
                        checked={isAct}
                        disabled={isDef}
                        onChange={(e) => handleToggleActive(service.id, e.target.checked)}
                      />
                      <span className="sys-slider"></span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => testService(service.id)}
                    disabled={isBeingTested}
                    className="sys-btn"
                    title="Ping test latency"
                  >
                    {isBeingTested ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                    <span>Test</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminStreamingManagement;
