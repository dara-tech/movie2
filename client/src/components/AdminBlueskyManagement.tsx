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
  ExternalLink,
  Film,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { BlueskyBrandIcon } from './admin/SocialBrandIcons';
import { useToast } from '../contexts/ToastContext';

const AdminBlueskyManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [postingLatest, setPostingLatest] = useState(false);
  const [postingNext, setPostingNext] = useState(false);

  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [notifyNewMovies, setNotifyNewMovies] = useState(true);
  const [notifyNewTvShows, setNotifyNewTvShows] = useState(true);
  const [autoPostEveryMinute, setAutoPostEveryMinute] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; postUrl?: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        if (data.bluesky) {
          setHandle(data.bluesky.handle || '');
          setAppPassword(data.bluesky.appPassword || '');
          setSiteUrl(data.bluesky.siteUrl || '');
          setEnabled(data.bluesky.enabled || false);
          setNotifyNewMovies(data.bluesky.notifyNewMovies !== false);
          setNotifyNewTvShows(data.bluesky.notifyNewTvShows !== false);
          setAutoPostEveryMinute(data.bluesky.autoPostEveryMinute !== false);
        }
      }
    } catch (error: any) {
      showToast('Failed to load Bluesky settings', 'error');
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
      const cleanHandle = handle.trim().replace(/^@/, '');

      const response = await api.put('/api/site-settings/bluesky', {
        handle: cleanHandle || null,
        appPassword: appPassword.trim() || null,
        siteUrl: siteUrl.trim() || null,
        enabled: Boolean(enabled && cleanHandle && appPassword.trim()),
        notifyNewMovies: Boolean(notifyNewMovies),
        notifyNewTvShows: Boolean(notifyNewTvShows),
        autoPostEveryMinute: Boolean(autoPostEveryMinute)
      });

      if (response.data.success) {
        showToast('Bluesky settings saved successfully', 'success');
        await fetchSettings();
      } else {
        showToast(response.data.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save Bluesky settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!handle.trim() || !appPassword.trim()) {
      showToast('Please enter your Bluesky Handle and App Password first', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await api.put('/api/site-settings/bluesky', {
        handle: handle.trim().replace(/^@/, ''),
        appPassword: appPassword.trim(),
        siteUrl: siteUrl.trim() || null,
        enabled,
        notifyNewMovies,
        notifyNewTvShows,
        autoPostEveryMinute
      });

      const response = await api.post('/api/site-settings/bluesky/test');

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Connected to Bluesky successfully!'
        });
        showToast('Bluesky connection verified!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to connect to Bluesky'
        });
        showToast(response.data.message || 'Failed to connect to Bluesky', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to test Bluesky connection';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handlePostLatest = async () => {
    setPostingLatest(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/bluesky/post-latest');
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Successfully posted latest movie to Bluesky!',
          postUrl: response.data.postUrl
        });
        showToast('Movie posted to Bluesky successfully!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to post to Bluesky'
        });
        showToast(response.data.message || 'Failed to post to Bluesky', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to post to Bluesky';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setPostingLatest(false);
    }
  };

  const handlePostNext = async () => {
    setPostingNext(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/bluesky/post-next');
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Successfully posted next media to Bluesky!',
          postUrl: response.data.data?.postUrl
        });
        showToast(response.data.message || 'Posted to Bluesky successfully!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to post to Bluesky'
        });
        showToast(response.data.message || 'Failed to post to Bluesky', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to post to Bluesky';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setPostingNext(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading Bluesky settings..." />;
  }

  const isConfigured = !!(handle.trim() && appPassword.trim());

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Status banner */}
      <div 
        className="ctrl-panel"
        style={{ borderLeft: `4px solid ${enabled && isConfigured ? 'var(--sys-cyan)' : 'var(--sys-amber)'}` }}
      >
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`status-led ${enabled && isConfigured ? 'led-blue led-pulse' : 'led-amber'}`} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  {enabled && isConfigured ? 'Bluesky Automated Broadcast Active' : 'Bluesky Broadcast Idle'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {enabled && isConfigured 
                    ? `Publishing rich video cards to @${handle.replace(/^@/, '')}` 
                    : 'Configure credentials below to enable live AT Protocol syndication.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !isConfigured}
                className="sys-btn"
                title="Verify connection with Bluesky AT Protocol"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Verify Session</span>
              </button>

              <button
                type="button"
                onClick={handlePostNext}
                disabled={postingNext || !isConfigured}
                className="sys-btn sys-btn-primary"
                title="Post next catalog title to Bluesky right now"
              >
                {postingNext ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>Post Title Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BlueskyBrandIcon size={16} active />
            <span>Bluesky AT Protocol Account Settings</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {isConfigured ? 'Configured' : 'Setup Required'}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Handle & App Password */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Bluesky Handle</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-cyan)' }} className="font-mono">
                    e.g. moviestream.bsky.social
                  </span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="yourhandle.bsky.social"
                />
                <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                  Your public Bluesky username (do not include the &apos;@&apos; prefix).
                </p>
              </div>

              <div>
                <div className="sys-label">
                  <span>App Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showPassword ? 'Hide Key' : 'Show Key'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                  Generated in Bluesky: <em>Settings &gt; Privacy and Security &gt; App Passwords</em>.
                </p>
              </div>
            </div>

            {/* Site URL */}
            <div>
              <div className="sys-label">
                <span>Public Site Base URL</span>
                <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">
                  For embedded player link cards
                </span>
              </div>
              <input
                type="url"
                className="sys-input font-mono"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://moviestream.cc"
              />
              <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                Used to construct OpenGraph rich preview cards with trailer play buttons.
              </p>
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
                  Enable Bluesky Automation
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)' }}>
                  Automatically publish cards with poster art and watch links
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
                      showToast('Please enter Handle and App Password first', 'error');
                    }
                  }}
                />
                <span className="sys-slider"></span>
              </label>
            </div>

            {/* Preference Toggles */}
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
                  Broadcasting Rules
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Notify for New Movies</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Post movie announcement with poster thumbnail</div>
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
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Notify for New TV Shows</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Post new TV series announcements</div>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--sys-border)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Auto-Post Every Minute</span>
                      <span className="sys-badge sys-badge-green font-mono">⚡ 1 Min Cron</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Periodically push catalog titles with zero manual intervention</div>
                  </div>
                  <label className="sys-switch">
                    <input
                      type="checkbox"
                      checked={autoPostEveryMinute}
                      onChange={(e) => setAutoPostEveryMinute(e.target.checked)}
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
                {testResult.postUrl && (
                  <a
                    href={testResult.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono hover:underline"
                    style={{ color: 'var(--sys-cyan)' }}
                  >
                    <span>View Post</span>
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
                  disabled={testing || !isConfigured}
                  className="sys-btn"
                >
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  <span>Test Connection</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handlePostLatest}
                  disabled={postingLatest || !isConfigured}
                  className="sys-btn"
                  title="Broadcast the single newest movie to Bluesky"
                >
                  {postingLatest ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
                  <span>Post Latest Movie</span>
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
            <BlueskyBrandIcon size={14} active />
            <span>Bluesky Free API Setup Guide</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <ol style={{ listStyle: 'decimal', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)' }}>
            <li>Sign up or log in at <strong>bsky.app</strong>. No developer review or waiting period required.</li>
            <li>Go to <strong>Settings &gt; Privacy and Security &gt; App Passwords</strong>.</li>
            <li>Click <strong>Add App Password</strong>, name it &quot;Movie Stream Bot&quot;, and copy the generated password.</li>
            <li>Enter your handle and App Password above, then click <strong>Verify Session</strong>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AdminBlueskyManagement;
