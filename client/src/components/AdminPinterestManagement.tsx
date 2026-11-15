import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Info, 
  ExternalLink,
  Film,
  RefreshCw,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { PinterestBrandIcon } from './admin/SocialBrandIcons';
import { useToast } from '../contexts/ToastContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  privacy?: string;
}

const AdminPinterestManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [pinningLatest, setPinningLatest] = useState(false);

  const [accessToken, setAccessToken] = useState('');
  const [boardId, setBoardId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [notifyNewMovies, setNotifyNewMovies] = useState(true);
  const [notifyNewTvShows, setNotifyNewTvShows] = useState(true);

  const [showAccessToken, setShowAccessToken] = useState(false);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; pinUrl?: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        if (data.pinterest) {
          setAccessToken(data.pinterest.accessToken || '');
          setBoardId(data.pinterest.boardId || '');
          setSiteUrl(data.pinterest.siteUrl || '');
          setEnabled(data.pinterest.enabled || false);
          setNotifyNewMovies(data.pinterest.notifyNewMovies !== false);
          setNotifyNewTvShows(data.pinterest.notifyNewTvShows !== false);
        }
      }
    } catch (error: any) {
      showToast('Failed to load Pinterest settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setTestResult(null);

    try {
      const response = await api.put('/api/site-settings/pinterest', {
        accessToken: accessToken.trim() || null,
        boardId: boardId.trim() || null,
        siteUrl: siteUrl.trim() || null,
        enabled: Boolean(enabled && accessToken.trim() && boardId.trim()),
        notifyNewMovies: Boolean(notifyNewMovies),
        notifyNewTvShows: Boolean(notifyNewTvShows)
      });

      if (response.data.success) {
        showToast('Pinterest settings saved successfully', 'success');
        await fetchSettings();
      } else {
        showToast(response.data.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save Pinterest settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fetchBoards = async () => {
    if (!accessToken.trim()) {
      showToast('Please enter an Access Token first', 'error');
      return;
    }

    setLoadingBoards(true);
    try {
      await api.put('/api/site-settings/pinterest', {
        accessToken: accessToken.trim(),
        boardId: boardId.trim() || null,
        siteUrl: siteUrl.trim() || null,
        enabled,
        notifyNewMovies,
        notifyNewTvShows
      });

      const response = await api.get('/api/site-settings/pinterest/boards');
      if (response.data.success && response.data.boards) {
        setBoards(response.data.boards);
        if (response.data.boards.length > 0 && !boardId.trim()) {
          setBoardId(response.data.boards[0].id);
        }
        showToast(`Loaded ${response.data.boards.length} Pinterest boards`, 'success');
      } else {
        showToast(response.data.message || 'Could not fetch boards', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to fetch Pinterest boards', 'error');
    } finally {
      setLoadingBoards(false);
    }
  };

  const handleTest = async () => {
    if (!accessToken.trim()) {
      showToast('Please enter an Access Token first', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await api.put('/api/site-settings/pinterest', {
        accessToken: accessToken.trim(),
        boardId: boardId.trim() || null,
        siteUrl: siteUrl.trim() || null,
        enabled,
        notifyNewMovies,
        notifyNewTvShows
      });

      const response = await api.post('/api/site-settings/pinterest/test');
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Connected to Pinterest successfully!'
        });
        showToast('Pinterest connection successful!', 'success');
        if (response.data.data?.boards?.length > 0) {
          setBoards(response.data.data.boards);
        }
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to connect to Pinterest'
        });
        showToast(response.data.message || 'Failed to connect to Pinterest', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to test Pinterest connection';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handlePinLatest = async () => {
    if (!boardId.trim()) {
      showToast('Please enter or select a Pinterest Board ID first', 'error');
      return;
    }

    setPinningLatest(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/pinterest/post-latest');
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Successfully pinned latest movie to Pinterest!',
          pinUrl: response.data.pinUrl
        });
        showToast('Movie pinned to Pinterest successfully!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to pin movie to Pinterest'
        });
        showToast(response.data.message || 'Failed to pin movie to Pinterest', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to pin movie to Pinterest';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setPinningLatest(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading Pinterest settings..." />;
  }

  const isConfigured = !!(accessToken.trim() && boardId.trim());

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Status banner */}
      <div 
        className="ctrl-panel"
        style={{ borderLeft: `4px solid ${enabled && isConfigured ? 'var(--sys-red)' : 'var(--sys-amber)'}` }}
      >
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`status-led ${enabled && isConfigured ? 'led-green led-pulse' : 'led-amber'}`} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  {enabled && isConfigured ? 'Pinterest Automated Pinning Active' : 'Pinterest Integration Idle'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {enabled && isConfigured 
                    ? `Pinning movie poster cards to board ID: ${boardId}` 
                    : 'Provide Pinterest API v5 token and board ID below to enable auto-pinning.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !accessToken.trim()}
                className="sys-btn"
                title="Verify Pinterest API token"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Verify Token</span>
              </button>

              <button
                type="button"
                onClick={handlePinLatest}
                disabled={pinningLatest || !isConfigured}
                className="sys-btn sys-btn-primary"
                title="Create a pin for newest movie"
              >
                {pinningLatest ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>Pin Latest Movie</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PinterestBrandIcon size={16} active />
            <span>Pinterest API v5 Credentials &amp; Boards</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {isConfigured ? 'Connected' : 'Setup Required'}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Access Token */}
            <div>
              <div className="sys-label">
                <span>Pinterest API Access Token</span>
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                >
                  {showAccessToken ? 'Hide Token' : 'Show Token'}
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAccessToken ? 'text' : 'password'}
                  className="sys-input font-mono"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="pina_..."
                  style={{ paddingRight: '36px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--sys-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showAccessToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                Acquired from Pinterest Developer Portal with <code>boards:read</code> and <code>pins:write</code> scopes.
              </p>
            </div>

            {/* Target Board & Site URL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Target Board ID</span>
                  <button
                    type="button"
                    onClick={fetchBoards}
                    disabled={loadingBoards || !accessToken.trim()}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={10} className={loadingBoards ? 'animate-spin' : ''} />
                    <span>Load Boards</span>
                  </button>
                </div>
                {boards.length > 0 ? (
                  <Select
                    value={boardId || 'none'}
                    onValueChange={(val) => setBoardId(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md font-mono">
                      <SelectValue placeholder="Select a board..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                      <SelectItem value="none">Select a board...</SelectItem>
                      {boards.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    type="text"
                    className="sys-input font-mono"
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                    placeholder="Enter board ID or click Load Boards"
                  />
                )}
              </div>

              <div>
                <div className="sys-label">
                  <span>Pin Destination Link URL</span>
                </div>
                <input
                  type="url"
                  className="sys-input font-mono"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://moviestream.cc"
                />
              </div>
            </div>

            {/* Enable Master Switch */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'var(--sys-surface)',
              border: '1px solid var(--sys-border)',
              borderRadius: '5px'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--sys-text)' }}>
                  Enable Pinterest Auto-Pinning
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)' }}>
                  Automatically pin movie poster graphics with movie trailer links
                </div>
              </div>
              <label className="sys-switch">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!isConfigured}
                  onChange={(e) => {
                    if (isConfigured) {
                      setEnabled(e.target.checked);
                    } else {
                      showToast('Please enter Access Token and Board ID first', 'error');
                    }
                  }}
                />
                <span className="sys-slider"></span>
              </label>
            </div>

            {/* Rules */}
            {enabled && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '14px',
                background: 'var(--sys-surface)',
                border: '1px solid var(--sys-border)',
                borderRadius: '5px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--sys-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pin Directives
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Pin New Movies</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Create a Pin whenever a movie is added</div>
                  </div>
                  <label className="sys-switch">
                    <input
                      type="checkbox"
                      checked={notifyNewMovies}
                      onChange={(e) => setNotifyNewMovies(e.target.checked)}
                    />
                    <span className="sys-slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--sys-border)' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Pin New TV Shows</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Create a Pin whenever a TV series is added</div>
                  </div>
                  <label className="sys-switch">
                    <input
                      type="checkbox"
                      checked={notifyNewTvShows}
                      onChange={(e) => setNotifyNewTvShows(e.target.checked)}
                    />
                    <span className="sys-slider"></span>
                  </label>
                </div>
              </div>
            )}

            {/* Test result message banner */}
            {testResult && (
              <div 
                className="p-3 rounded flex items-center justify-between text-xs"
                style={{
                  background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: testResult.success ? 'var(--sys-green)' : 'var(--sys-red)'
                }}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
                  <span>{testResult.message}</span>
                </div>
                {testResult.pinUrl && (
                  <a
                    href={testResult.pinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono hover:underline"
                    style={{ color: 'var(--sys-cyan)' }}
                  >
                    <span>View Pin</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--sys-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="submit"
                  disabled={saving || !isConfigured}
                  className="sys-btn sys-btn-primary"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Save Configuration</span>
                </button>

                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !accessToken.trim()}
                  className="sys-btn"
                >
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  <span>Test Connection</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Guide Note */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={14} color="var(--sys-cyan)" />
            <span>Pinterest Developer App Instructions</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)' }}>
            <li>Register an app at <strong>developers.pinterest.com</strong>.</li>
            <li>Generate an Access Token with <code>boards:read</code> and <code>pins:write</code> permissions.</li>
            <li>Click <strong>Load Boards</strong> to automatically populate your board IDs.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminPinterestManagement;
