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
  Zap,
  ShieldCheck
} from 'lucide-react';
import { RedditBrandIcon } from './admin/SocialBrandIcons';
import { useToast } from '../contexts/ToastContext';

const AdminRedditManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [postingLatest, setPostingLatest] = useState(false);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [postType, setPostType] = useState<'link' | 'self'>('link');
  const [enabled, setEnabled] = useState(false);
  const [notifyNewMovies, setNotifyNewMovies] = useState(true);
  const [notifyNewTvShows, setNotifyNewTvShows] = useState(true);

  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; postUrl?: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        if (data.reddit) {
          setClientId(data.reddit.clientId || '');
          setClientSecret(data.reddit.clientSecret || '');
          setUsername(data.reddit.username || '');
          setPassword(data.reddit.password || '');
          setSubreddit(data.reddit.subreddit || '');
          setSiteUrl(data.reddit.siteUrl || '');
          setPostType(data.reddit.postType === 'self' ? 'self' : 'link');
          setEnabled(data.reddit.enabled || false);
          setNotifyNewMovies(data.reddit.notifyNewMovies !== false);
          setNotifyNewTvShows(data.reddit.notifyNewTvShows !== false);
        }
      }
    } catch (error: any) {
      showToast('Failed to load Reddit settings', 'error');
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
      const cleanSubreddit = subreddit.trim().replace(/^r\//i, '').replace(/^\/r\//i, '');

      const response = await api.put('/api/site-settings/reddit', {
        clientId: clientId.trim() || null,
        clientSecret: clientSecret.trim() || null,
        username: username.trim() || null,
        password: password.trim() || null,
        subreddit: cleanSubreddit || null,
        siteUrl: siteUrl.trim() || null,
        postType,
        enabled: Boolean(enabled && clientId.trim() && clientSecret.trim() && username.trim() && password.trim() && cleanSubreddit),
        notifyNewMovies: Boolean(notifyNewMovies),
        notifyNewTvShows: Boolean(notifyNewTvShows)
      });

      if (response.data.success) {
        showToast('Reddit settings saved successfully', 'success');
        await fetchSettings();
      } else {
        showToast(response.data.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save Reddit settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !username.trim() || !password.trim()) {
      showToast('Please enter Client ID, Secret, Username, and Password first', 'error');
      return;
    }

    if (!subreddit.trim()) {
      showToast('Please enter a target Subreddit', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await api.put('/api/site-settings/reddit', {
        clientId: clientId.trim() || null,
        clientSecret: clientSecret.trim() || null,
        username: username.trim() || null,
        password: password.trim() || null,
        subreddit: subreddit.trim().replace(/^r\//i, ''),
        siteUrl: siteUrl.trim() || null,
        postType,
        enabled,
        notifyNewMovies,
        notifyNewTvShows
      });

      const response = await api.post('/api/site-settings/reddit/test');

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Reddit credentials verified successfully!'
        });
        showToast('Reddit connection verified successfully!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to verify Reddit connection'
        });
        showToast(response.data.message || 'Failed to verify Reddit connection', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to test Reddit connection';
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
      const response = await api.post('/api/site-settings/reddit/post-latest');
      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Successfully posted latest movie to Reddit!',
          postUrl: response.data.postUrl
        });
        showToast('Movie posted to Reddit successfully!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to post movie to Reddit'
        });
        showToast(response.data.message || 'Failed to post movie to Reddit', 'error');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to post movie to Reddit';
      setTestResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setPostingLatest(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading Reddit settings..." />;
  }

  const isConfigured = !!(clientId.trim() && clientSecret.trim() && username.trim() && password.trim() && subreddit.trim());

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
                  {enabled && isConfigured ? 'Reddit Subreddit Automation Active' : 'Reddit Automation Idle'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {enabled && isConfigured 
                    ? `Posting new streaming submissions to r/${subreddit.replace(/^r\//i, '')}` 
                    : 'Configure Reddit Script app credentials below to enable automated posts.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !isConfigured}
                className="sys-btn"
                title="Verify Reddit script credentials"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Verify Script</span>
              </button>

              <button
                type="button"
                onClick={handlePostLatest}
                disabled={postingLatest || !isConfigured}
                className="sys-btn sys-btn-primary"
                title="Submit latest movie link to subreddit"
              >
                {postingLatest ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
                <span>Post Latest Movie</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RedditBrandIcon size={16} active />
            <span>Reddit Script Application Credentials</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {isConfigured ? 'Connected' : 'Setup Required'}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Client ID & Secret */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Script App Client ID</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">Under app name</span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 14-character string"
                />
              </div>

              <div>
                <div className="sys-label">
                  <span>Client Secret</span>
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showClientSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showClientSecret ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Secret key"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
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
                    {showClientSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Username & Password */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Reddit Username</span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Bot account username"
                />
              </div>

              <div>
                <div className="sys-label">
                  <span>Reddit Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Account password"
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
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Target Subreddit & Site URL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Target Subreddit</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-cyan)' }} className="font-mono">e.g. freemoviestream</span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  placeholder="r/movies or u_username"
                />
              </div>

              <div>
                <div className="sys-label">
                  <span>Public Stream Base URL</span>
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

            {/* Master Switch */}
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
                  Enable Reddit Automation
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)' }}>
                  Submit link posts for new releases to your subreddit
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
                      showToast('Please enter all required Reddit credentials first', 'error');
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
                  Submission Rules
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Submit New Movies</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Submit Reddit post when movies are added</div>
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
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Submit New TV Shows</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Submit Reddit post when new TV shows are added</div>
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
                {testResult.postUrl && (
                  <a
                    href={testResult.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono hover:underline"
                    style={{ color: 'var(--sys-cyan)' }}
                  >
                    <span>View Submission</span>
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
                  <span>Verify API</span>
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
            <span>Reddit Developer App Setup</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)' }}>
            <li>Log in to Reddit and visit <strong>reddit.com/prefs/apps</strong>.</li>
            <li>Click <strong>&quot;are you a developer? create an app...&quot;</strong> and select <strong>script</strong>.</li>
            <li>Copy the Client ID (shown under the app name) and Client Secret into the fields above.</li>
            <li>Ensure your user account has posting permissions in the target subreddit.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminRedditManagement;
