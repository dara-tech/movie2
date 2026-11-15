import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { ExternalLink, Globe, Share2, CheckCircle2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface Validators {
  facebook: string;
  twitter: string;
  linkedin: string;
  opengraphXyz: string;
}

const DEFAULT_VALIDATORS: Validators = {
  facebook: 'https://developers.facebook.com/tools/debug/',
  twitter: 'https://cards-dev.twitter.com/validator',
  linkedin: 'https://www.linkedin.com/post-inspector/',
  opengraphXyz: 'https://www.opengraph.xyz/'
};

interface OpenGraphMeta {
  siteUrl: string | null;
  clientUrl: string | null;
  clientPublicUrl: string | null;
  spaRoot: string | null;
  defaultOgImageUrl: string | null;
  shareMoviePrefix: string | null;
  shareTvPrefix: string | null;
  validators: Validators;
}

const AdminOpenGraph: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<OpenGraphMeta | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/seo/open-graph');
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setMeta({
          ...d,
          validators: { ...DEFAULT_VALIDATORS, ...(d.validators || {}) }
        });
      }
    } catch {
      showToast('Failed to load Open Graph settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading Open Graph…" color="blue" size="xl" />;
  }

  const v = meta?.validators ?? DEFAULT_VALIDATORS;

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Overview Card */}
      <div className="ctrl-panel" style={{ borderLeft: '4px solid var(--sys-cyan)' }}>
        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="status-led led-blue led-pulse" />
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--sys-text)' }}>
                  Social Metadata &amp; OpenGraph Rich Previews
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--sys-text-muted)', marginTop: '2px' }}>
                  Dynamic SSR tags for Discord, Telegram, iMessage, and Twitter rich cards
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {meta?.spaRoot && (
                <a href={meta.spaRoot} target="_blank" rel="noopener noreferrer" className="sys-btn">
                  <ExternalLink size={12} />
                  <span>Open Public Site</span>
                </a>
              )}
              {meta?.defaultOgImageUrl && (
                <a href={meta.defaultOgImageUrl} target="_blank" rel="noopener noreferrer" className="sys-btn">
                  <ExternalLink size={12} />
                  <span>Default OG Image</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Public Environment Endpoints */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={16} color="var(--sys-cyan)" />
            <span>Public Origin &amp; Base URL Resolution</span>
          </div>
          <span className="sys-badge sys-badge-green font-mono">Verified</span>
        </div>

        <div className="ctrl-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
              <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                Primary API Server Origin (SITE_URL)
              </span>
              <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
                {meta?.siteUrl || 'Not configured'}
              </span>
            </div>

            <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
              <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                Resolved Public SPA Origin
              </span>
              <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
                {meta?.clientPublicUrl || meta?.clientUrl || 'Not configured'}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
            <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
              Default Fallback OpenGraph Poster Image
            </span>
            <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
              {meta?.defaultOgImageUrl || 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Rich Share API Endpoints */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={16} color="var(--sys-green)" />
            <span>Crawler Pre-Rendering &amp; Dynamic Card Endpoints</span>
          </div>
          <span className="sys-badge sys-badge-cyan font-mono">Live Endpoints</span>
        </div>

        <div className="ctrl-panel-body space-y-3">
          <p className="text-xs text-[var(--sys-text-muted)]">
            Chat apps (Discord, Telegram, Slack, WhatsApp) query these endpoints directly to render video embeds, poster artwork, and watch badges.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
              <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                Movie Share Route Prefix
              </span>
              <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
                {meta?.shareMoviePrefix || '—'}
              </span>
            </div>

            <div className="p-3 bg-[var(--sys-surface)] border border-[var(--sys-border)] rounded">
              <span className="text-[11px] font-semibold text-[var(--sys-text-dim)] uppercase tracking-wider block mb-1">
                TV Show Share Route Prefix
              </span>
              <span className="font-mono text-xs text-[var(--sys-text)] break-all select-all">
                {meta?.shareTvPrefix || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preview & Validator Tools */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="var(--sys-purple)" />
            <span>OpenGraph Card Debuggers &amp; Scrapers</span>
          </div>
        </div>

        <div className="ctrl-panel-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <a href={v.facebook} target="_blank" rel="noopener noreferrer" className="sys-btn">
              <span>Facebook Debugger</span>
              <ExternalLink size={12} />
            </a>
            <a href={v.twitter} target="_blank" rel="noopener noreferrer" className="sys-btn">
              <span>Twitter Card Validator</span>
              <ExternalLink size={12} />
            </a>
            <a href={v.linkedin} target="_blank" rel="noopener noreferrer" className="sys-btn">
              <span>LinkedIn Inspector</span>
              <ExternalLink size={12} />
            </a>
            <a href={v.opengraphXyz} target="_blank" rel="noopener noreferrer" className="sys-btn">
              <span>OpenGraph.xyz</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOpenGraph;
