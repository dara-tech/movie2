import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Compass, Map, Clock, CheckCircle2, Play, Sparkles, Send, Bot, Loader2 } from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { moviePath } from '../utils/paths';

interface RoadmapStep {
  id: string;
  order: number;
  title: string;
  tmdbId?: number;
  summary: string;
  whyWatch: string;
  connection: string;
  runtimeMinutes?: number;
  posterPath?: string | null;
  backdropPath?: string | null;
  contentType?: 'movie' | 'tvshow';
}

interface RoadmapSummary {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  heroImage: string;
  difficulty: string;
  estimatedDuration: string;
  moodTags: string[];
  curatedBy: string;
  lastUpdated: string;
  stepCount: number;
}

interface RoadmapDetail extends RoadmapSummary {
  steps: RoadmapStep[];
  resources?: { title: string; url: string }[];
}

const PROGRESS_WIDTH_CLASSES: Record<number, string> = {
  0: 'w-0',
  5: 'w-[5%]',
  10: 'w-[10%]',
  15: 'w-[15%]',
  20: 'w-[20%]',
  25: 'w-[25%]',
  30: 'w-[30%]',
  35: 'w-[35%]',
  40: 'w-[40%]',
  45: 'w-[45%]',
  50: 'w-1/2',
  55: 'w-[55%]',
  60: 'w-[60%]',
  65: 'w-[65%]',
  70: 'w-[70%]',
  75: 'w-[75%]',
  80: 'w-4/5',
  85: 'w-[85%]',
  90: 'w-[90%]',
  95: 'w-[95%]',
  100: 'w-full'
};

const getProgressWidthClass = (value: number) => {
  const clamped = Math.max(0, Math.min(100, value));
  const bucket = Math.round(clamped / 5) * 5;
  return PROGRESS_WIDTH_CLASSES[bucket] || 'w-full';
};

const ROADMAP_PROGRESS_KEY = 'roadmap_progress_v1';

const loadProgress = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(ROADMAP_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
};

