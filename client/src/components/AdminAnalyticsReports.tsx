import React, { useState } from 'react';
import { FileSpreadsheet, Download, RefreshCw, BarChart3, CheckCircle, FileText } from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import AdminEmptyState from './admin/AdminEmptyState';

type ReportType = 'user-growth' | 'content-breakdown' | 'activity-summary';

interface GeneratedReport {
  title: string;
  headers: string[];
  rows: string[][];
  generatedAt: Date;
  source: string;
  note?: string;
}

const REPORT_OPTIONS: Array<{
  type: ReportType;
  title: string;
  description: string;
  source: string;
}> = [
  {
    type: 'user-growth',
    title: 'User Growth (30 days)',
    description: 'Daily signup counts and activation rate for the rolling 30-day window.',
    source: '/api/admin/analytics/users'
  },
  {
    type: 'content-breakdown',
    title: 'Content Inventory',
    description: 'Distribution across catalog movies, TV series, genres, and release years.',
    source: '/api/admin/analytics/content'
  },
  {
    type: 'activity-summary',
    title: 'Admin Activity Summary (30 days)',
    description: 'Operational overview of administrative operations, success rate, and hotspots.',
    source: '/api/admin/activity/stats'
  }
];

const AdminAnalyticsReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('user-growth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      let generated: GeneratedReport | null = null;

      if (selectedReport === 'user-growth') {
        const response = await api.get('/api/admin/analytics/users', {
          params: { period: '30d' }
        });
        const data = response.data?.data || {};
        const headers = ['Date', 'New Users'];
        const rows: string[][] = Array.isArray(data.userGrowth)
          ? data.userGrowth
              .map((bucket: any) => {
                const year = bucket?._id?.year;
                const month = bucket?._id?.month ? bucket._id.month - 1 : 0;
                const day = bucket?._id?.day ?? 1;
                if (!year) return null;
                const date = new Date(year, month, day);
                return [
                  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  `${bucket.count ?? 0}`
                ];
              })
              .filter(Boolean)
          : [];

        generated = {
          title: 'User Growth - Last 30 Days',
          headers,
          rows: rows as string[][],
          generatedAt: new Date(),
          source: 'User analytics telemetry',
          note: `Total new users: ${data.newUsers ?? 0}, Active members: ${data.activeUsers ?? 0}`
        };
      }

      if (selectedReport === 'content-breakdown') {
        const response = await api.get('/api/admin/analytics/content');
        const data = response.data?.data || {};
        const headers = ['Metric', 'Value'];
        const rows: string[][] = [
          ['Movies', `${data.totalMovies ?? 0}`],
          ['TV Shows', `${data.totalTvShows ?? 0}`],
          ['Genres', `${data.totalGenres ?? 0}`]
        ];

        if (Array.isArray(data.popularGenres)) {
          rows.push(['', '']);
          rows.push(['Top Genres', 'Titles']);
          data.popularGenres.forEach((genre: any) => {
            rows.push([genre.name || genre._id || 'Unknown', `${genre.count ?? 0}`]);
          });
        }

        if (Array.isArray(data.contentByYear)) {
          rows.push(['', '']);
          rows.push(['Release Year', 'Title Count']);
          data.contentByYear.forEach((item: any) => {
            rows.push([`${item._id ?? 'Unknown'}`, `${item.count ?? 0}`]);
          });
        }

        generated = {
          title: 'Content Inventory Breakdown',
          headers,
          rows,
          generatedAt: new Date(),
          source: 'Content analytics telemetry',
          note: 'Includes distribution by genre taxonomy and release year.'
        };
      }

      if (selectedReport === 'activity-summary') {
        const response = await api.get('/api/admin/activity/stats', {
          params: { period: '30d' }
        });
        const data = response.data?.data || {};
        const headers = ['Metric', 'Value'];
        const rows: string[][] = [
          ['Total Actions', `${data.total ?? 0}`],
          ['Successful', `${data.success ?? 0}`],
          ['Failed', `${data.failed ?? 0}`],
          ['Success Rate (%)', `${data.successRate ?? 0}`]
        ];

        if (Array.isArray(data.byAction)) {
          rows.push(['', '']);
          rows.push(['Top Actions', 'Count']);
          data.byAction.forEach((item: any) => {
            rows.push([item._id || 'Unknown', `${item.count ?? 0}`]);
          });
        }

        if (Array.isArray(data.byAdmin)) {
          rows.push(['', '']);
          rows.push(['Most Active Admin', 'Count']);
          data.byAdmin.forEach((item: any) => {
            const identifier = item?.admin?.username || item?.admin?.email || 'Unknown Admin';
            rows.push([identifier, `${item.count ?? 0}`]);
          });
        }

        generated = {
          title: 'Admin Activity Summary (30 Days)',
          headers,
          rows,
          generatedAt: new Date(),
          source: 'Admin activity stats telemetry',
          note: 'Executive operational audit digest.'
        };
      }

      setReport(generated);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to generate report';
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const csvRows: string[] = [];
    csvRows.push(report.headers.join(','));
    report.rows.forEach((row) => {
      const processed = row.map((value) => {
        const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n');
        let safeValue = value.replace(/"/g, '""');
        if (needsQuotes) {
          safeValue = `"${safeValue}"`;
        }
        return safeValue;
      });
      csvRows.push(processed.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${report.title.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Report Type Selector Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {REPORT_OPTIONS.map((option) => {
          const isSelected = selectedReport === option.type;
          return (
            <button
              key={option.type}
              onClick={() => setSelectedReport(option.type)}
              className={`ctrl-panel p-3 text-left transition-all ${
                isSelected ? 'border-[var(--sys-cyan)] bg-[var(--sys-cyan)]/5' : 'hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-zinc-100">{option.title}</span>
                <span className={`status-led led-${isSelected ? 'cyan' : 'green'}`} />
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">{option.description}</p>
              <span className="text-[10px] font-mono text-zinc-500 mt-2 block">
                Source: {option.source.replace('/api', '')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Generator & Report Canvas */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Report Generator Engine</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="sys-btn sys-btn-primary"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Compiling Dataset...' : 'Compile Snapshot'}</span>
            </button>

            {report && (
              <button
                onClick={handleDownload}
                className="sys-btn"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>

        <div className="ctrl-panel-body p-0">
          {loading && (
            <div className="py-12 flex justify-center">
              <LoadingSpinner color="blue" text="Aggregating snapshot rows..." />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/30 text-xs font-mono text-red-400">
              Error: {error}
            </div>
          )}

          {!loading && !report && !error && (
            <AdminEmptyState
              icon={FileText}
              title="No Report Compiled"
              description="Select a report archetype and click 'Compile Snapshot' to construct tabular export"
            />
          )}

          {report && !loading && (
            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-1">
                <div>
                  <div className="font-semibold text-xs text-zinc-100">{report.title}</div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    Generated: {report.generatedAt.toLocaleString()} · Origin: {report.source}
                  </div>
                </div>
                {report.note && (
                  <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1">
                    {report.note}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="sys-table">
                  <thead>
                    <tr>
                      {report.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, rIndex) => (
                      <tr key={rIndex}>
                        {row.map((val, cIndex) => (
                          <td key={cIndex} className="font-mono text-xs">
                            {val || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsReports;
