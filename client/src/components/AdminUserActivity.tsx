import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Users, 
  MousePointerClick, 
  Globe, 
  Info, 
  BarChart3, 
  Sparkles, 
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { requestAssistantResponse } from '../services/ai';
import AdminPagination from './admin/AdminPagination';
import AdminEmptyState from './admin/AdminEmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface UserSummary {
  username?: string;
  email?: string;
  role?: string;
}

interface UserActivityEvent {
  _id: string;
  sessionId: string;
  userType: 'anonymous' | 'authenticated';
  eventType: string;
  path?: string;
  query?: Record<string, any>;
  metadata?: Record<string, any>;
  device?: string;
  browser?: string;
  locale?: string;
  contentType?: string | null;
  contentId?: string | null;
  searchTerm?: string;
  createdAt: string;
  user?: UserSummary;
}

interface BreakdownEntry {
  _id: string;
  count: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const EVENT_TYPES = [
  'page_view',
  'search',
  'movie_play',
  'tv_play',
  'watch_completion',
  'watchlist_add',
  'watchlist_remove',
  'favorite_add',
  'favorite_remove',
  'filter',
  'navigation',
  'interaction',
  'error',
  'custom'
] as const;

const USER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'authenticated', label: 'Authenticated' },
  { value: 'anonymous', label: 'Anonymous' }
];

const TIMEFRAME_OPTIONS = [
  { value: '1h', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { value: '24h', label: 'Last 24 Hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: 'Last 30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'all', label: 'All Time', ms: null }
];

const LIMIT = 25;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return date.toLocaleString();
};

const formatQuery = (query: Record<string, any> = {}) => {
  const entries = Object.entries(query);
  if (!entries.length) return '—';
  return entries
    .map(([key, val]) => `${key}=${val}`)
    .join(', ');
};