const saveProgress = (progress: Record<string, string[]>) => {
  try {
    localStorage.setItem(ROADMAP_PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    // Silent fail
  }
};

interface CollectionMovie {
  tmdbId: number;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
}

interface Collection {
  id: string;
  title: string;
  description: string;
  movies: CollectionMovie[];
}

const RoadmapPage: React.FC = () => {
  const [userRequest, setUserRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [progress, setProgress] = useState<Record<string, string[]>>(() => loadProgress());
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const fetchCollections = async () => {
      setLoadingCollections(true);
      try {
        const response = await api.get('/api/collections');
        setCollections(response.data?.collections || []);
      } catch (error) {
        // Silent fail
      } finally {
        setLoadingCollections(false);
      }
    };
    fetchCollections();
  }, []);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!selectedSlug) return;
      setLoadingDetail(true);
      try {
        const response = await api.get(`/api/roadmaps/${selectedSlug}`);
        setSelectedRoadmap(response.data?.roadmap || null);
      } catch (error) {
        // Silent fail
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedSlug]);

  useEffect(() => {
    if (inputRef.current && !selectedRoadmap) {
      inputRef.current.focus();
    }
  }, [selectedRoadmap]);

  const handleGenerateRoadmap = useCallback(async () => {
    if (!userRequest.trim()) {
      showToast('Please tell us what you want to watch!', 'error');
      return;
    }

    if (!user) {
      showToast('Please log in to generate a personalized roadmap.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/api/roadmaps/generate', {
        userRequest: userRequest.trim()
      });

      if (response.data.success && response.data.roadmap) {
        setSelectedRoadmap(response.data.roadmap);
        setSelectedSlug(null); // Clear any existing roadmap selection
        showToast('Roadmap generated successfully!', 'success');
      } else {
        const errorMsg = response.data.message || response.data.error || 'Failed to generate roadmap.';
        showToast(errorMsg, 'error');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to generate roadmap. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setGenerating(false);
    }
  }, [userRequest, user, showToast]);

  const selectedProgress = useMemo(() => {
    if (!selectedRoadmap) return 0;
    const completedSteps = progress[selectedRoadmap.slug]?.length || 0;
    return Math.round((completedSteps / selectedRoadmap.stepCount) * 100);
  }, [progress, selectedRoadmap]);

  const handleStartOver = () => {
    setSelectedRoadmap(null);
    setSelectedSlug(null);
    setUserRequest('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };



  const toggleStepCompletion = (slug: string, stepId: string) => {
    setProgress((prev) => {
      const existing = prev[slug] || [];
      const nextSteps = existing.includes(stepId)
        ? existing.filter((id) => id !== stepId)
        : [...existing, stepId];
      const next = { ...prev, [slug]: nextSteps };
      saveProgress(next);
      return next;
    });
  };

  const handleNavigateToMovie = useCallback(
    (tmdbId?: number, contentType?: 'movie' | 'tvshow') => {
      if (!tmdbId) {
        showToast('We could not find a detail page for this title yet.', 'error');
        return;
      }
      if (contentType === 'tvshow') {
        navigate(`/tvshow/${tmdbId}`);
      } else {
        navigate(`/movie/${tmdbId}`);
      }
    },
    [navigate, showToast]
  );

  const renderChatInterface = () => (
    <div className="space-y-6">
      <div className="bg-black/40 border border-white/10 rounded-none p-8 md:p-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-full">
            <Bot className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">What do you want to watch?</h2>
            <p className="text-gray-400 text-sm mt-1">
              Tell me your mood, genre, or theme, and I'll create a personalized watch roadmap for you.
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              ref={inputRef}
              className="bg-gray-900 border border-gray-800 text-white placeholder-gray-600 h-10 text-base rounded-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all duration-200"
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerateRoadmap();
                }
              }}
              placeholder="e.g., 'I want to watch mind-bending sci-fi movies' or 'Show me feel-good comedies'"
              disabled={generating}
            />
            <Button
              onClick={handleGenerateRoadmap}
              disabled={generating || !userRequest.trim()}
              className="bg-red-600 hover:bg-red-700 text-white rounded-none px-8"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
          
          {!user && (
            <p className="text-sm text-yellow-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Please log in to generate personalized roadmaps.
            </p>
          )}
        </div>
      </div>

      {/* Collections Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-white/10" />
          <p className="text-sm uppercase tracking-[0.3em] text-gray-400 px-4">Collection</p>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {loadingCollections ? (
          <div className="py-10 flex justify-center">
            <LoadingSpinner text="Loading collections..." />
          </div>
        ) : collections.length > 0 ? (
          <div className="space-y-12">
            {collections.map((collection) => (
              <div key={collection.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{collection.title}</h3>
                    <p className="text-gray-400 text-sm">{collection.description}</p>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
                    {collection.movies.map((movie) => {
                      const posterUrl = movie.posterPath
                        ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
                        : null;
                      
                      return (
                        <div
                          key={movie.tmdbId}
                          onClick={() => navigate(moviePath({ _id: String(movie.tmdbId), title: movie.title }))}
                          className="group flex-shrink-0 w-48 cursor-pointer transform transition-all duration-300 hover:scale-105"
                        >
                          <div className="relative aspect-[2/3] bg-gray-800 rounded overflow-hidden border border-white/10 group-hover:border-red-500/50 transition-colors">
                            {posterUrl ? (
                              <img
                                src={posterUrl}
                                alt={movie.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="h-12 w-12 text-gray-600" />
                              </div>
                            )}
                            
                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h4 className="text-white font-semibold text-sm mb-1 line-clamp-2">
                                  {movie.title}
                                </h4>
                                {movie.releaseDate && (
                                  <p className="text-gray-300 text-xs">
                                    {new Date(movie.releaseDate).getFullYear()}
                                  </p>
                                )}
                                {movie.voteAverage && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                    <span className="text-xs text-white">{movie.voteAverage.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-gray-400">
            <p>No collections available at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderHero = () => {
    if (!selectedRoadmap) return null;
    
    return (
      <div className="relative min-h-[320px] overflow-hidden border border-white/10 rounded-none bg-black">
        <div className="absolute inset-0">
          {selectedRoadmap.heroImage && selectedRoadmap.heroImage !== 'https://image.tmdb.org/t/p/original/placeholder.jpg' && (
            <img
              src={selectedRoadmap.heroImage}
              alt={selectedRoadmap.title}
              className="w-full h-full object-cover opacity-40"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        </div>
        <div className="relative z-10 p-6 md:p-10 flex flex-col gap-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-gray-300">
              <Compass className="h-4 w-4 text-red-400" />
              AI Generated Roadmap
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartOver}
              className="text-gray-400 hover:text-white rounded-none"
            >
              Start Over
            </Button>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white">{selectedRoadmap.title}</h1>
          <p className="text-gray-300 text-lg">{selectedRoadmap.description}</p>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-gray-300">
            <span className="bg-white/10 px-3 py-1 border border-white/20">
              {selectedRoadmap.difficulty}
            </span>
            <span className="bg-white/10 px-3 py-1 border border-white/20 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              {selectedRoadmap.estimatedDuration}
            </span>
            <span className="bg-white/10 px-3 py-1 border border-white/20">
              {selectedRoadmap.stepCount} steps
            </span>
          </div>
          <div className="flex flex-col gap-2 text-gray-300 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              Curated by {selectedRoadmap.curatedBy}
            </div>
            <div className="flex items-center gap-2">
              <Map className="h-4 w-4 text-blue-300" />
              Progress · {selectedProgress}%
              <div className="flex-1 h-1 bg-white/10 ml-4">
                <div
                  className={`h-1 bg-gradient-to-r from-red-500 to-yellow-300 transition-all duration-300 ${getProgressWidthClass(
                    selectedProgress
                  )}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSteps = () => {
    if (loadingDetail) {
      return (
        <div className="py-10 flex justify-center">
          <LoadingSpinner text="Loading roadmap..." />
        </div>
      );
    }
    
    if (!selectedRoadmap) {
      return null;
    }
    const completed = progress[selectedRoadmap.slug] || [];
    return (
      <div className="space-y-4">
        {selectedRoadmap.steps.map((step, index) => {
          const isDone = completed.includes(step.id);
          const posterUrl = step.posterPath
            ? `https://image.tmdb.org/t/p/w500${step.posterPath}`
            : null;
          
          return (
            <div
              key={step.id}
              className="flex flex-col md:flex-row gap-4 p-4 border border-white/10 rounded-none bg-black/70 hover:border-white/30 transition"
            >
              {/* Poster Image */}
              {posterUrl && (
                <div className="w-full md:w-32 lg:w-40 flex-shrink-0">
                  <div className="aspect-[2/3] bg-gray-800 rounded overflow-hidden border border-white/10">
                    <img
                      src={posterUrl}
                      alt={step.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border font-semibold shrink-0 ${
                      isDone ? 'bg-green-500/20 border-green-400 text-green-200' : 'border-white/20 text-white'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-xl font-bold text-white">{step.title}</h4>
                      {step.runtimeMinutes && (
                        <span className="text-xs uppercase tracking-[0.3em] text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {step.runtimeMinutes} min
                        </span>
                      )}
                      {isDone && (
                        <span className="text-xs uppercase tracking-[0.3em] text-green-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          completed
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm">{step.summary}</p>
                  </div>
                </div>
                
                <div className="bg-white/5 p-3 border border-white/5 text-sm text-gray-200">
                  <p className="uppercase text-xs tracking-[0.4em] text-gray-400 mb-1">Why this step</p>
                  <p>{step.whyWatch}</p>
                  <p className="text-gray-400 mt-2 text-xs">{step.connection}</p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    className="rounded-none bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleNavigateToMovie(step.tmdbId, step.contentType)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant={isDone ? 'secondary' : 'ghost'}
                    className={`rounded-none ${
                      isDone ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-white/20 text-white'
                    }`}
                    onClick={() => toggleStepCompletion(selectedRoadmap.slug, step.id)}
                  >
                    {isDone ? 'Mark as Pending' : 'Mark as Done'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {selectedRoadmap.resources?.length ? (
          <div className="border border-white/10 rounded-none p-4 space-y-3 bg-black/40">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-300" />
              Bonus Resources
            </p>
            <ul className="space-y-2 text-sm text-gray-200">
              {selectedRoadmap.resources.map((resource) => (
                <li key={resource.url}>
                  <a href={resource.url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-red-200 underline">
                    {resource.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pt-24 pb-16 px-4 md:px-8 space-y-10">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.5em] text-gray-400 flex items-center gap-2">
            <Map className="h-4 w-4 text-red-400" />
            Roadmaps
          </p>
          <h1 className="text-4xl font-bold">Create your personalized watch journey</h1>
          <p className="text-gray-400 max-w-3xl">
            Tell us what you're in the mood for, and our AI will curate a personalized roadmap of movies and TV shows just for you.
          </p>
        </div>

        {!selectedRoadmap ? (
          renderChatInterface()
        ) : (
          <>
            {renderHero()}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold uppercase tracking-[0.4em]">Steps</h2>
                <div className="w-12 h-0.5 bg-red-600" />
              </div>
              {renderSteps()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoadmapPage;

