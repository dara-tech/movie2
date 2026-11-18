import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Star,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  ChevronUp,
  PenTool,
  CheckCircle2,
  Clock,
  Flame,
  Award,
  User as UserIcon,
  X,
  Share2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export interface Review {
  id: string;
  movieId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  isTeamReviewer: boolean;
  teamBadge?: string;
  rating: number; // 1 to 5
  title: string;
  content: string;
  createdAt: string; // ISO string
  likes: number;
}

export interface MovieReviewsProps {
  movieId?: string;
  mediaId?: string;
  movieTitle?: string;
  title?: string;
  mediaType?: 'movie' | 'tv' | 'tvshow';
  className?: string;
  onClose?: () => void;
  isOpenAsDrawer?: boolean;
}

// Initial seed reviews for high quality visual presentation out-of-the-box
const SEED_REVIEWS: Review[] = [
  {
    id: 'rev-seed-1',
    movieId: 'default',
    authorName: 'Julian Sterling',
    authorRole: 'MovieStream Senior Critic',
    isTeamReviewer: true,
    teamBadge: 'TEAM REVIEWER',
    rating: 5,
    title: 'A monumental sensory masterclass in tension and craft',
    content:
      'From the opening frame to the breathtaking crescendo, this production fires on every single cylinder. The spatial audio engineering and dynamic contrast demand the highest bitrate stream your screen can handle. The performances ground the thematic scale into deeply intimate moments that linger long after the credits roll.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hrs ago
    likes: 47,
  },
  {
    id: 'rev-seed-2',
    movieId: 'default',
    authorName: 'Elena Rostova',
    authorRole: 'Editorial Curator',
    isTeamReviewer: true,
    teamBadge: 'STAFF CURATOR',
    rating: 5,
    title: 'Exquisite pacing and flawless audiovisual fidelity',
    content:
      'A brilliant balance of high concept and razor-sharp emotional core. The visual palette makes full use of cybernetic neon contrast and moody shadows. An absolute benchmark entry for our 4K Cinema Stream lineup.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    likes: 35,
  },
  {
    id: 'rev-seed-3',
    movieId: 'default',
    authorName: 'Kaelen Vance',
    authorRole: 'MovieStream Tech & VFX Lead',
    isTeamReviewer: true,
    teamBadge: 'TEAM REVIEWER',
    rating: 4,
    title: 'Visually staggering with an unforgettable climax',
    content:
      'The practical effects combined with subtle CGI enhancements create an uncanny sense of weight and tactile realism. While the second act takes a minute to reposition its pieces, the payoff in the final thirty minutes is nothing short of relentless.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
    likes: 29,
  },
  {
    id: 'rev-seed-4',
    movieId: 'default',
    authorName: 'Maya Chen',
    authorRole: 'Verified Cinephile',
    isTeamReviewer: false,
    rating: 5,
    title: 'Pure adrenaline! Best stream of the month',
    content:
      'Zero buffering in 1080p/4K and crystal clear surround audio. The soundtrack gave me goosebumps throughout. Watch this with good headphones or surround sound turned up!',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // 5 days ago
    likes: 18,
  },
  {
    id: 'rev-seed-5',
    movieId: 'default',
    authorName: 'David Miller',
    authorRole: 'Community Member',
    isTeamReviewer: false,
    rating: 4,
    title: 'Well-acted, slick aesthetic, and great pacing',
    content:
      'A very satisfying watch. Some familiar tropes here and there, but elevated by sharp dialogue and charismatic lead performances. Highly recommended for weekend movie night.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(), // 8 days ago
    likes: 12,
  },
];

type FilterType = 'all' | 'team' | 'top' | 'recent';

// Utility for clean relative time
const formatRelativeTime = (isoString: string): string => {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 5) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
};

// Rating labels helper
const RATING_LABELS: Record<number, string> = {
  1: '1 - Poor',
  2: '2 - Fair',
  3: '3 - Good',
  4: '4 - Very Good',
  5: '5 - Masterpiece',
};

// --- Subcomponents with React.memo for 60fps performance ---

