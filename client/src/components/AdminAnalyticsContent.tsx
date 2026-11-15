import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film,
  Tv,
  Layout,
  Sparkles,
  CalendarRange,
  RefreshCw,
  Activity,
  ShieldCheck,
  ArrowRight,
  Globe2,
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { Card } from './ui/card';
import { moviePath, tvShowPath } from '../utils/paths';

interface PopularGenre {
  _id: string;
  name?: string;
  count: number;
}

interface YearlyBreakdown {
  year: number;
  movies: number;
  tvShows: number;
  total: number;
}

interface UpcomingItemSummary {
  id: string | null;
  tmdbId?: number | null;
  title: string;
  releaseDate?: string | null;
  posterPath?: string | null;
  voteAverage?: number | null;
}

interface UpcomingAnalytics {
  count: number;
  items: UpcomingItemSummary[];
}

interface CountryBreakdownItem {
  code: string;
  name: string;
  count: number;
}

interface ContentAnalyticsResponse {
  totalMovies: number;
  totalTvShows: number;
  totalGenres: number;
  popularGenres: PopularGenre[];
  contentByYear: YearlyBreakdown[];
  upcoming: {
    movies: UpcomingAnalytics;
    tv: UpcomingAnalytics;
  };
  countryBreakdown: {
    movies: CountryBreakdownItem[];
    tv: CountryBreakdownItem[];
  };
}

interface LiveItemSummary {
  id: number;
  title: string;
  subtitle?: string | null;
  posterPath?: string | null;
  popularity?: number | null;
  voteAverage?: number | null;
}

interface LiveCategorySummary {
  totalResults: number;
  totalPages: number;
  sample: LiveItemSummary[];
}

interface LiveSyncSnapshot {
  fetchedAt: string;
  movies: {
    popular: LiveCategorySummary;
    trending: LiveCategorySummary;
    topRated: LiveCategorySummary;
    upcoming: LiveCategorySummary;
  };
  tv: {
    popular: LiveCategorySummary;
    trending: LiveCategorySummary;
    topRated: LiveCategorySummary;
    onTheAir: LiveCategorySummary;
  };
}

interface SyncStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalSuccessCount?: number;
  totalFailureCount?: number;
  totalItemsSynced?: number;
  syncSuccessRate?: number;
  lastSyncTime?: string;
}

const DEFAULT_ANALYTICS: ContentAnalyticsResponse = {
  totalMovies: 0,
  totalTvShows: 0,
  totalGenres: 0,
  popularGenres: [],
  contentByYear: [],
  upcoming: {
    movies: { count: 0, items: [] },
    tv: { count: 0, items: [] }
  },
  countryBreakdown: {
    movies: [],
    tv: []
  }
};

const createDefaultCategorySummary = (): LiveCategorySummary => ({
  totalResults: 0,
  totalPages: 0,
  sample: []
});

const createDefaultLiveSync = (): LiveSyncSnapshot => ({
  fetchedAt: '',
  movies: {
    popular: createDefaultCategorySummary(),
    trending: createDefaultCategorySummary(),
    topRated: createDefaultCategorySummary(),
    upcoming: createDefaultCategorySummary()
  },
  tv: {
    popular: createDefaultCategorySummary(),
    trending: createDefaultCategorySummary(),
    topRated: createDefaultCategorySummary(),
    onTheAir: createDefaultCategorySummary()
  }
});

const DEFAULT_SYNC_STATS: SyncStats = {
  totalJobs: 0,
  activeJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  totalSuccessCount: 0,
  totalFailureCount: 0,
  totalItemsSynced: 0,
  syncSuccessRate: 0,
  lastSyncTime: undefined
};

const WIDTH_CLASSES = [
  'w-0',
  'w-1/12',
  'w-2/12',
  'w-3/12',
  'w-4/12',
  'w-5/12',
  'w-6/12',
  'w-7/12',
  'w-8/12',
  'w-9/12',
  'w-10/12',
  'w-11/12',
  'w-12/12'
] as const;

const TAB_OPTIONS = [
  { id: 'database', label: 'Database' },
  { id: 'sync', label: 'Sync' }
] as const;

type TabId = (typeof TAB_OPTIONS)[number]['id'];

