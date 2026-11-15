import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { ExternalLink, RefreshCw, Search, CheckCircle2, XCircle, Globe, ShieldCheck } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface SeoMeta {
  siteUrl: string | null;
  clientUrl: string | null;
  sitemapUrl: string | null;
  robotsUrl: string | null;
  searchConsolePropertyHint: string | null;
}

interface ProbeResult {
  url: string;
  status?: number;
  contentType?: string;
  elapsedMs: number;
  ok: boolean;
  error?: string;
  bodyHint?: {
    length: number;
    looksLikeHtml: boolean;
    looksLikeXml: boolean;
    isXmlContentType: boolean;
    summary: string | null;
  };
}

const AdminSearchConsole: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<SeoMeta | null>(null);
  const [probeUrl, setProbeUrl] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/seo/search-console');
      if (res.data?.success && res.data.data) {
        setMeta(res.data.data);
        const hint = res.data.data.siteUrl || res.data.data.clientUrl;
        if (hint) {
          const origin = hint.replace(/\/$/, '');
          setProbeUrl((prev) => (prev.trim() ? prev : `${origin}/`));
        }
      }
    } catch {
      showToast('Failed to load Search Console settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const runProbe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProbing(true);
    setProbeResult(null);
    try {
      const payload = probeUrl.trim() ? { url: probeUrl.trim() } : {};
      const res = await api.post('/api/admin/seo/search-console/probe', payload);
      if (res.data?.success && res.data.data) {
        setProbeResult(res.data.data);
        if (!res.data.data.ok) {
          showToast('Probe finished: URL did not look healthy to Googlebot', 'error');
        } else {
          const hint = res.data.data.bodyHint;
          if (hint?.looksLikeXml || hint?.isXmlContentType) {
            showToast('Probe finished: XML/sitemap looks valid', 'success');
          } else if (hint?.looksLikeHtml) {
            showToast('Probe finished: HTML looks valid', 'success');
          } else {
            showToast('Probe finished: reachable (check body summary below)', 'success');
          }
        }
      } else {
        showToast(res.data?.message || 'Probe failed', 'error');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      showToast(ax.response?.data?.message || 'Probe request failed', 'error');
    } finally {
      setProbing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading Search Console…" color="blue" size="xl" />;
  }

  const gscUrl = 'https://search.google.com/search-console';
  const propertyHint = meta?.searchConsolePropertyHint || '';

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry / Live Sitemap Indicator Card */}
      <div className="ctrl-panel" style={{ borderLeft: '4px solid var(--sys-green)' }}>
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="status-led led-green led-pulse"></span>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  Sitemap &amp; Robots Ready for Googlebot Crawling
                </strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--sys-text-muted)', marginTop: '4px' }}>
                Active Canonical Origin: <strong style={{ color: 'var(--sys-cyan)' }} className="font-mono">{meta?.siteUrl || meta?.clientUrl || 'localhost:3000'}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {meta?.sitemapUrl && (
                <a
                  href={meta.sitemapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sys-btn"
                >
                  <ExternalLink size={12} />
                  <span>View sitemap.xml</span>
                </a>
              )}
              {meta?.robotsUrl && (
                <a
                  href={meta.robotsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sys-btn"
                >
                  <ExternalLink size={12} />
                  <span>View robots.txt</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Environment Endpoints Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={16} color="var(--sys-cyan)" />
            <span>Search Engine Environment &amp; Directives</span>
          </div>
          <span className="sys-badge sys-badge-green font-mono">Synced</span>
        </div>

        <div className="ctrl-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
              <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                Primary Site URL (SITE_URL)
              </span>
              <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
                {meta?.siteUrl || 'Not configured'}
              </span>
            </div>

            <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
              <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                Client Stream URL (CLIENT_URL)
              </span>
              <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
                {meta?.clientUrl || 'Not configured'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--sys-border)' }}>
            <a
              href={gscUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sys-btn sys-btn-primary"
            >
              <ExternalLink size={13} />
              <span>Launch Google Search Console</span>
            </a>

            {propertyHint && (
              <a
                href={`${gscUrl}?resource_id=${encodeURIComponent(propertyHint)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sys-btn"
              >
                <ExternalLink size={13} />
                <span>Open Property ({propertyHint})</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Crawl reachability probe */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="var(--sys-cyan)" />
            <span>Googlebot Crawl &amp; Header Reachability Probe</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">Live Tester</span>
        </div>

        <div className="ctrl-panel-body">
          <form onSubmit={runProbe} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div className="sys-label">
                <span>URL to Simulate Crawl</span>
                <span style={{ fontSize: '11px', color: 'var(--sys-text-dim)' }} className="font-mono">
                  Simulates Googlebot User-Agent inspection
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={probeUrl}
                  onChange={(e) => setProbeUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="sys-input font-mono"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={probing}
                  className="sys-btn sys-btn-primary"
                >
                  {probing ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                  <span>Run Probe</span>
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--sys-text-dim)', marginTop: '4px' }}>
                Server requests target URL using Googlebot headers and evaluates robots indexability and status codes.
              </p>
            </div>

            {probeResult && (
              <div 
                className="p-3 rounded border text-xs"
                style={{
                  background: probeResult.ok ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  borderColor: probeResult.ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {probeResult.ok ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                    <strong style={{ color: probeResult.ok ? 'var(--sys-green)' : 'var(--sys-red)' }}>
                      {probeResult.ok ? 'Crawl Reachable & Healthy' : 'Inspection Warning / Error'}
                    </strong>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--sys-text-dim)]">{probeResult.elapsedMs} ms</span>
                </div>

                <div className="font-mono text-[11px] text-[var(--sys-text-muted)] break-all mb-2">
                  {probeResult.url}
                </div>

                {probeResult.error && (
                  <p className="text-red-400 mb-1">Error: {probeResult.error}</p>
                )}

                {probeResult.status != null && (
                  <p className="text-[var(--sys-text)]">
                    HTTP Status: <strong className="font-mono">{probeResult.status}</strong>
                    {probeResult.contentType ? ` · ${probeResult.contentType}` : ''}
                  </p>
                )}

                {probeResult.bodyHint && (
                  <p className="text-[var(--sys-text-dim)] mt-1">
                    Body payload: ~{probeResult.bodyHint.length} bytes
                    {probeResult.bodyHint.summary ? ` · ${probeResult.bodyHint.summary}` : ''}
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminSearchConsole;
