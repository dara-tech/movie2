import React, { useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Activity, RefreshCw, LineChart, TrendingUp, Sparkles } from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import AdminEmptyState from './admin/AdminEmptyState';

type PeriodOption = '7d' | '30d' | '90d' | '1y';

interface UserGrowthBucket {
  _id: {
    year: number;
    month?: number;
    day?: number;
  };
  count: number;
}

interface UserAnalyticsResponse {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  userGrowth: UserGrowthBucket[];
}

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodOption; description: string }> = [
  { label: '7 Days', value: '7d', description: 'Recent week' },
  { label: '30 Days', value: '30d', description: 'Rolling month' },
  { label: '90 Days', value: '90d', description: 'Quarter to date' },
  { label: '1 Year', value: '1y', description: 'Year over year' }
];

const DEFAULT_ANALYTICS: UserAnalyticsResponse = {
  totalUsers: 0,
  newUsers: 0,
  activeUsers: 0,
  userGrowth: []
};

const AdminAnalyticsUsers: React.FC = () => {
  const [period, setPeriod] = useState<PeriodOption>('30d');
  const [analytics, setAnalytics] = useState<UserAnalyticsResponse>(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const fetchAnalytics = async (selectedPeriod: PeriodOption) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/admin/analytics/users', {
        params: { period: selectedPeriod }
      });

      const data = response.data?.data as UserAnalyticsResponse | undefined;
      if (data) {
        setAnalytics({
          totalUsers: data.totalUsers ?? 0,
          newUsers: data.newUsers ?? 0,
          activeUsers: data.activeUsers ?? 0,
          userGrowth: Array.isArray(data.userGrowth) ? data.userGrowth : []
        });
      } else {
        setAnalytics(DEFAULT_ANALYTICS);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch analytics';
      setError(message);
      setAnalytics(DEFAULT_ANALYTICS);
    } finally {
      setLoading(false);
    }
  };

  const growthBuckets = useMemo(() => {
    if (!Array.isArray(analytics.userGrowth)) {
      return [];
    }
    return analytics.userGrowth
      .map((bucket) => {
        const { year, month = 1, day = 1 } = bucket._id || {};
        if (!year) {
          return null;
        }
        const date = new Date(year, month - 1, day);
        return {
          date,
          key: `${year}-${month}-${day}`,
          count: bucket.count ?? 0
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.date.getTime() > b!.date.getTime() ? 1 : -1)) as Array<{
        date: Date;
        key: string;
        count: number;
      }>;
  }, [analytics.userGrowth]);

  const maxGrowthCount = useMemo(() => {
    if (growthBuckets.length === 0) return 0;
    return Math.max(...growthBuckets.map((bucket) => bucket.count));
  }, [growthBuckets]);

  const activeRate = useMemo(() => {
    if (!analytics.totalUsers) return 0;
    return (analytics.activeUsers / analytics.totalUsers) * 100;
  }, [analytics.totalUsers, analytics.activeUsers]);

  if (loading && !analytics.totalUsers) {
    return <LoadingSpinner fullScreen color="blue" text="Loading audience telemetry..." size="xl" />;
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Total Accounts</span>
            <Users className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {analytics.totalUsers.toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">registered members</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>New Signups</span>
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {analytics.newUsers.toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">within selected window</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Active Members</span>
            <Activity className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--sys-cyan)]">
            {analytics.activeUsers.toLocaleString('en-US')}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">authenticated sessions</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Active Ratio</span>
            <LineChart className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {activeRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">retention engagement</div>
        </div>
      </div>

      {/* Control Strip & Window Filter */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Audience Trend Window</span>
          </div>

          <div className="flex items-center gap-1.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`sys-btn ${period === option.value ? 'sys-btn-primary' : ''}`}
                title={option.description}
              >
                <span>{option.label}</span>
              </button>
            ))}

            <button
              onClick={() => fetchAnalytics(period)}
              className="sys-btn ml-2"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Charts & Key Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Signups Bar Chart */}
        <div className="ctrl-panel lg:col-span-2">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
              <span className="ctrl-panel-title">Daily New Registrations</span>
            </div>
            <span className="sys-badge font-mono text-[10px]">
              Peak: {maxGrowthCount} signups
            </span>
          </div>

          <div className="ctrl-panel-body">
            {growthBuckets.length === 0 ? (
              <AdminEmptyState
                icon={Users}
                title="No Signups in Window"
                description="No registration records recorded during this time range"
              />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {growthBuckets.map((bucket) => {
                  const percent = maxGrowthCount > 0 ? (bucket.count / maxGrowthCount) * 100 : 0;
                  return (
                    <div key={bucket.key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span>
                          {bucket.date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: period === '1y' ? 'numeric' : undefined
                          })}
                        </span>
                        <span className="text-zinc-200 font-bold">{bucket.count}</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1.5 overflow-hidden">
                        <div
                          className="bg-[var(--sys-cyan)] h-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Key Takeaways */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--sys-amber)]" />
              <span className="ctrl-panel-title">Audience Takeaways</span>
            </div>
          </div>

          <div className="ctrl-panel-body space-y-3 font-mono text-xs">
            <div className="p-2.5 bg-zinc-950 border border-zinc-900 space-y-1">
              <span className="text-[10px] text-zinc-500 block uppercase">Growth Share</span>
              <span className="text-zinc-200">
                {analytics.newUsers.toLocaleString('en-US')} new users accounts for{' '}
                {analytics.totalUsers
                  ? ((analytics.newUsers / analytics.totalUsers) * 100).toFixed(1)
                  : '0.0'}
                % of current userbase.
              </span>
            </div>

            <div className="p-2.5 bg-zinc-950 border border-zinc-900 space-y-1">
              <span className="text-[10px] text-zinc-500 block uppercase">Retention Engagement</span>
              <span className="text-zinc-200">
                {analytics.activeUsers.toLocaleString('en-US')} users active with {activeRate.toFixed(1)}% session retention.
              </span>
            </div>

            <div className="p-2.5 bg-zinc-950 border border-zinc-900 space-y-1">
              <span className="text-[10px] text-zinc-500 block uppercase">Peak Acquisition</span>
              <span className="text-zinc-200">
                Peak registration velocity recorded at {maxGrowthCount.toLocaleString('en-US')} accounts in a single diurnal cycle.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsUsers;