const AdminAnalyticsContent: React.FC = () => {
  const [analytics, setAnalytics] = useState<ContentAnalyticsResponse>(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('database');
  const [syncStats, setSyncStats] = useState<SyncStats>(DEFAULT_SYNC_STATS);
  const [liveSync, setLiveSync] = useState<LiveSyncSnapshot>(createDefaultLiveSync());
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [contentResponse, syncResponse] = await Promise.all([
        api.get('/api/admin/analytics/content'),
        api.get('/api/admin/sync/stats')
      ]);

      const contentData = contentResponse.data?.data as Partial<ContentAnalyticsResponse> | undefined;

      const normalizeYearly = (entries: any): YearlyBreakdown[] => {
        if (!Array.isArray(entries)) return [];
        return entries
          .map((item) => {
            const rawYear = item?.year ?? item?._id;
            const year = typeof rawYear === 'number' ? rawYear : Number(rawYear);
            if (!year || Number.isNaN(year)) return null;
            const movies = Number(item?.movies ?? item?.count ?? 0) || 0;
            const tvShows = Number(item?.tvShows ?? item?.series ?? 0) || 0;
            const total = Number(item?.total ?? movies + tvShows) || movies + tvShows;
            return { year, movies, tvShows, total };
          })
          .filter((value): value is YearlyBreakdown => Boolean(value))
          .sort((a, b) => a.year - b.year);
      };

      const normalizeUpcoming = (source: any): UpcomingAnalytics => {
        if (!source) {
          return { count: 0, items: [] };
        }
        const count = typeof source.count === 'number' ? source.count : Number(source.total ?? 0) || 0;
        const items = Array.isArray(source.items) ? source.items : [];
        return {
          count,
          items: items.map((item: any) => ({
            id: item?.id != null ? String(item.id) : item?._id != null ? String(item._id) : null,
            tmdbId: typeof item?.tmdbId === 'number' ? item.tmdbId : null,
            title: item?.title || item?.name || 'Untitled',
            releaseDate: item?.releaseDate || item?.firstAirDate || null,
            posterPath: item?.posterPath || null,
            voteAverage: typeof item?.voteAverage === 'number' ? item.voteAverage : null
          }))
        };
      };

      const normalizeCountry = (source: any): CountryBreakdownItem[] => {
        if (!Array.isArray(source)) return [];
        return source
          .map((entry) => {
            const code = entry?.code ?? entry?.isoCode ?? entry?._id ?? 'UNKNOWN';
            const name = entry?.name || entry?.label || entry?.country || code || 'Unknown';
            const count = Number(entry?.count ?? 0) || 0;
            return {
              code: String(code).toUpperCase(),
              name: typeof name === 'string' ? name : String(name),
              count
            };
          })
          .filter((entry) => entry.count > 0)
          .sort((a, b) => b.count - a.count);
      };

      if (contentData) {
        setAnalytics({
          totalMovies: contentData.totalMovies ?? 0,
          totalTvShows: contentData.totalTvShows ?? 0,
          totalGenres: contentData.totalGenres ?? 0,
          popularGenres: Array.isArray(contentData.popularGenres) ? contentData.popularGenres : [],
          contentByYear: normalizeYearly(contentData.contentByYear),
          upcoming: {
            movies: normalizeUpcoming(contentData.upcoming?.movies),
            tv: normalizeUpcoming(contentData.upcoming?.tv)
          },
          countryBreakdown: {
            movies: normalizeCountry(contentData.countryBreakdown?.movies),
            tv: normalizeCountry(contentData.countryBreakdown?.tv)
          }
        });
      } else {
        setAnalytics(DEFAULT_ANALYTICS);
      }

      const incomingSyncStats = (syncResponse.data || {}) as SyncStats | undefined;
      if (incomingSyncStats) {
        setSyncStats({
          ...DEFAULT_SYNC_STATS,
          ...incomingSyncStats,
          totalJobs: incomingSyncStats.totalJobs ?? 0,
          activeJobs: incomingSyncStats.activeJobs ?? 0,
          completedJobs: incomingSyncStats.completedJobs ?? 0,
          failedJobs: incomingSyncStats.failedJobs ?? 0,
          totalSuccessCount: incomingSyncStats.totalSuccessCount ?? 0,
          totalFailureCount: incomingSyncStats.totalFailureCount ?? 0,
          totalItemsSynced: incomingSyncStats.totalItemsSynced ?? 0,
          syncSuccessRate: incomingSyncStats.syncSuccessRate ?? 0,
          lastSyncTime: incomingSyncStats.lastSyncTime
        });
      } else {
        setSyncStats(DEFAULT_SYNC_STATS);
      }

      try {
        const liveResponse = await api.get('/api/admin/analytics/sync/live');
        const liveData = liveResponse.data?.data as LiveSyncSnapshot | undefined;
        if (liveData) {
          setLiveSync({
            fetchedAt: liveData.fetchedAt || '',
            movies: {
              popular: liveData.movies?.popular || createDefaultCategorySummary(),
              trending: liveData.movies?.trending || createDefaultCategorySummary(),
              topRated: liveData.movies?.topRated || createDefaultCategorySummary(),
              upcoming: liveData.movies?.upcoming || createDefaultCategorySummary()
            },
            tv: {
              popular: liveData.tv?.popular || createDefaultCategorySummary(),
              trending: liveData.tv?.trending || createDefaultCategorySummary(),
              topRated: liveData.tv?.topRated || createDefaultCategorySummary(),
              onTheAir: liveData.tv?.onTheAir || createDefaultCategorySummary()
            }
          });
        } else {
          setLiveSync(createDefaultLiveSync());
        }
      } catch (liveError) {
        setLiveSync(createDefaultLiveSync());
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to fetch analytics or sync statistics';
      setError(message);
      setAnalytics(DEFAULT_ANALYTICS);
      setSyncStats(DEFAULT_SYNC_STATS);
      setLiveSync(createDefaultLiveSync());
    } finally {
      setLoading(false);
    }
  };

  const totalLibrarySize = useMemo(() => {
    return (analytics.totalMovies ?? 0) + (analytics.totalTvShows ?? 0);
  }, [analytics.totalMovies, analytics.totalTvShows]);

  const maxGenreCount = useMemo(() => {
    if (!analytics.popularGenres.length) return 0;
    return Math.max(...analytics.popularGenres.map((genre) => genre.count ?? 0));
  }, [analytics.popularGenres]);

  const maxYearTotal = useMemo(() => {
    if (!analytics.contentByYear.length) return 0;
    return Math.max(...analytics.contentByYear.map((item) => item.total ?? 0));
  }, [analytics.contentByYear]);

  const maxYearMovies = useMemo(() => {
    if (!analytics.contentByYear.length) return 0;
    return Math.max(...analytics.contentByYear.map((item) => item.movies ?? 0));
  }, [analytics.contentByYear]);

  const maxYearTv = useMemo(() => {
    if (!analytics.contentByYear.length) return 0;
    return Math.max(...analytics.contentByYear.map((item) => item.tvShows ?? 0));
  }, [analytics.contentByYear]);

  const maxMovieCountryCount = useMemo(() => {
    if (!analytics.countryBreakdown.movies.length) return 0;
    return Math.max(...analytics.countryBreakdown.movies.map((item) => item.count ?? 0));
  }, [analytics.countryBreakdown.movies]);

  const maxTvCountryCount = useMemo(() => {
    if (!analytics.countryBreakdown.tv.length) return 0;
    return Math.max(...analytics.countryBreakdown.tv.map((item) => item.count ?? 0));
  }, [analytics.countryBreakdown.tv]);

  const syncSuccessRate = useMemo(() => {
    const rate = syncStats.syncSuccessRate ?? 0;
    return typeof rate === 'string' ? parseFloat(rate) || 0 : rate;
  }, [syncStats.syncSuccessRate]);

  const totalRuns = useMemo(() => {
    return (syncStats.totalSuccessCount ?? 0) + (syncStats.totalFailureCount ?? 0);
  }, [syncStats.totalSuccessCount, syncStats.totalFailureCount]);

  const lastSyncDisplay = useMemo(() => {
    if (!syncStats.lastSyncTime) return 'Never';
    try {
      const stamp = new Date(syncStats.lastSyncTime);
      return stamp.toLocaleString();
    } catch {
      return 'Unknown';
    }
  }, [syncStats.lastSyncTime]);

  const liveSnapshotDisplay = useMemo(() => {
    if (!liveSync.fetchedAt) {
      return 'Fetching latest snapshot...';
    }
    const parsed = new Date(liveSync.fetchedAt);
    if (Number.isNaN(parsed.getTime())) {
      return liveSync.fetchedAt;
    }
    return `Fetched ${parsed.toLocaleString()}`;
  }, [liveSync.fetchedAt]);

  const liveCards = useMemo(
    () => [
      {
        id: 'movies-popular',
        label: 'Popular Movies',
        summary: liveSync.movies.popular,
        icon: Film,
        iconClass: 'text-red-400'
      },
      {
        id: 'movies-trending',
        label: 'Trending Movies',
        summary: liveSync.movies.trending,
        icon: Sparkles,
        iconClass: 'text-orange-400'
      },
      {
        id: 'tv-popular',
        label: 'Popular TV Shows',
        summary: liveSync.tv.popular,
        icon: Tv,
        iconClass: 'text-blue-400'
      },
      {
        id: 'tv-onair',
        label: 'On The Air',
        summary: liveSync.tv.onTheAir,
        icon: Activity,
        iconClass: 'text-green-400'
      }
    ],
    [liveSync.movies, liveSync.tv]
  );

  const liveMovieSamples = useMemo(() => liveSync.movies.trending.sample, [liveSync.movies]);
  const liveTvSamples = useMemo(() => liveSync.tv.trending.sample, [liveSync.tv]);

  const maxMoviePopularity = useMemo(() => {
    if (!liveMovieSamples.length) return 0;
    return Math.max(...liveMovieSamples.map((item) => item.popularity || 0));
  }, [liveMovieSamples]);

  const maxTvPopularity = useMemo(() => {
    if (!liveTvSamples.length) return 0;
    return Math.max(...liveTvSamples.map((item) => item.popularity || 0));
  }, [liveTvSamples]);

  if (loading) {
    return (
      <LoadingSpinner fullScreen color="red" size="xl" text="Loading content analytics..." />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 bg-gray-900/60 border border-gray-800 p-6">
          <div className="flex items-center justify-center">
            <div className="p-3 bg-red-600/20 rounded-full border border-red-500/30">
              <Layout className="h-6 w-6 text-red-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white">Unable to load analytics</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={fetchAllData}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold uppercase tracking-wide text-xs hover:bg-red-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const formatDateLabel = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatVoteAverage = (value?: number | null) => {
    if (typeof value === 'number') {
      return value.toFixed(1);
    }
    return '—';
  };

  const formatPopularity = (value?: number | null) => {
    if (typeof value === 'number') {
      return Math.round(value).toLocaleString('en-US');
    }
    return '—';
  };

  const getWidthClass = (value: number | null | undefined, maxValue: number): string => {
    if (!value || !maxValue) return WIDTH_CLASSES[0];
    const ratio = Math.max(0, Math.min(1, value / maxValue));
    const index = Math.min(12, Math.max(1, Math.round(ratio * 12)));
    return WIDTH_CLASSES[index];
  };

  const buildMediaLinkId = (id?: string | null, tmdbId?: number | null) => {
    if (id) return id;
    if (tmdbId) return `tmdb_${tmdbId}`;
    return null;
  };

  const handleOpenTmdbMovie = (tmdbId?: number | null) => {
    if (!tmdbId) return;
    navigate(`/movie/tmdb_${tmdbId}`);
  };

  const handleOpenTmdbTv = (tmdbId?: number | null) => {
    if (!tmdbId) return;
    navigate(`/tvshow/tmdb_${tmdbId}`);
  };

  const databaseView = (
    <>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Movies</span>
              <Film className="h-5 w-5 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {analytics.totalMovies.toLocaleString('en-US')}
            </p>
            <p className="text-xs text-gray-500">Titles cached or catalogued.</p>
          </Card>

          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">TV Shows</span>
              <Tv className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {analytics.totalTvShows.toLocaleString('en-US')}
            </p>
            <p className="text-xs text-gray-500">Series currently available.</p>
          </Card>

          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Genres</span>
              <Sparkles className="h-5 w-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {analytics.totalGenres.toLocaleString('en-US')}
            </p>
            <p className="text-xs text-gray-500">
              Distinct genres represented across the library.
            </p>
          </Card>

          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Library Size</span>
              <Layout className="h-5 w-5 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {totalLibrarySize.toLocaleString('en-US')}
            </p>
            <p className="text-xs text-gray-500">Combined movies and TV show entries.</p>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Top Genres</h2>
                <p className="text-xs text-gray-500">
                  Based on the number of titles tagged per genre
                </p>
              </div>
            </div>
            {analytics.popularGenres.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No genre distribution data found.
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.popularGenres.map((genre) => {
                  const spanIndex =
                    maxGenreCount > 0
                      ? Math.min(
                          12,
                          Math.max(1, Math.round((genre.count / maxGenreCount) * 12))
                        )
                      : 0;
                  const widthClass = WIDTH_CLASSES[spanIndex];
                  return (
                    <div key={genre._id || genre.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="text-gray-200 font-medium">
                          {genre.name || genre._id || 'Unknown'}
                        </span>
                        <span className="text-white font-semibold">
                          {genre.count.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r from-red-500 to-red-300 ${widthClass}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Content By Release Year</h2>
                <p className="text-xs text-gray-500">
                  Last decade of releases (all titles with a release year)
                </p>
              </div>
              <CalendarRange className="h-5 w-5 text-gray-500" />
            </div>
            {analytics.contentByYear.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No release year data available.
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.contentByYear
                  .slice()
                  .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
                  .map((yearItem) => {
                    return (
                      <div key={yearItem.year ?? 'unknown-year'} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-300">
                          <span className="text-gray-100 font-semibold">
                            {yearItem.year ?? 'Unknown'}
                          </span>
                          <span className="text-white font-semibold">
                            {yearItem.total.toLocaleString('en-US')} total
                          </span>
                        </div>
                        <div className="space-y-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300">Movies</span>
                              <span className="text-gray-200 tracking-normal">
                                {yearItem.movies.toLocaleString('en-US')}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-900 border border-gray-800 overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r from-red-500 to-red-300 ${getWidthClass(
                                  yearItem.movies,
                                  maxYearMovies
                                )}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300">TV Shows</span>
                              <span className="text-gray-200 tracking-normal">
                                {yearItem.tvShows.toLocaleString('en-US')}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-900 border border-gray-800 overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r from-blue-500 to-blue-300 ${getWidthClass(
                                  yearItem.tvShows,
                                  maxYearTv
                                )}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Upcoming Movies</h2>
                <p className="text-xs text-gray-500">
                  {analytics.upcoming.movies.count.toLocaleString('en-US')} titles launching soon
                </p>
              </div>
              <CalendarRange className="h-5 w-5 text-gray-500" />
            </div>
            {analytics.upcoming.movies.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No upcoming movie releases in the schedule.
              </div>
            ) : (
              <div className="space-y-2">
                {analytics.upcoming.movies.items.map((item) => {
                  const linkId = buildMediaLinkId(item.id, item.tmdbId);
                  return (
                    <button
                      key={`${item.title}-${item.releaseDate}-${item.id ?? item.tmdbId ?? 'unknown'}`}
                      type="button"
                      onClick={() => linkId && navigate(moviePath({ _id: String(linkId), title: item.title }))}
                      className="group flex w-full items-center gap-3 rounded-none border border-gray-800 bg-gray-900/40 px-3 py-2 text-left transition hover:border-red-500/40 hover:bg-gray-900/70"
                    >
                      <div className="relative h-16 w-12 overflow-hidden bg-gray-800">
                        {item.posterPath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w154${item.posterPath}`}
                            alt={item.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
                            No Art
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                          <span>{formatDateLabel(item.releaseDate)}</span>
                          {typeof item.voteAverage === 'number' && (
                            <span>⭐ {formatVoteAverage(item.voteAverage)}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-500 transition group-hover:text-red-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Upcoming TV Premieres</h2>
                <p className="text-xs text-gray-500">
                  {analytics.upcoming.tv.count.toLocaleString('en-US')} series headed to the lineup
                </p>
              </div>
              <CalendarRange className="h-5 w-5 text-gray-500" />
            </div>
            {analytics.upcoming.tv.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No upcoming TV premieres in the schedule.
              </div>
            ) : (
              <div className="space-y-2">
                {analytics.upcoming.tv.items.map((item) => {
                  const linkId = buildMediaLinkId(item.id, item.tmdbId);
                  return (
                    <button
                      key={`${item.title}-${item.releaseDate}-${item.id ?? item.tmdbId ?? 'unknown'}`}
                      type="button"
                      onClick={() => linkId && navigate(tvShowPath({ _id: String(linkId), name: item.title }))}
                      className="group flex w-full items-center gap-3 rounded-none border border-gray-800 bg-gray-900/40 px-3 py-2 text-left transition hover:border-blue-500/40 hover:bg-gray-900/70"
                    >
                      <div className="relative h-16 w-12 overflow-hidden bg-gray-800">
                        {item.posterPath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w154${item.posterPath}`}
                            alt={item.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
                            No Art
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                          <span>{formatDateLabel(item.releaseDate)}</span>
                          {typeof item.voteAverage === 'number' && (
                            <span>⭐ {formatVoteAverage(item.voteAverage)}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-500 transition group-hover:text-blue-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Production Hotspots · Movies</h2>
                <p className="text-xs text-gray-500">
                  Top countries represented across cached movie catalogue
                </p>
              </div>
              <Globe2 className="h-5 w-5 text-gray-500" />
            </div>
            {analytics.countryBreakdown.movies.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No country insight available.</div>
            ) : (
              <div className="space-y-3">
                {analytics.countryBreakdown.movies.map((country) => (
                  <div key={country.code} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span className="text-gray-200 font-medium">
                        {country.name} <span className="text-gray-500">({country.code})</span>
                          </span>
                          <span className="text-white font-semibold">
                        {country.count.toLocaleString('en-US')}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                          <div
                        className={`h-full bg-gradient-to-r from-green-500 to-green-300 ${getWidthClass(
                          country.count,
                          maxMovieCountryCount
                        )}`}
                          />
                        </div>
                      </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Production Hotspots · TV</h2>
                <p className="text-xs text-gray-500">
                  Leading countries for series in the cached catalogue
                </p>
              </div>
              <Globe2 className="h-5 w-5 text-gray-500" />
            </div>
            {analytics.countryBreakdown.tv.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No country insight available.</div>
            ) : (
              <div className="space-y-3">
                {analytics.countryBreakdown.tv.map((country) => (
                  <div key={country.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">
                        {country.name} <span className="text-gray-500">({country.code})</span>
                      </span>
                      <span className="text-white font-semibold">
                        {country.count.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r from-blue-500 to-purple-400 ${getWidthClass(
                          country.count,
                          maxTvCountryCount
                        )}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section>
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Programming Insights</h2>
            <ul className="space-y-3 text-sm text-gray-300">
              <li>
                Balance acquisitions across leading genres to reduce over concentration and keep the
                library feeling fresh.
              </li>
              <li>
                Use release year trends to identify back-catalog gaps: if older content thins out,
                consider targeted catalog acquisitions.
              </li>
              <li>
                Cross-reference top genres with watch history data to understand demand relative to
                supply.
              </li>
            </ul>
          </Card>
        </section>
    </>
  );

  const topGenres = analytics.popularGenres.slice(0, 6);
  const recentYears = analytics.contentByYear
    .slice()
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 6);

  const syncView = (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
            Live TMDB Snapshot
          </span>
          <span className="text-xs text-gray-500">{liveSnapshotDisplay}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {liveCards.map((card) => {
            const IconComp = card.icon;
            const totalResults = card.summary.totalResults ?? 0;
            const totalPages = card.summary.totalPages ?? 0;
            return (
              <Card
                key={card.id}
                className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4 hover:border-red-500/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-gray-400">
                    {card.label}
                  </span>
                  <IconComp className={`h-5 w-5 ${card.iconClass}`} />
                </div>
                <p className="text-3xl font-bold text-white">
                  {totalResults.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-gray-500">
                  {totalPages.toLocaleString('en-US')} page
                  {totalPages === 1 ? '' : 's'} of TMDB results
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Movie Popularity Chart</h2>
            <span className="text-xs text-gray-500">Scaled by TMDB popularity</span>
          </div>
          {liveMovieSamples.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No live movie data available.
            </div>
          ) : (
            <div className="space-y-3">
              {liveMovieSamples.map((item) => {
                const widthClass = getWidthClass(item.popularity, maxMoviePopularity);
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">{item.title}</span>
                      <span className="text-gray-500">🔥 {formatPopularity(item.popularity)}</span>
                    </div>
                    <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                      <div className={`h-full bg-gradient-to-r from-red-500 to-orange-400 ${widthClass}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">TV Popularity Chart</h2>
            <span className="text-xs text-gray-500">Scaled by TMDB popularity</span>
          </div>
          {liveTvSamples.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No live TV data available.
            </div>
          ) : (
            <div className="space-y-3">
              {liveTvSamples.map((item) => {
                const widthClass = getWidthClass(item.popularity, maxTvPopularity);
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">{item.title}</span>
                      <span className="text-gray-500">🔥 {formatPopularity(item.popularity)}</span>
                    </div>
                    <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                      <div className={`h-full bg-gradient-to-r from-blue-500 to-purple-400 ${widthClass}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Trending Movies Right Now</h2>
          <p className="text-xs text-gray-500">
            Snapshot of TMDB trending movies at this moment (top {liveMovieSamples.length}).
          </p>
          {liveMovieSamples.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No live movie data available.
            </div>
          ) : (
            <div className="space-y-3">
              {liveMovieSamples.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenTmdbMovie(item.id)}
                  className="flex w-full items-center justify-between border border-gray-900 bg-gray-900/40 px-3 py-2 text-left transition hover:border-red-500/40 hover:bg-gray-900/70"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-gray-500">{formatDateLabel(item.subtitle)}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400 space-y-1">
                    <div>⭐ {formatVoteAverage(item.voteAverage)}</div>
                    <div>🔥 {formatPopularity(item.popularity)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Trending TV Shows</h2>
          <p className="text-xs text-gray-500">
            TMDB trending TV shows sample (top {liveTvSamples.length}), sourced live.
          </p>
          {liveTvSamples.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No live TV show data available.
            </div>
          ) : (
            <div className="space-y-3">
              {liveTvSamples.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenTmdbTv(item.id)}
                  className="flex w-full items-center justify-between border border-gray-900 bg-gray-900/40 px-3 py-2 text-left transition hover:border-blue-500/40 hover:bg-gray-900/70"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-gray-500">{formatDateLabel(item.subtitle)}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400 space-y-1">
                    <div>⭐ {formatVoteAverage(item.voteAverage)}</div>
                    <div>🔥 {formatPopularity(item.popularity)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Upcoming Movie Sync Queue</h2>
              <p className="text-xs text-gray-500">
                {analytics.upcoming.movies.count.toLocaleString('en-US')} movies releasing soon
              </p>
            </div>
            <CalendarRange className="h-5 w-5 text-gray-500" />
          </div>
          {analytics.upcoming.movies.items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No upcoming releases currently tracked. Check TMDB or adjust filters.
            </div>
          ) : (
            <div className="space-y-2">
              {analytics.upcoming.movies.items.map((item) => {
                const linkId = buildMediaLinkId(item.id, item.tmdbId);
                return (
                  <button
                    key={`${item.title}-${item.releaseDate}-${item.id ?? item.tmdbId ?? 'unknown'}`}
                    type="button"
                    onClick={() => linkId && navigate(moviePath({ _id: String(linkId), title: item.title }))}
                    className="group flex w-full items-center gap-3 rounded-none border border-gray-800 bg-gray-900/40 px-3 py-2 text-left transition hover:border-red-500/40 hover:bg-gray-900/70"
                  >
                    <div className="relative h-16 w-12 overflow-hidden bg-gray-800">
                      {item.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w154${item.posterPath}`}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
                          No Art
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                        <span>{formatDateLabel(item.releaseDate)}</span>
                        {typeof item.voteAverage === 'number' && (
                          <span>⭐ {formatVoteAverage(item.voteAverage)}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-500 transition group-hover:text-red-400" />
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Upcoming TV Sync Queue</h2>
              <p className="text-xs text-gray-500">
                {analytics.upcoming.tv.count.toLocaleString('en-US')} premieres scheduled
              </p>
            </div>
            <CalendarRange className="h-5 w-5 text-gray-500" />
          </div>
          {analytics.upcoming.tv.items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No upcoming TV premieres currently tracked.
            </div>
          ) : (
            <div className="space-y-2">
              {analytics.upcoming.tv.items.map((item) => {
                const linkId = buildMediaLinkId(item.id, item.tmdbId);
                return (
                  <button
                    key={`${item.title}-${item.releaseDate}-${item.id ?? item.tmdbId ?? 'unknown'}`}
                    type="button"
                    onClick={() => linkId && navigate(tvShowPath({ _id: String(linkId), name: item.title }))}
                    className="group flex w-full items-center gap-3 rounded-none border border-gray-800 bg-gray-900/40 px-3 py-2 text-left transition hover:border-blue-500/40 hover:bg-gray-900/70"
                  >
                    <div className="relative h-16 w-12 overflow-hidden bg-gray-800">
                      {item.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w154${item.posterPath}`}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-500">
                          No Art
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                        <span>{formatDateLabel(item.releaseDate)}</span>
                        {typeof item.voteAverage === 'number' && (
                          <span>⭐ {formatVoteAverage(item.voteAverage)}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-500 transition group-hover:text-blue-400" />
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Global Coverage · Movies</h2>
              <p className="text-xs text-gray-500">
                Prioritize sync jobs for top-producing markets to maintain catalogue parity.
              </p>
            </div>
            <Globe2 className="h-5 w-5 text-gray-500" />
          </div>
          {analytics.countryBreakdown.movies.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No production country data available. Verify metadata sync.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.countryBreakdown.movies.map((country) => (
                <div key={country.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="text-gray-200 font-medium">
                      {country.name} <span className="text-gray-500">({country.code})</span>
                    </span>
                    <span className="text-white font-semibold">
                      {country.count.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-green-500 to-green-300 ${getWidthClass(
                        country.count,
                        maxMovieCountryCount
                      )}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Global Coverage · TV</h2>
              <p className="text-xs text-gray-500">
                Highlight emerging regions where series inventory continues to grow.
              </p>
            </div>
            <Globe2 className="h-5 w-5 text-gray-500" />
          </div>
          {analytics.countryBreakdown.tv.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No origin country data available for TV catalogue.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.countryBreakdown.tv.map((country) => (
                <div key={country.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="text-gray-200 font-medium">
                      {country.name} <span className="text-gray-500">({country.code})</span>
                    </span>
                    <span className="text-white font-semibold">
                      {country.count.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-blue-500 to-purple-400 ${getWidthClass(
                        country.count,
                        maxTvCountryCount
                      )}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
            Background Sync Jobs
          </span>
          <span className="text-xs text-gray-500">Last run {lastSyncDisplay}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Sync Jobs</span>
              <RefreshCw className="h-5 w-5 text-red-400" />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-white">
                {(syncStats.totalJobs ?? 0).toLocaleString('en-US')}
              </p>
              <p className="text-xs text-gray-500">
                {(syncStats.activeJobs ?? 0).toLocaleString('en-US')} active ·{' '}
                {(syncStats.completedJobs ?? 0).toLocaleString('en-US')} completed ·{' '}
                {(syncStats.failedJobs ?? 0).toLocaleString('en-US')} failed
              </p>
            </div>
          </Card>
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Success Rate</span>
              <ShieldCheck className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">{syncSuccessRate}%</p>
            <p className="text-xs text-gray-500">
              {(syncStats.totalSuccessCount ?? 0).toLocaleString('en-US')} successful runs out of{' '}
              {totalRuns.toLocaleString('en-US')}
            </p>
          </Card>
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Items Synced</span>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {(syncStats.totalItemsSynced ?? 0).toLocaleString('en-US')}
            </p>
            <p className="text-xs text-gray-500">
              Cumulative movies, TV shows, and genres imported from TMDB.
            </p>
          </Card>
          <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-400">Last Sync</span>
              <CalendarRange className="h-5 w-5 text-purple-400" />
            </div>
            <p className="text-lg font-bold text-white">{lastSyncDisplay}</p>
            <p className="text-xs text-gray-500">
              Monitor staleness; schedule urgent jobs if this drifts too far.
            </p>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Sync Coverage</h2>
          <p className="text-sm text-gray-400">
            Snapshot of cached catalogue items that should remain in sync across providers.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs uppercase text-gray-500">Movies Cached</p>
              <p className="text-2xl font-bold text-white">
                {analytics.totalMovies.toLocaleString('en-US')}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs uppercase text-gray-500">Series Cached</p>
              <p className="text-2xl font-bold text-white">
                {analytics.totalTvShows.toLocaleString('en-US')}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs uppercase text-gray-500">Genres Tracked</p>
              <p className="text-2xl font-bold text-white">
                {analytics.totalGenres.toLocaleString('en-US')}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs uppercase text-gray-500">Library Size</p>
              <p className="text-2xl font-bold text-white">
                {totalLibrarySize.toLocaleString('en-US')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Sync Priority Genres</h2>
          <p className="text-xs text-gray-500 mb-4">
            Focus sync jobs on these genres to maximize coverage of the most-viewed catalogue
            segments.
          </p>
          {topGenres.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">No genre data available.</div>
          ) : (
            <div className="space-y-3">
              {topGenres.map((genre, index) => {
                const spanIndex =
                  maxGenreCount > 0
                    ? Math.min(12, Math.max(1, Math.round((genre.count / maxGenreCount) * 12)))
                    : 0;
                const widthClass = WIDTH_CLASSES[spanIndex];
                return (
                  <div key={genre._id || genre.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">
                        #{index + 1} {genre.name || genre._id || 'Unknown'}
                      </span>
                      <span className="text-white font-semibold">
                        {genre.count.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r from-red-500 to-red-300 ${widthClass}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Release Backlog</h2>
          <p className="text-xs text-gray-500 mb-4">
            Ensure recent release years remain fully synchronized; prioritize oldest unsynced
            buckets first.
          </p>
          {recentYears.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">No release data available.</div>
          ) : (
            <div className="space-y-3">
              {recentYears.map((yearItem) => {
                return (
                  <div key={yearItem.year ?? 'unknown-year'} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">
                        {yearItem.year ?? 'Unknown'}
                      </span>
                      <span className="text-white font-semibold">
                        {yearItem.total.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r from-blue-500 to-blue-300 ${getWidthClass(
                          yearItem.total,
                          maxYearTotal
                        )}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="bg-gray-950 border border-gray-800 rounded-none p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Sync Operations Notes</h2>
          <ul className="space-y-3 text-sm text-gray-300 list-disc pl-5">
            <li>
              Run targeted sync jobs for the top three genres to ensure popular content stays fresh
              in the cache.
            </li>
            <li>
              Compare release backlog counts with `AdminSyncManagement` job history to confirm
              recent titles are covered.
            </li>
            <li>
              Use genre counts to decide which collections should be scheduled for overnight syncs
              versus on-demand refresh.
            </li>
            <li>
              Coordinate database cleanup tasks after each large sync run to keep storage usage
              stable.
            </li>
          </ul>
        </Card>
      </section>
    </>
  );

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Control Strip & Views */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layout className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Catalog Telemetry Dimensions</span>
          </div>

          <div className="flex items-center gap-1.5">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`sys-btn ${activeTab === tab.id ? 'sys-btn-primary' : ''}`}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={fetchAllData}
              className="sys-btn ml-2"
              title="Refresh dataset"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'database' ? databaseView : syncView}
    </div>
  );
};

export default AdminAnalyticsContent;


