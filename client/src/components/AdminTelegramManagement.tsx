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
  RefreshCw,
  Film,
  Tv,
  Zap
} from 'lucide-react';
import { TelegramBrandIcon } from './admin/SocialBrandIcons';
import { useToast } from '../contexts/ToastContext';

const AdminTelegramManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [notifyNewMovies, setNotifyNewMovies] = useState(true);
  const [notifyNewTvShows, setNotifyNewTvShows] = useState(true);
  const [autoPostEveryMinute, setAutoPostEveryMinute] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingTvShows, setSyncingTvShows] = useState(false);
  const [postingNext, setPostingNext] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        if (data.telegram) {
          setBotToken(data.telegram.botToken || '');
          setChatId(data.telegram.chatId || '');
          setSiteUrl(data.telegram.siteUrl || '');
          setEnabled(data.telegram.enabled || false);
          setNotifyNewMovies(data.telegram.notifyNewMovies !== false);
          setNotifyNewTvShows(data.telegram.notifyNewTvShows !== false);
          setAutoPostEveryMinute(data.telegram.autoPostEveryMinute !== false);
        }
      }
    } catch (error: any) {
      showToast('Failed to load Telegram settings', 'error');
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
      const response = await api.put('/api/site-settings/telegram', {
        botToken: botToken.trim() || null,
        chatId: chatId.trim() || null,
        siteUrl: siteUrl.trim() || null,
        enabled: Boolean(enabled && botToken.trim() && chatId.trim()),
        notifyNewMovies: Boolean(notifyNewMovies),
        notifyNewTvShows: Boolean(notifyNewTvShows),
        autoPostEveryMinute: Boolean(autoPostEveryMinute)
      });

      if (response.data.success) {
        showToast('Telegram settings saved successfully', 'success');
        await fetchSettings();
      } else {
        showToast(response.data.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save Telegram settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Please enter bot token and chat ID first', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/telegram/test', {
        botToken: botToken.trim(),
        chatId: chatId.trim()
      });

      if (response.data.success) {
        setTestResult({ success: true, message: 'Test message sent successfully! Check your Telegram channel.' });
        showToast('Test message sent successfully', 'success');
      } else {
        setTestResult({ success: false, message: response.data.message || 'Failed to send test message' });
        showToast(response.data.message || 'Failed to send test message', 'error');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send test message';
      setTestResult({ success: false, message: errorMessage });
      showToast(errorMessage, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncLast100 = async () => {
    if (!enabled) {
      showToast('Please enable Telegram notifications first', 'error');
      return;
    }

    setSyncing(true);
    try {
      const response = await api.post('/api/auto-sync/sync-last-100-movies');
      if (response.data.success) {
        showToast('Syncing last 100 movies started! Notifications queued.', 'success');
      } else {
        showToast(response.data.message || 'Failed to start sync', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to start sync', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncLast100TvShows = async () => {
    if (!enabled) {
      showToast('Please enable Telegram notifications first', 'error');
      return;
    }

    setSyncingTvShows(true);
    try {
      const response = await api.post('/api/auto-sync/sync-last-100-tvshows');
      if (response.data.success) {
        showToast('Syncing last 100 TV shows started! Notifications queued.', 'success');
      } else {
        showToast(response.data.message || 'Failed to start sync', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to start sync', 'error');
    } finally {
      setSyncingTvShows(false);
    }
  };

  const handlePostNext = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Please enter Bot Token and Chat ID first', 'error');
      return;
    }

    setPostingNext(true);
    try {
      const response = await api.post('/api/site-settings/telegram/post-next');
      if (response.data.success) {
        showToast(response.data.message || 'Movie posted to Telegram successfully!', 'success');
      } else {
        showToast(response.data.message || 'Failed to post movie', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to post movie to Telegram', 'error');
    } finally {
      setPostingNext(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading Telegram settings..." />;
  }

  const isConfigured = !!(botToken.trim() && chatId.trim());

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Status banner */}
      <div 
        className="ctrl-panel"
        style={{ borderLeft: `4px solid ${enabled && isConfigured ? 'var(--sys-green)' : 'var(--sys-amber)'}` }}
      >
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`status-led ${enabled && isConfigured ? 'led-green led-pulse' : 'led-amber'}`} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  {enabled && isConfigured ? 'Telegram Broadcasting Active' : 'Telegram Broadcasting Idle'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {enabled && isConfigured 
                    ? `Posting new media and automated broadcasts to ${chatId}` 
                    : 'Configure credentials below to enable live streaming alerts.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !isConfigured}
                className="sys-btn"
                title="Send a test message to your channel"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Test Ping</span>
              </button>

              <button
                type="button"
                onClick={handlePostNext}
                disabled={postingNext || !isConfigured}
                className="sys-btn sys-btn-primary"
                title="Broadcast the next title to your channel right now"
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
            <TelegramBrandIcon size={16} active />
            <span>Telegram Bot & Channel Settings</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {isConfigured ? 'Configured' : 'Setup Required'}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bot API Token */}
            <div>
              <div className="sys-label">
                <span>Telegram Bot API Token</span>
                {botToken && botToken.includes(':') && (
                  <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">
                    Bot ID: {botToken.split(':')[0]}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  className="sys-input font-mono"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  style={{ paddingRight: '36px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
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
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                Create a bot via <strong>@BotFather</strong> on Telegram to acquire your API access token.
              </p>
            </div>

            {/* Target Channel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Target Channel or Group ID</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">
                    e.g. -1003606758795
                  </span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-1003606758795 or @yourchannel"
                />
                <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                  Target channel or supergroup identifier (negative prefix required for channels).
                </p>
              </div>

              <div>
                <div className="sys-label">
                  <span>Public Site URL for Player Links</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-cyan)' }} className="font-mono">
                    e.g. https://moviestream.cc
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
                  Base web URL attached to streaming & watch buttons in Telegram broadcasts.
                </p>
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
                  Enable Telegram Notifications
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)' }}>
                  Master switch to activate all automated channel broadcasts
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
                      showToast('Please enter Bot Token and Chat ID first', 'error');
                    }
                  }}
                />
                <span className="sys-slider"></span>
              </label>
            </div>

            {/* Preferences Section */}
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
                  Broadcast Rules & Schedules
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Notify for New Movies</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Publish poster and player link when a new movie is indexed</div>
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
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Publish poster and show link when new TV series are indexed</div>
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
                      <span className="sys-badge sys-badge-green font-mono">⚡ 1 Min Interval</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Background cron periodically posts catalog titles to keep the channel active</div>
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
                className="p-3 rounded flex items-center gap-2 text-xs"
                style={{
                  background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: testResult.success ? 'var(--sys-green)' : 'var(--sys-red)'
                }}
              >
                {testResult.success ? <CheckCircle size={15} /> : <XCircle size={15} />}
                <span>{testResult.message}</span>
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
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Test Bot</span>
                </button>
              </div>

              {enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSyncLast100}
                    disabled={syncing || syncingTvShows || !isConfigured}
                    className="sys-btn"
                    title="Send telegram notifications for last 100 movies"
                  >
                    {syncing ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
                    <span>Sync 100 Movies</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncLast100TvShows}
                    disabled={syncing || syncingTvShows || !isConfigured}
                    className="sys-btn"
                    title="Send telegram notifications for last 100 TV shows"
                  >
                    {syncingTvShows ? <Loader2 size={13} className="animate-spin" /> : <Tv size={13} />}
                    <span>Sync 100 TV Shows</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Guide Note */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={14} color="var(--sys-cyan)" />
            <span>Telegram Bot Setup Reference</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)' }}>
            <li>Open Telegram and message <strong>@BotFather</strong> to create your bot and obtain the API token.</li>
            <li>Add your bot as an <strong>Administrator</strong> with &quot;Post Messages&quot; permission in your target channel.</li>
            <li>Obtain your Channel ID (e.g. <code>-1003606758795</code>) by forwarding a message from the channel to <strong>@userinfobot</strong>.</li>
            <li>Configure your Public Site URL so viewers clicking &quot;Watch Now&quot; buttons in Telegram are redirected to your domain.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminTelegramManagement;