const StarRatingDisplay = memo(({ rating, max = 5, size = 'md' }: { rating: number; max?: number; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => {
        const starIndex = i + 1;
        const filled = starIndex <= Math.round(rating);
        return (
          <Star
            key={i}
            className={`${sizeClasses} ${
              filled
                ? 'fill-cyan-400 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.45)]'
                : 'text-slate-700/80 fill-slate-800/40'
            } transition-colors duration-150`}
          />
        );
      })}
    </div>
  );
});
StarRatingDisplay.displayName = 'StarRatingDisplay';

interface BreakdownRowProps {
  stars: number;
  count: number;
  percentage: number;
  onFilterStars?: (stars: number) => void;
}

const BreakdownRow = memo(({ stars, count, percentage, onFilterStars }: BreakdownRowProps) => {
  return (
    <button
      type="button"
      onClick={() => onFilterStars?.(stars)}
      className="group w-full flex items-center gap-2.5 text-xs text-slate-300 hover:text-cyan-300 transition-colors py-1 cursor-pointer focus:outline-none"
    >
      <span className="w-10 text-left font-mono text-[11px] font-semibold text-slate-400 group-hover:text-cyan-400">
        {stars} ★
      </span>
      <div className="flex-1 h-2 rounded-full bg-slate-900/90 border border-slate-800 overflow-hidden p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)] transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono text-[11px] text-slate-400 group-hover:text-slate-200">
        {count}
      </span>
    </button>
  );
});
BreakdownRow.displayName = 'BreakdownRow';

interface ReviewItemProps {
  review: Review;
  isLiked: boolean;
  onToggleLike: (id: string) => void;
}

