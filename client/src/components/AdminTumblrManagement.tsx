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
  ShieldCheck,
  Info
} from 'lucide-react';
import { TumblrBrandIcon } from './admin/SocialBrandIcons';
import { useToast } from '../contexts/ToastContext';

const AdminTumblrManagement: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [postingLatest, setPostingLatest] = useState(false);
  const [postingNext, setPostingNext] = useState(false);

  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [accessTokenSecret, setAccessTokenSecret] = useState('');
  const [blogIdentifier, setBlogIdentifier] = useState('freemoviestreamhd');
  const [siteUrl, setSiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [notifyNewMovies, setNotifyNewMovies] = useState(true);
  const [notifyNewTvShows, setNotifyNewTvShows] = useState(true);
  const [autoPostEveryMinute, setAutoPostEveryMinute] = useState(true);
  const [postIntervalMinutes, setPostIntervalMinutes] = useState(10);
  const [onlyGreatContent, setOnlyGreatContent] = useState(true);

  const [showSecret, setShowSecret] = useState(false);
  const [showTokenSecret, setShowTokenSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; postUrl?: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/api/site-settings');
      if (response.data.success) {
        const data = response.data.data;
        if (data.tumblr) {
          setConsumerKey(data.tumblr.consumerKey || '');
          setConsumerSecret(data.tumblr.consumerSecret || '');
          setAccessToken(data.tumblr.accessToken || '');
          setAccessTokenSecret(data.tumblr.accessTokenSecret || '');
          setBlogIdentifier(data.tumblr.blogIdentifier || 'freemoviestreamhd');
          setSiteUrl(data.tumblr.siteUrl || '');
          setEnabled(data.tumblr.enabled || false);
          setNotifyNewMovies(data.tumblr.notifyNewMovies !== false);
          setNotifyNewTvShows(data.tumblr.notifyNewTvShows !== false);
          setAutoPostEveryMinute(data.tumblr.autoPostEveryMinute !== false);
          setPostIntervalMinutes(data.tumblr.postIntervalMinutes || 10);
          setOnlyGreatContent(data.tumblr.onlyGreatContent !== false);
        }
      }
    } catch (error: any) {
      showToast('Failed to load Tumblr settings', 'error');
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
      const response = await api.put('/api/site-settings/tumblr', {
        consumerKey: consumerKey.trim() || null,
        consumerSecret: consumerSecret.trim() || null,
        accessToken: accessToken.trim() || null,
        accessTokenSecret: accessTokenSecret.trim() || null,
        blogIdentifier: blogIdentifier.trim().replace(/^@/, '') || 'freemoviestreamhd',
        siteUrl: siteUrl.trim() || null,
        enabled: Boolean(enabled && consumerKey.trim() && consumerSecret.trim() && accessToken.trim() && accessTokenSecret.trim()),
        notifyNewMovies: Boolean(notifyNewMovies),
        notifyNewTvShows: Boolean(notifyNewTvShows),
        autoPostEveryMinute: Boolean(autoPostEveryMinute),
        postIntervalMinutes: Number(postIntervalMinutes) || 10,
        onlyGreatContent: Boolean(onlyGreatContent)
      });

      if (response.data.success) {
        showToast('Tumblr settings saved successfully', 'success');
        await fetchSettings();
      } else {
        showToast(response.data.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save Tumblr settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      await api.put('/api/site-settings/tumblr', {
        consumerKey: consumerKey.trim() || null,
        consumerSecret: consumerSecret.trim() || null,
        accessToken: accessToken.trim() || null,
        accessTokenSecret: accessTokenSecret.trim() || null,
        blogIdentifier: blogIdentifier.trim().replace(/^@/, '') || 'freemoviestreamhd',
        siteUrl: siteUrl.trim() || null,
        enabled: Boolean(enabled),
        notifyNewMovies: Boolean(notifyNewMovies),
        notifyNewTvShows: Boolean(notifyNewTvShows),
        autoPostEveryMinute: Boolean(autoPostEveryMinute),
        postIntervalMinutes: Number(postIntervalMinutes) || 10,
        onlyGreatContent: Boolean(onlyGreatContent)
      });

      const response = await api.post('/api/site-settings/tumblr/test');

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Connected to Tumblr successfully!'
        });
        showToast('Tumblr connected successfully!', 'success');
      } else {
        setTestResult({
          success: false,
          message: response.data.message || 'Failed to connect to Tumblr'
        });
        showToast(response.data.message || 'Failed to connect to Tumblr', 'error');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to test connection';
      setTestResult({
        success: false,
        message: errorMsg
      });
      showToast(errorMsg, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handlePostLatest = async () => {
    setPostingLatest(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/tumblr/post-latest');

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Movie posted to Tumblr successfully!',
          postUrl: response.data.postUrl
        });
        showToast('Movie posted to Tumblr!', 'success');
      } else {
        showToast(response.data.message || 'Failed to post movie', 'error');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to post movie to Tumblr';
      setTestResult({
        success: false,
        message: errorMsg
      });
      showToast(errorMsg, 'error');
    } finally {
      setPostingLatest(false);
    }
  };

  const handlePostNext = async () => {
    setPostingNext(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/site-settings/tumblr/post-next');

      if (response.data.success) {
        setTestResult({
          success: true,
          message: response.data.message || 'Movie/Show posted to Tumblr successfully!',
          postUrl: response.data.data?.postUrl
        });
        showToast(response.data.message || 'Next item posted to Tumblr!', 'success');
      } else {
        showToast(response.data.message || 'Failed to post item', 'error');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to post next item to Tumblr';
      setTestResult({
        success: false,
        message: errorMsg
      });
      showToast(errorMsg, 'error');
    } finally {
      setPostingNext(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen color="red" text="Loading Tumblr settings..." />;
  }

  const isConfigured = !!(consumerKey.trim() && consumerSecret.trim() && accessToken.trim() && accessTokenSecret.trim());

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
                  {enabled && isConfigured ? 'Tumblr Auto-Publishing Active' : 'Tumblr Integration Idle'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  {enabled && isConfigured 
                    ? `Posting rich movie & series photo posts to blog: ${blogIdentifier}` 
                    : 'Provide OAuth 1.0a credentials below to syndicate stream releases.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !isConfigured}
                className="sys-btn"
                title="Verify Tumblr OAuth credentials"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Verify OAuth</span>
              </button>

              <button
                type="button"
                onClick={handlePostNext}
                disabled={postingNext || !isConfigured}
                className="sys-btn sys-btn-primary"
                title="Publish next media release to Tumblr"
              >
                {postingNext ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                <span>Post Release Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TumblrBrandIcon size={16} active />
            <span>Tumblr OAuth 1.0a API Credentials</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">
            {isConfigured ? 'Connected' : 'Setup Required'}
          </span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Consumer Key & Consumer Secret */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>OAuth Consumer Key</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">API Key</span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="Tumblr API Consumer Key"
                />
              </div>

              <div>
                <div className="sys-label">
                  <span>Consumer Secret</span>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                    placeholder="Tumblr Consumer Secret"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
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
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Access Token & Token Secret */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Access Token</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">User Token</span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="OAuth Access Token"
                />
              </div>

              <div>
                <div className="sys-label">
                  <span>Access Token Secret</span>
                  <button
                    type="button"
                    onClick={() => setShowTokenSecret(!showTokenSecret)}
                    style={{ background: 'none', border: 'none', color: 'var(--sys-cyan)', cursor: 'pointer', fontSize: '11px' }}
                  >
                    {showTokenSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showTokenSecret ? 'text' : 'password'}
                    className="sys-input font-mono"
                    value={accessTokenSecret}
                    onChange={(e) => setAccessTokenSecret(e.target.value)}
                    placeholder="OAuth Access Token Secret"
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTokenSecret(!showTokenSecret)}
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
                    {showTokenSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Blog Identifier & Site URL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div>
                <div className="sys-label">
                  <span>Blog Identifier / Subdomain</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-cyan)' }} className="font-mono">e.g. freemoviestreamhd</span>
                </div>
                <input
                  type="text"
                  className="sys-input font-mono"
                  value={blogIdentifier}
                  onChange={(e) => setBlogIdentifier(e.target.value)}
                  placeholder="freemoviestreamhd"
                />
                <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                  Target Tumblr blog (e.g. <code>blogname.tumblr.com</code> or just <code>blogname</code>).
                </p>
              </div>

              <div>
                <div className="sys-label">
                  <span>Public Stream Base URL</span>
                  <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">Optional override</span>
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
                  Enable Tumblr Broadcasting
                </div>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)' }}>
                  Syndicate photo cards with trailer backlinks to your blog
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
                      showToast('Please enter all 4 OAuth keys first', 'error');
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
                  Posting Preferences & Schedule
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Broadcast Movies</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Publish poster cards for newly indexed movies</div>
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
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>Broadcast TV Shows</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Publish poster cards for newly added TV shows</div>
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
                      <span className="sys-badge sys-badge-green font-mono">⚡ Automated Pipeline</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Automatically syndicate backlogged releases</div>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--sys-border)' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sys-text)' }}>High-Quality Filter Only</div>
                    <div style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }}>Only post content with valid backdrop art and &gt; 5.0 TMDB rating</div>
                  </div>
                  <label className="sys-switch">
                    <input
                      type="checkbox"
                      checked={onlyGreatContent}
                      onChange={(e) => setOnlyGreatContent(e.target.checked)}
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
                    <span>View on Tumblr</span>
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
                  onClick={handleTestConnection}
                  disabled={testing || !isConfigured}
                  className="sys-btn"
                >
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  <span>Test OAuth</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handlePostLatest}
                  disabled={postingLatest || !isConfigured}
                  className="sys-btn"
                  title="Broadcast single newest movie release"
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
            <Info size={14} color="var(--sys-cyan)" />
            <span>Tumblr Application Registration</span>
          </div>
        </div>
        <div className="ctrl-panel-body">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--sys-text-muted)' }}>
            <li>Register an application at <strong>tumblr.com/oauth/apps</strong>.</li>
            <li>Copy the <strong>OAuth Consumer Key</strong> and <strong>Secret Key</strong> into the inputs above.</li>
            <li>Generate your <strong>Token</strong> &amp; <strong>Token Secret</strong> through the developer console or OAuth authorization flow.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminTumblrManagement;