const AdminUserActivity: React.FC = () => {
  const [events, setEvents] = useState<UserActivityEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: LIMIT,
    total: 0,
    totalPages: 1
  });
  const [breakdown, setBreakdown] = useState<{ byEventType: BreakdownEntry[]; byUserType: BreakdownEntry[] }>({
    byEventType: [],
    byUserType: []
  });
  const [filters, setFilters] = useState({
    eventType: 'all',
    userType: 'all',
    timeframe: '24h',
    search: ''
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<UserActivityEvent | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightNotes, setInsightNotes] = useState<string[]>([]);
  const [insightSeries, setInsightSeries] = useState<Array<{ label: string; value: number; description?: string }>>([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [insightConversationId, setInsightConversationId] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const fetchActivities = useCallback(async () => {
    try {
      setError(null);
      if (!hasLoadedRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const params: Record<string, any> = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (filters.eventType !== 'all') {
        params.eventType = filters.eventType;
      }
      if (filters.userType !== 'all') {
        params.userType = filters.userType;
      }
      if (filters.search.trim()) {
        params.search = filters.search.trim();
      }
      const timeframeDef = TIMEFRAME_OPTIONS.find(option => option.value === filters.timeframe);
      if (timeframeDef && timeframeDef.ms) {
        params.from = new Date(Date.now() - timeframeDef.ms).toISOString();
      }

      const response = await api.get('/api/activity', { params });
      const payload = response.data?.data || {};
      setEvents(payload.events || []);
      setPagination(prev => ({
        page: payload.pagination?.page ?? prev.page,
        limit: payload.pagination?.limit ?? prev.limit,
        total: payload.pagination?.total ?? prev.total,
        totalPages: payload.pagination?.totalPages ?? prev.totalPages
      }));
      setBreakdown({
        byEventType: payload.breakdown?.byEventType || [],
        byUserType: payload.breakdown?.byUserType || [],
      });
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch user activity');
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.eventType, filters.userType, filters.search, filters.timeframe, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const totalEvents = pagination.total;
  const authenticatedCount = useMemo(
    () => breakdown.byUserType.find(item => item._id === 'authenticated')?.count || 0,
    [breakdown.byUserType]
  );
  const anonymousCount = useMemo(
    () => breakdown.byUserType.find(item => item._id === 'anonymous')?.count || 0,
    [breakdown.byUserType]
  );

  const topEventType = useMemo(() => {
    if (!breakdown.byEventType.length) return null;
    const [top] = breakdown.byEventType;
    return top;
  }, [breakdown.byEventType]);

  const eventDistribution = useMemo(() => {
    const total = breakdown.byEventType.reduce((sum, entry) => sum + entry.count, 0) || 1;
    return breakdown.byEventType.slice(0, 6).map(entry => ({
      ...entry,
      percent: Math.round((entry.count / total) * 100)
    }));
  }, [breakdown.byEventType]);

  const userMix = useMemo(() => {
    const total = breakdown.byUserType.reduce((sum, entry) => sum + entry.count, 0) || 1;
    return breakdown.byUserType.map(entry => ({
      ...entry,
      percent: Math.round((entry.count / total) * 100)
    }));
  }, [breakdown.byUserType]);

  const recentHighlights = useMemo(
    () =>
      events.slice(0, 5).map((event) => ({
        eventType: event.eventType,
        userType: event.userType,
        path: event.path,
        locale: event.locale,
        createdAt: event.createdAt,
        contentType: event.contentType
      })),
    [events]
  );

  const maxInsightValue = useMemo(() => {
    if (!insightSeries.length) return 1;
    return Math.max(...insightSeries.map(item => (typeof item.value === 'number' ? item.value : 0)), 1);
  }, [insightSeries]);

  const eventTypeBadge = (eventType: string) => {
    switch (eventType) {
      case 'movie_play':
      case 'tv_play':
        return <span className="sys-badge sys-badge-cyan font-mono text-[10px]">{eventType}</span>;
      case 'search':
        return <span className="sys-badge font-mono text-[10px]">{eventType}</span>;
      case 'watchlist_add':
      case 'watchlist_remove':
      case 'watch_completion':
        return <span className="sys-badge sys-badge-green font-mono text-[10px]">{eventType}</span>;
      default:
        return <span className="sys-badge font-mono text-[10px]">{eventType}</span>;
    }
  };

  const generateInsights = useCallback(async () => {
    setInsightLoading(true);
    setInsightError(null);
    setInsight(null);
    setInsightSeries([]);
    setInsightNotes([]);

    const payload = {
      totalEvents,
      timeframe: filters.timeframe,
      topEventType: topEventType ? `${topEventType._id} (${topEventType.count})` : 'none',
      userMix,
      eventDistribution,
      recentHighlights
    };

    const prompt = `You are a telemetry analyst for an entertainment streaming platform. Given the following telemetry summary, summarize what the audience is doing, highlight unusual patterns, and return 2-3 focus metric recommendations.
Return valid JSON with:
{
  "summary": "Short 1-2 sentence overview",
  "notes": ["bullet point 1", "bullet point 2"],
  "metrics": [{"label": "Name", "value": 123, "description": "optional detail"}]
}
Summary data: ${JSON.stringify(payload)}`;

    try {
      const response = await requestAssistantResponse({
        messages: [{ role: 'user', content: prompt }],
        conversationId: insightConversationId || undefined
      });

      const reply = response.response || '';
      const jsonStart = reply.indexOf('{');
      const jsonEnd = reply.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(reply.slice(jsonStart, jsonEnd + 1));
        setInsight(parsed.summary || null);
        setInsightNotes(Array.isArray(parsed.notes) ? parsed.notes : []);
        setInsightSeries(Array.isArray(parsed.metrics) ? parsed.metrics : []);
      } else {
        setInsight(reply);
      }

      if (response.conversationId) {
        setInsightConversationId(response.conversationId);
      }
    } catch (err) {
      setInsightError('Failed to generate insights.');
    } finally {
      setInsightLoading(false);
    }
  }, [eventDistribution, filters.timeframe, insightConversationId, recentHighlights, topEventType, totalEvents, userMix]);

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Total Events</span>
            <Activity className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">{totalEvents}</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">filtered window</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Authenticated</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">{authenticatedCount}</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">registered members</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Anonymous Guests</span>
            <Globe className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--sys-cyan)]">{anonymousCount}</div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">session trackers</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Leading Signal</span>
            <MousePointerClick className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
          </div>
          <div className="text-sm font-bold font-mono text-zinc-100 truncate mt-1">
            {topEventType ? topEventType._id.replace(/_/g, ' ') : '—'}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
            {topEventType ? `${topEventType.count} signals` : 'no traffic'}
          </div>
        </div>
      </div>

      {/* Query Filters */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Telemetry Signal Filtering</span>
          </div>
          <span className="sys-badge font-mono text-[10px]">
            {events.length} of {pagination.total} signals
          </span>
        </div>

        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="sys-label">Timeframe Window</label>
              <Select value={filters.timeframe} onValueChange={(val) => handleFilterChange('timeframe', val)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="Timeframe" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  {TIMEFRAME_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">Event Category</label>
              <Select value={filters.eventType} onValueChange={(val) => handleFilterChange('eventType', val)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  <SelectItem value="all">All Events</SelectItem>
                  {EVENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">Audience Type</label>
              <Select value={filters.userType} onValueChange={(val) => handleFilterChange('userType', val)}>
                <SelectTrigger className="w-full bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)] text-xs h-8.5 rounded-md">
                  <SelectValue placeholder="Audience Type" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--sys-surface)] text-[var(--sys-text)] border-[var(--sys-border)]">
                  {USER_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="sys-label">Search Context / Path</label>
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Filter path, query, session..."
                  className="sys-input font-mono pl-7"
                />
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal Distribution & AI Telemetry Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Signals */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
              <span className="ctrl-panel-title">Top Signals</span>
            </div>
          </div>
          <div className="ctrl-panel-body space-y-2.5">
            {eventDistribution.length === 0 ? (
              <span className="text-xs text-zinc-500 font-mono">Insufficient telemetry data</span>
            ) : (
              eventDistribution.map((entry) => (
                <div key={entry._id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span className="uppercase">{entry._id.replace(/_/g, ' ')}</span>
                    <span className="text-zinc-200">{entry.count} ({entry.percent}%)</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 overflow-hidden">
                    <div 
                      className="bg-[var(--sys-cyan)] h-full"
                      style={{ width: `${entry.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audience Split */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="ctrl-panel-title">Audience Split</span>
            </div>
          </div>
          <div className="ctrl-panel-body space-y-3">
            {userMix.length === 0 ? (
              <span className="text-xs text-zinc-500 font-mono">No audience activity recorded</span>
            ) : (
              <>
                <div className="w-full bg-zinc-900 h-2 flex overflow-hidden">
                  {userMix.map((item) => (
                    <div 
                      key={item._id} 
                      className={item._id === 'authenticated' ? 'bg-emerald-500' : 'bg-[var(--sys-cyan)]'} 
                      style={{ width: `${item.percent}%` }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {userMix.map((item) => (
                    <div key={item._id} className="p-2 bg-zinc-950 border border-zinc-900">
                      <span className="text-[10px] text-zinc-500 block uppercase">{item._id}</span>
                      <span className="text-zinc-200 font-bold">{item.percent}%</span>
                      <span className="text-[10px] text-zinc-500 block">({item.count} events)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* AI Briefing */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--sys-amber)]" />
              <span className="ctrl-panel-title">AI Briefing</span>
            </div>
            <button
              onClick={generateInsights}
              disabled={insightLoading}
              className="sys-btn"
            >
              {insightLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1 text-[var(--sys-amber)]" />}
              <span>{insightLoading ? 'Analyzing...' : 'Generate'}</span>
            </button>
          </div>
          <div className="ctrl-panel-body space-y-2">
            {insightError && (
              <span className="text-xs text-red-400 font-mono">{insightError}</span>
            )}
            {insight && (
              <div className="p-2.5 bg-black border border-zinc-900 text-xs text-zinc-300 font-mono leading-relaxed">
                {insight}
              </div>
            )}
            {insightNotes.length > 0 && (
              <ul className="space-y-1 text-xs text-zinc-400 font-mono">
                {insightNotes.map((note, index) => (
                  <li key={index} className="flex gap-1.5 items-start">
                    <span className="text-[var(--sys-cyan)]">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
            {!insight && !insightLoading && !insightError && (
              <span className="text-xs text-zinc-500 font-mono">
                Click Generate to invoke Gemini telemetry analysis for this activity snapshot
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Raw Telemetry Stream</span>
          </div>
          {refreshing && (
            <span className="text-[10px] font-mono text-[var(--sys-cyan)] flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Live Stream Sync
            </span>
          )}
        </div>

        <div className="ctrl-panel-body p-0">
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Ingesting telemetry event buffer..." color="blue" />
            </div>
          ) : events.length === 0 ? (
            <AdminEmptyState
              icon={Activity}
              title="No Activity Events"
              description="No telemetry items match your current filter parameters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="sys-table">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>User Identity</th>
                    <th>Context / Path</th>
                    <th>Device Info</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event._id}>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div>{eventTypeBadge(event.eventType)}</div>
                          <span className="text-[10px] font-mono text-zinc-500">{formatDateTime(event.createdAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">
                            {event.userType === 'authenticated'
                              ? event.user?.username || event.user?.email || 'Authenticated User'
                              : 'Anonymous Guest'}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            {event.userType === 'authenticated'
                              ? event.user?.email || event.user?.username
                              : `Session: ${event.sessionId.slice(0, 8)}...`}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs font-mono text-zinc-300">{event.path || '—'}</div>
                        {event.searchTerm && (
                          <div className="text-[10px] font-mono text-[var(--sys-cyan)]">Query: {event.searchTerm}</div>
                        )}
                        {event.contentType && (
                          <div className="text-[10px] font-mono text-zinc-500 capitalize">
                            Target: {event.contentType} {event.contentId ? `#${event.contentId}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="text-xs font-mono text-zinc-400">
                        <div>{event.device || 'Unknown'}</div>
                        <div className="text-[10px] text-zinc-500">{event.browser}</div>
                      </td>
                      <td className="text-right">
                        <button
                          className="sys-btn"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <Info className="w-3 h-3 mr-1" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="p-3 border-t border-zinc-800/80">
              <AdminPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-2xl mx-auto rounded-none">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--sys-cyan)]" />
              Telemetry Event Metadata
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-3 py-2 text-xs font-mono max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Event Type</span>
                  <span className="text-zinc-200">{selectedEvent.eventType}</span>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">User Type</span>
                  <span className="text-zinc-200">{selectedEvent.userType}</span>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Session ID</span>
                  <span className="text-zinc-200 break-all">{selectedEvent.sessionId}</span>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">Timestamp</span>
                  <span className="text-zinc-200">{formatDateTime(selectedEvent.createdAt)}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">Query Parameters</span>
                <div className="p-2 bg-black border border-zinc-900 text-zinc-300">
                  {formatQuery(selectedEvent.query)}
                </div>
              </div>

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-1">Raw Payload Payload</span>
                  <pre className="p-2 bg-black border border-zinc-900 text-[10px] text-zinc-300 overflow-x-auto">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserActivity;