const ReviewCard = memo(({ review, isLiked, onToggleLike }: ReviewItemProps) => {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`"${review.title}" - ${review.authorName} on MovieStream`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [review.title, review.authorName]);

  const initials = useMemo(() => {
    return review.authorName
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [review.authorName]);

  return (
    <article
      className={`relative rounded-xl p-4 sm:p-5 transition-all duration-200 backdrop-blur-xl border ${
        review.isTeamReviewer
          ? 'bg-gradient-to-b from-blue-950/40 via-slate-900/90 to-black/80 border-blue-500/40 shadow-[0_0_24px_rgba(37,99,235,0.12)] hover:border-cyan-400/60'
          : 'bg-slate-900/60 border-slate-800/80 hover:border-blue-500/30 hover:bg-slate-900/90'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            {review.authorAvatar ? (
              <img
                src={review.authorAvatar}
                alt={review.authorName}
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-500/40 shadow-sm"
              />
            ) : (
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border ${
                  review.isTeamReviewer
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-black border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {initials || <UserIcon className="w-4 h-4" />}
              </div>
            )}
            {review.isTeamReviewer && (
              <span
                title="Verified MovieStream Team Member"
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-md ring-2 ring-black"
              >
                <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
              </span>
            )}
          </div>

          {/* Author Meta */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm tracking-wide">
                {review.authorName}
              </span>

              {review.isTeamReviewer && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-950/80 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  {review.teamBadge || 'TEAM REVIEWER'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              {review.authorRole && (
                <>
                  <span className="text-slate-400 font-medium">{review.authorRole}</span>
                  <span className="text-slate-600">•</span>
                </>
              )}
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-slate-400" />
                {formatRelativeTime(review.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Rating and Actions */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <StarRatingDisplay rating={review.rating} size="sm" />
            <span className="text-[11px] font-mono font-bold text-cyan-400 mt-0.5">
              {review.rating}.0 / 5
            </span>
          </div>
        </div>
      </div>

      {/* Review Content */}
      <div className="space-y-2 mt-2">
        <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
          {review.title}
        </h4>
        <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed whitespace-pre-line font-normal">
          {review.content}
        </p>
      </div>

      {/* Footer / Interaction Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleLike(review.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-150 ${
              isLiked
                ? 'bg-blue-600/30 border-blue-400 text-cyan-300 shadow-[0_0_12px_rgba(37,99,235,0.3)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <ThumbsUp
              className={`w-3.5 h-3.5 transition-transform ${
                isLiked ? 'fill-cyan-400 text-cyan-400 scale-110' : ''
              }`}
            />
            <span className="font-mono text-xs font-semibold">
              {review.likes + (isLiked ? 1 : 0)}
            </span>
            <span className="hidden sm:inline text-[11px]">Helpful</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50 transition-colors"
            title="Share review quote"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {review.isTeamReviewer && (
          <div className="flex items-center gap-1 text-[11px] text-cyan-400/90 font-medium">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span>Official Editorial Review</span>
          </div>
        )}
      </div>
    </article>
  );
});
ReviewCard.displayName = 'ReviewCard';

// --- Main MovieReviews Component ---

export const MovieReviews: React.FC<MovieReviewsProps> = ({
  movieId,
  mediaId,
  movieTitle,
  title,
  mediaType = 'movie',
  className = '',
  onClose,
  isOpenAsDrawer = false,
}) => {
  const effectiveId = mediaId || movieId || 'default';
  const effectiveTitle = title || movieTitle || 'Cinema Stream';
  const { user } = useAuth();

  const storageKey = useMemo(() => `moviestream_reviews_${effectiveId}`, [effectiveId]);
  const likesStorageKey = 'moviestream_liked_reviews';

  // State: Reviews list
  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load reviews from localStorage', e);
    }
    // Fallback: customize seed reviews with this id
    return SEED_REVIEWS.map((r) => ({ ...r, movieId: effectiveId }));
  });

  // State: User liked review IDs
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(likesStorageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // State: Filter and Active Tab
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);

  // State: Form Accordion
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAuthorName, setFormAuthorName] = useState(
    user?.username || (user?.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : '')
  );
  const [formIsTeam, setFormIsTeam] = useState<boolean>(() => {
    return user?.role === 'admin' || user?.role === 'super_admin';
  });
  const [formTeamRole, setFormTeamRole] = useState(
    user?.role === 'admin' || user?.role === 'super_admin' ? 'MovieStream Staff' : 'Verified Critic'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Sync author name if user logs in later
  useEffect(() => {
    if (user?.username && !formAuthorName) {
      setFormAuthorName(user.username);
    }
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      setFormIsTeam(true);
    }
  }, [user, formAuthorName]);

  // Persist reviews to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(reviews));
    } catch (e) {
      console.warn('Failed to save reviews to localStorage', e);
    }
  }, [reviews, storageKey]);

  // Persist likes
  const toggleLike = useCallback(
    (reviewId: string) => {
      setLikedMap((prev) => {
        const next = { ...prev, [reviewId]: !prev[reviewId] };
        try {
          localStorage.setItem(likesStorageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [likesStorageKey]
  );

  // Calculate review statistics
  const stats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        average: 0,
        total: 0,
        teamCount: 0,
        breakdown: [
          { stars: 5, count: 0, percentage: 0 },
          { stars: 4, count: 0, percentage: 0 },
          { stars: 3, count: 0, percentage: 0 },
          { stars: 2, count: 0, percentage: 0 },
          { stars: 1, count: 0, percentage: 0 },
        ],
        teamAverage: 0,
        recommendationRate: 100,
      };
    }

    let sum = 0;
    let teamSum = 0;
    let teamCount = 0;
    const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    reviews.forEach((r) => {
      sum += r.rating;
      const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
      starCounts[rounded] = (starCounts[rounded] || 0) + 1;
      if (r.isTeamReviewer) {
        teamSum += r.rating;
        teamCount += 1;
      }
    });

    const average = Number((sum / total).toFixed(1));
    const teamAverage = teamCount > 0 ? Number((teamSum / teamCount).toFixed(1)) : average;
    const positiveReviews = (starCounts[4] || 0) + (starCounts[5] || 0);
    const recommendationRate = Math.round((positiveReviews / total) * 100);

    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: starCounts[stars] || 0,
      percentage: total > 0 ? Math.round(((starCounts[stars] || 0) / total) * 100) : 0,
    }));

    return {
      average,
      total,
      teamCount,
      breakdown,
      teamAverage,
      recommendationRate,
    };
  }, [reviews]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    let list = [...reviews];

    // Filter by star breakdown if clicked
    if (selectedStarFilter !== null) {
      list = list.filter((r) => Math.round(r.rating) === selectedStarFilter);
    }

    // Filter by tab
    switch (activeFilter) {
      case 'team':
        return list.filter((r) => r.isTeamReviewer);
      case 'top':
        return list.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.likes - a.likes;
        });
      case 'recent':
        return list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'all':
      default:
        // Prioritize team reviews on top for editorial quality, then by date
        return list.sort((a, b) => {
          if (a.isTeamReviewer && !b.isTeamReviewer) return -1;
          if (!a.isTeamReviewer && b.isTeamReviewer) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
  }, [reviews, activeFilter, selectedStarFilter]);

  // Handle submit review
  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const newReview: Review = {
        id: `rev-${Date.now()}`,
        movieId: effectiveId,
        authorName: formAuthorName.trim() || 'Anonymous Cinephile',
        authorAvatar: user?.profile?.avatar,
        authorRole: formIsTeam ? formTeamRole || 'MovieStream Staff' : 'Verified Member',
        isTeamReviewer: formIsTeam,
        teamBadge: formIsTeam ? 'TEAM REVIEWER' : undefined,
        rating: formRating,
        title: formTitle.trim(),
        content: formContent.trim(),
        createdAt: new Date().toISOString(),
        likes: 0,
      };

      setReviews((prev) => [newReview, ...prev]);
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setFormTitle('');
      setFormContent('');

      // Auto collapse accordion after brief success animation
      setTimeout(() => {
        setSubmitSuccess(false);
        setIsFormOpen(false);
      }, 1500);
    }, 600);
  };

  return (
    <div
      className={`w-full text-slate-100 ${
        isOpenAsDrawer
          ? 'h-full flex flex-col bg-slate-950 border-l border-blue-500/20'
          : 'relative rounded-2xl bg-slate-950/90 border border-blue-500/30 backdrop-blur-xl shadow-[0_0_40px_rgba(37,99,235,0.12)] p-4 sm:p-6 lg:p-8'
      } ${className}`}
    >
      {/* Top Header / Drawer Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-blue-500/20 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <MessageSquare className="w-5 h-5 fill-black stroke-black" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Team & Community Reviews</span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-blue-900/50 text-cyan-300 border border-blue-500/30">
                PRO CRITICS
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Verified reviews for <span className="text-cyan-400 font-semibold">{effectiveTitle}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isFormOpen && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 border border-cyan-400/50 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
            >
              <PenTool className="w-3.5 h-3.5 text-cyan-200" />
              <span>Write Review</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close reviews panel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Review Stats Header Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4 sm:p-6 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-black/80 border border-blue-500/30 shadow-[0_0_25px_rgba(37,99,235,0.1)] mb-6">
        {/* Overall Rating Block */}
        <div className="md:col-span-4 flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-slate-900/80 border border-blue-500/20 text-center">
          <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase mb-1">
            Overall Rating
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 drop-shadow-[0_0_18px_rgba(6,182,212,0.4)]">
              {stats.average}
            </span>
            <span className="text-lg text-slate-400 font-semibold">/ 5</span>
          </div>

          <StarRatingDisplay rating={stats.average} size="md" />

          <span className="text-xs text-slate-400 mt-2 font-mono">
            {stats.total} {stats.total === 1 ? 'review' : 'verified reviews'}
          </span>

          {/* Team score highlight */}
          <div className="mt-3 pt-3 border-t border-slate-800 w-full flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1 text-cyan-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Team Critic Score:
            </span>
            <span className="font-mono font-bold text-white bg-blue-900/50 px-2 py-0.5 rounded border border-blue-500/30">
              {stats.teamAverage} ★
            </span>
          </div>
        </div>

        {/* Rating Breakdown Bars */}
        <div className="md:col-span-8 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Rating Breakdown
            </span>
            {selectedStarFilter && (
              <button
                type="button"
                onClick={() => setSelectedStarFilter(null)}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Clear {selectedStarFilter}★ filter</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {stats.breakdown.map((row) => (
              <BreakdownRow
                key={row.stars}
                stars={row.stars}
                count={row.count}
                percentage={row.percentage}
                onFilterStars={(stars) =>
                  setSelectedStarFilter((prev) => (prev === stars ? null : stars))
                }
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              {stats.recommendationRate}% recommended by audience
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {stats.teamCount} Editorial Critiques
            </span>
          </div>
        </div>
      </div>

      {/* "Write a Review" Collapsible Accordion Form */}
      {isFormOpen && (
        <div className="mb-6 rounded-xl p-4 sm:p-6 bg-slate-900/95 border-2 border-blue-500/40 shadow-[0_0_30px_rgba(37,99,235,0.2)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Write Your Review
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
            >
              <span>Cancel</span>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-12 h-12 text-cyan-400 animate-bounce mb-2" />
              <h5 className="text-base font-bold text-white">Review Published Successfully!</h5>
              <p className="text-xs text-slate-400 mt-1">
                Your critique is now live on MovieStream.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5">
                  Your Rating
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isHovered = hoverRating >= star;
                      const isSelected = formRating >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setFormRating(star)}
                          className="p-1 focus:outline-none transition-transform hover:scale-125 active:scale-95"
                          aria-label={`Rate ${star} star`}
                        >
                          <Star
                            className={`w-6 h-6 transition-colors duration-150 ${
                              isHovered || (!hoverRating && isSelected)
                                ? 'fill-cyan-400 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                                : 'text-slate-700 fill-slate-800'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-500/30">
                    {RATING_LABELS[hoverRating || formRating]}
                  </span>
                </div>
              </div>

              {/* Reviewer Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
                    Your Name / Display Alias
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    placeholder="e.g. CinemaLover42"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-black/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                  />
                </div>

                {/* Team Toggle (Admin or verified) */}
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-blue-950/40 border border-blue-500/30 cursor-pointer hover:border-cyan-400/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formIsTeam}
                      onChange={(e) => setFormIsTeam(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-cyan-400 border-slate-700 bg-slate-900"
                    />
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      <span>Publish as Team / Staff Review</span>
                    </div>
                  </label>
                </div>
              </div>

              {formIsTeam && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
                    Staff Designation / Critic Role
                  </label>
                  <input
                    type="text"
                    value={formTeamRole}
                    onChange={(e) => setFormTeamRole(e.target.value)}
                    placeholder="e.g. Lead Editorial Critic, Staff Curator"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-black/60 border border-blue-500/40 text-cyan-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                  />
                </div>
              )}

              {/* Review Headline / Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
                  Headline / Summary
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Summarize your review in one sharp punchline..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-black/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                />
              </div>

              {/* Review Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Detailed Critique
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {formContent.length} chars
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="What worked? How was the cinematography, audio mix, pacing, and acting? Give fellow streamers your detailed analysis..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-black/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors resize-y leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formTitle.trim() || !formContent.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="xs" inline text="Publishing..." color="white" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Post Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-800">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setSelectedStarFilter(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'all' && selectedStarFilter === null
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>All Reviews</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40">
              {reviews.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFilter('team');
              setSelectedStarFilter(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'team'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Team & Staff</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40 text-cyan-200">
              {stats.teamCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('top')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'top'
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Top Rated</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('recent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === 'recent'
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Most Recent</span>
          </button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-[11px]">
            Showing {filteredReviews.length} of {reviews.length}
          </span>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800">
            <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h5 className="text-sm font-bold text-white mb-1">No reviews match this filter</h5>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Be the first to leave a critique for this title!
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveFilter('all');
                setSelectedStarFilter(null);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20"
            >
              Write First Review
            </button>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isLiked={Boolean(likedMap[review.id])}
              onToggleLike={toggleLike}
            />
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>MovieStream Verified Review System • Cyber Cyan Edition</span>
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          Instant offline caching enabled
        </span>
      </div>
    </div>
  );
};

export default MovieReviews;
