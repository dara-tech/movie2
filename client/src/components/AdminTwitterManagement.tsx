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
  ShieldCheck,
  Zap,
  Film
} from 'lucide-react';
import { TwitterBrandIcon } from './admin/SocialBrandIcons';
import { useToast } from '../contexts/ToastContext';

const AdminTwitterManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [accessTokenSecret, setAccessTokenSecret] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [postDailyTopMovies, setPostDailyTopMovies] = useState(false);
  const [notifyNewMovies, setNotifyNewMovies] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showAccessTokenSecret, setShowAccessTokenSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        if (data.twitter) {
          setApiKey(data.twitter.apiKey || '');
          setApiSecret(data.twitter.apiSecret || '');
          setBearerToken(data.twitter.bearerToken || '');
          setAccessToken(data.twitter.accessToken || '');
          setAccessTokenSecret(data.twitter.accessTokenSecret || '');
          setSiteUrl(data.twitter.siteUrl || '');
          setEnabled(data.twitter.enabled || false);
          setPostDailyTopMovies(data.twitter.postDailyTopMovies || false);
          setNotifyNewMovies(data.twitter.notifyNewMovies !== false);
        }
      }
    } catch (error: any) {
      showToast('Failed to load Twitter/X settings', 'error');
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
      const response = await api.put('/api/site-settings/twitter', {
        apiKey: apiKey.trim() || null,
        apiSecret: apiSecret.trim() || null,
        bearerToken: bearerToken.trim() || null,
        accessToken: accessToken.trim() || null,
        accessTokenSecret: accessTokenSecret.trim() || null,
        siteUrl: siteUrl.trim() || null,
        enabled: Boolean(enabled && apiKey.trim() && apiSecret.trim() && accessToken.trim() && accessTokenSecret.trim()),
        postDailyTopMovies: Boolean(postDailyTopMovies),
        notifyNewMovies: Boolean(notifyNewMovies)
      });

      if (response.data.success) {
        showToast('Twitter/X settings saved successfully', 'success');
        await fetchSettings();
      } else {
        showToast(response.data.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save Twitter/X settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey.trim() || !apiSecret.trim() || !accessToken.trim() || !accessTokenSecret.trim()) {
      showToast('Please enter all required credentials first', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/twitter/test');

      if (response.data.success) {
        setTestResult({ success: true, message: 'Test tweet sent successfully! Check your Twitter/X timeline.' });
        showToast('Test tweet sent successfully', 'success');
      } else {
        setTestResult({ success: false, message: response.data.message || 'Failed to send test tweet' });
        showToast(response.data.message || 'Failed to send test tweet', 'error');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to send test tweet';
      setTestResult({ success: false, message: errorMessage });
      showToast(errorMessage, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handlePostDailyTop = async () => {
    if (!enabled || !postDailyTopMovies) {
      showToast('Please enable Twitter/X and daily top movies posting first', 'error');
      return;
    }

    setPosting(true);
    try {
      const response = await api.post('/api/site-settings/twitter/post-daily-top');
      if (response.data.success) {
        showToast('Daily top movies posted successfully!', 'success');
      } else {
        showToast(response.data.message || 'Failed to post daily top movies', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to post daily top movies', 'error');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading Twitter/X settings..." />;
  }

  const hasRequiredCredentials = !!(apiKey.trim() && apiSecret.trim() && accessToken.trim() && accessTokenSecret.trim());

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Status banner */}
      <div 
        className="ctrl-panel"
        style={{ borderLeft: `4px solid ${enabled && hasRequiredCredentials ? 'var(--sys-cyan)' : 'var(--sys-amber)'}` }}
      >
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`status-led ${enabled && hasRequiredCredentials ? 'led-blue led-pulse' : 'led-amber'}`} />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  {enabled && hasRequiredCredentials ? 'Twitter / X Syndication Active' : 'Twitter / X Idle'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {enabled && hasRequiredCredentials 
                    ? 'Publishing new releases and daily top movie recommendations to Twitter/X' 
                    : 'Configure Twitter developer credentials below to enable live posting.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !hasRequiredCredentials}
                className="sys-btn"
                title="Send a test tweet to verify keys"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Test Tweet</span>
              </button>

              {enabled && postDailyTopMovies && (
                <button
                  type="button"
                  onClick={handlePostDailyTop}
                  disabled={posting || !hasRequiredCredentials}
                  className="sys-btn sys-btn-primary"
                  title="Tweet top 3 movies right now"
                >
                  {posting ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  <span>Post Daily Top Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TwitterBrandIcon size={16} active />
            <span>Twitter / X API v2 Credentials</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {hasRequiredCredentials ? 'Keys Present' : 'Setup Required'}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* API Key & API Secret */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Consumer API Key</span>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API Key"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
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
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <div className="sys-label">
                  <span>Consumer API Secret</span>
                  <button
                    type="button"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showApiSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showApiSecret ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="API Secret"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiSecret(!showApiSecret)}
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
                    {showApiSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Access Token & Access Token Secret */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Access Token</span>
                  <button
                    type="button"
                    onClick={() => setShowAccessToken(!showAccessToken)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showAccessToken ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAccessToken ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Access Token"
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
              </div>

              <div>
                <div className="sys-label">
                  <span>Access Token Secret</span>
                  <button
                    type="button"
                    onClick={() => setShowAccessTokenSecret(!showAccessTokenSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showAccessTokenSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAccessTokenSecret ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={accessTokenSecret}
                    onChange={(e) => setAccessTokenSecret(e.target.value)}
                    placeholder="Access Token Secret"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessTokenSecret(!showAccessTokenSecret)}
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
                    {showAccessTokenSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Site URL */}
            <div>
              <div className="sys-label">
                <span>Public Site Base URL</span>
                <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">e.g. https://moviestream.cc</span>
              </div>
              <input
                type="url"
                className="sys-input font-mono"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://moviestream.cc"
              />
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
                  Enable Twitter/X Posting
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)' }}>
                  Activate automated broadcasting to Twitter/X
                </div>
              </div>
              <label className="sys-switch">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!hasRequiredCredentials}
                  onChange={(e) => {
                    if (hasRequiredCredentials) {
                      setEnabled(e.target.checked);
                    } else {
                      showToast('Please enter all required API credentials first', 'error');
                    }
                  }}
                />
                <span className="sys-slider"></span>
              </label>
            </div>

            {/* Preferences */}
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
                  Automation Options
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Auto-Tweet Every New Movie</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Tweet with synopsis &amp; trailer link when movies are added</div>
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
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Post Daily Top Movies</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Post top 3 trending titles daily at 10:00 AM</div>
                  </div>
                  <label className="sys-switch">
                    <input
                      type="checkbox"
                      checked={postDailyTopMovies}
                      onChange={(e) => setPostDailyTopMovies(e.target.checked)}
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
                  disabled={saving || !hasRequiredCredentials}
                  className="sys-btn sys-btn-primary"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Save Configuration</span>
                </button>

                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !hasRequiredCredentials || !enabled}
                  className="sys-btn"
                >
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  <span>Test Tweet</span>
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
            <span>Twitter / X Developer Setup</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)' }}>
            <li>Log in to <strong>developer.twitter.com</strong> and create a project with Read and Write permissions.</li>
            <li>Generate your <strong>Consumer Keys</strong> and <strong>Authentication Tokens</strong>.</li>
            <li>Paste keys above and click <strong>Test Tweet</strong> to verify your account connection.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminTwitterManagement;
