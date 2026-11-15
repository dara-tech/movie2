import React, { useCallback, useState } from 'react';
import { X, Send, Sparkles, Loader2, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { requestAssistantResponse } from '../services/ai';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { moviePath, tvShowPath } from '../utils/paths';

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'movies';
  movies?: SuggestedMovie[];
  query?: string;
};

interface SuggestedMovie {
  id: string;
  title: string;
  posterPath?: string;
  releaseDate?: string;
  overview?: string;
  voteAverage?: number;
  mediaType?: 'movie' | 'tv';
}

const INITIAL_PROMPT =
  "Hey! I’m your MovieStream buddy. Tell me what you’re in the mood to watch and I’ll drum up a few ideas.";

const createMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeMovieCardQuery = (rawQuery: string) => {
  let working = rawQuery.trim();
  if (!working) return null;

  const newlineIndex = working.indexOf('\n');
  if (newlineIndex >= 0) {
    working = working.slice(0, newlineIndex).trim();
  }

  const quoted = working.match(/"([^"]+)"/);
  if (quoted?.[1]) {
    working = quoted[1].trim();
  }

  const allowedLowercase = new Set(['of', 'the', 'and', 'in', 'on', 'at', 'for', 'with', 'to', 'from', 'by', 'a', 'an']);
  const words = working.split(/\s+/);
  const selected: string[] = [];

  for (const word of words) {
    const cleanedWord = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    if (!cleanedWord) continue;

    const isUpper = cleanedWord[0] === cleanedWord[0].toUpperCase();
    if (!isUpper && !allowedLowercase.has(cleanedWord.toLowerCase())) {
      break;
    }

    selected.push(cleanedWord);
  }

  const sanitized = selected.join(' ').trim();
  const result = sanitized.length >= 3 ? sanitized : working;

  return result.length >= 3 ? result.slice(0, 80) : null;
};

const extractMovieCardQuery = (text: string) => {
  const pattern = /^@MovieCard\s*:\s*(.+)$/im;
  const match = text.match(pattern);
  if (!match) {
    return { cleaned: text.trim(), query: null as string | null };
  }
  const query = sanitizeMovieCardQuery(match[1]);
  const cleaned = text.replace(pattern, '').replace(/\n{2,}/g, '\n').trim();
  return {
    cleaned: cleaned || INITIAL_PROMPT,
    query,
  };
};

const buildPosterUrl = (posterPath?: string) => {
  if (!posterPath) return '/placeholder-movie.jpg';
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/w342${posterPath}`;
};

const AIChatAssistant: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: createMessageId(), role: 'model', content: INITIAL_PROMPT, type: 'text' },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const trimmedContent = input.trim();
    if (!trimmedContent) return;

    const nextMessages = [
      ...messages,
      { id: createMessageId(), role: 'user', content: trimmedContent, type: 'text' } as ChatMessage,
    ];

    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setDisabledReason(null);

    try {
      const assistantRequestMessages = nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      assistantRequestMessages.push({
        role: 'user',
        content:
          'Reply like a friendly human movie fan. Keep things upbeat, short, and conversational. When you recommend a movie or TV show, add a line in the format "@MovieCard: Title". Use plain text elsewhere—no lists unless asked.',
      });

      const response = await requestAssistantResponse({
        messages: assistantRequestMessages,
        conversationId,
      });

      if (!response.enabled) {
        const reason =
          response.reason || 'Gemini assistant is currently disabled.';
        setDisabledReason(reason);
        setMessages([
          ...nextMessages,
          {
            id: createMessageId(),
            role: 'model',
            type: 'text',
            content:
              reason === 'conversations_disabled'
                ? 'The AI assistant has been disabled by an administrator.'
                : 'The assistant is unavailable at the moment. Please try again later.',
          },
        ]);
        if (response.conversationId) {
          setConversationId(response.conversationId);
        }
        return;
      }

      const rawReply =
        response.response?.trim() ||
        'I could not generate a response right now. Please try again.';

      const { cleaned, query } = extractMovieCardQuery(rawReply);

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'model',
        content: cleaned,
        type: 'text',
      };

      const baseMessages = [...nextMessages, assistantMessage];
      setMessages(baseMessages);

      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      if (query) {
        queueMovieSuggestions(query);
      }
    } catch (error) {
      showToast('Failed to contact AI assistant. Please try again later.', 'error');
      setMessages([
        ...nextMessages,
        {
          id: createMessageId(),
          role: 'model',
          type: 'text',
          content: 'I ran into a connection problem. Please try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const findMovieSuggestions = useCallback(
    async (query: string): Promise<SuggestedMovie[]> => {
      const normalizedQuery = query.trim();
      if (normalizedQuery.length < 3) {
        return [];
      }

      try {
        const response = await api.get('/api/search', {
          params: { q: normalizedQuery },
        });
        const movies = Array.isArray(response.data?.movies)
          ? response.data.movies
              .filter((item: any) => item && (item.title || item.name))
              .map((item: any) => ({
                id: item._id || `tmdb_${item.tmdbId || item.id}`,
                title: item.title || item.name,
                posterPath: item.posterPath,
                releaseDate: item.releaseDate || item.firstAirDate,
                overview: item.overview,
                voteAverage: item.voteAverage,
                mediaType: 'movie' as const,
              }))
          : [];

        const tvShows = Array.isArray(response.data?.tvShows)
          ? response.data.tvShows
              .filter((item: any) => item && (item.name || item.title))
              .map((item: any) => ({
                id: item._id || `tmdb_${item.tmdbId || item.id}`,
                title: item.name || item.title,
                posterPath: item.posterPath,
                releaseDate: item.firstAirDate || item.releaseDate,
                overview: item.overview,
                voteAverage: item.voteAverage,
                mediaType: 'tv' as const,
              }))
          : [];

        const combined = [...movies, ...tvShows];
        if (combined.length > 0) {
          return combined.slice(0, 3);
        }
      } catch (error) {
      }

      try {
        const fallbackResponse = await api.get('/api/movies/recommendations', {
          params: { limit: 3 },
        });
        const fallbackMovies = fallbackResponse.data?.movies || [];
        return fallbackMovies
          .filter((item: any) => item && item.title)
          .slice(0, 3)
          .map((item: any) => ({
            id: item._id || `tmdb_${item.tmdbId || item.id}`,
            title: item.title,
            posterPath: item.posterPath,
            releaseDate: item.releaseDate,
            overview: item.overview,
            voteAverage: item.voteAverage,
            mediaType: 'movie' as const,
          }));
      } catch (error) {
      }

      return [];
    },
    [],
  );

  const queueMovieSuggestions = useCallback(
    async (query: string) => {
      const movies = await findMovieSuggestions(query);
      if (!movies.length) {
        return;
      }

      const summary = `Gemini suggestions for "${query}"`;

      const movieMessage: ChatMessage = {
        id: createMessageId(),
        role: 'model',
        content: summary,
        type: 'movies',
        movies,
        query,
      };

      setMessages((prev) => [...prev, movieMessage]);
    },
    [findMovieSuggestions],
  );

  const openSuggestion = useCallback(
    (suggested: SuggestedMovie) => {
      if (!suggested) return;

      const trimmedTitle = suggested.title?.trim();
      if (suggested.mediaType === 'tv') {
        if (suggested.id) {
          navigate(tvShowPath({ _id: String(suggested.id), name: suggested.title }));
        } else if (trimmedTitle) {
          navigate(`/tvshows?search=${encodeURIComponent(trimmedTitle)}`);
        }
        return;
      }

      if (suggested.id) {
        navigate(moviePath({ _id: String(suggested.id), title: suggested.title }));
      } else if (trimmedTitle) {
        navigate(`/movies?search=${encodeURIComponent(trimmedTitle)}`);
      }
    },
    [navigate],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-[20rem] sm:w-[24rem] bg-gray-950/95 border border-white/10 rounded-none shadow-2xl backdrop-blur-md flex flex-col overflow-hidden mb-3">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-white">
              <Sparkles className="h-5 w-5 text-yellow-300" />
              <div>
                <p className="text-base font-semibold">
                  MovieStream Buddy
                </p>
                <p className="text-xs text-gray-400">
                  Friendly recs. Zero spoilers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {conversationId && (
                <Button
                  type="button"
                  variant="default"
                  className="border-gray-600 text-gray-200 hover:bg-gray-900 rounded-none h-8 px-3 text-xs tracking-wide"
                  onClick={() => {
                    setConversationId(null);
                    setMessages([
                      { id: createMessageId(), role: 'model', content: INITIAL_PROMPT, type: 'text' },
                    ]);
                    setInput('');
                    setDisabledReason(null);
                  }}
                  disabled={loading}
                >
                  Start Fresh
                </Button>
              )}
              <button
                type="button"
                onClick={handleToggle}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 max-h-80 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((message) => {
              if (message.type === 'movies' && message.movies?.length) {
                return (
                  <div key={message.id} className="flex flex-col gap-2">
                    <div className="bg-gray-900/70 text-gray-100 border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.35em]">
                      {message.content}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {message.movies.map((movie) => (
                        <AssistantMovieSuggestion
                          key={movie.id}
                          movie={movie}
                          onOpen={() => openSuggestion(movie)}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`rounded-none px-3 py-2 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                        : 'bg-gray-800/70 text-gray-100 border border-white/5'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center gap-2 text-gray-300 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Give me a moment to pull something up…
              </div>
            )}
            {disabledReason && (
              <div className="text-xs text-yellow-300/90 bg-yellow-500/10 border border-yellow-500/30 rounded-none px-3 py-2">
                {disabledReason === 'conversations_disabled'
                  ? 'Looks like the assistant was paused by an admin. Ping them if you need it back!'
                  : disabledReason}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/40 px-4 py-3 space-y-2">
            <Textarea
              placeholder="Tell me what you feel like watching..."
              className="bg-gray-900/80 hover:border-none border-white/10 text-sm text-gray-100 min-h-[3rem] resize-none rounded-none"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="flex items-center justify-between text-[11px] tracking-wide text-gray-500">
              <span>
                {loading ? 'Let me think for a sec…' : 'Enter to send · Shift+Enter for a new line'}
              </span>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white h-8 px-3 rounded-none"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-center bg-gradient-to-br from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 text-white h-12 w-12 rounded-full shadow-[0_15px_35px_rgba(239,68,68,0.45)] transition-transform duration-200 hover:scale-110 border border-white/10"
        aria-label={isOpen ? 'Hide assistant' : 'Open assistant'}
      >
        <Bot className="h-6 w-6" />
      </button>
    </div>
  );
};

const AssistantMovieSuggestion: React.FC<{
  movie: SuggestedMovie;
  onOpen: () => void;
}> = ({ movie, onOpen }) => {
  const posterUrl = buildPosterUrl(movie.posterPath);
  const releaseYear = movie.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full gap-3 rounded-[6px] border border-white/10 bg-black/65 p-2.5 text-left transition hover:border-red-500/40 hover:bg-black/75 focus:outline-none focus-visible:border-red-500/60"
    >
      <div className="relative h-20 w-14 overflow-hidden rounded-[4px]">
        <img
          src={posterUrl}
          alt={movie.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = '/placeholder-movie.jpg';
          }}
        />
      </div>
      <div className="flex flex-1 flex-col justify-between">
        <div className="space-y-1">
          <h3 className="text-[11px] font-semibold uppercase leading-4 tracking-[0.3em] text-white line-clamp-2">
            {movie.title}
          </h3>
          <p className="text-[10px] uppercase tracking-[0.35em] text-gray-400">
            {releaseYear ? `${releaseYear}` : 'Coming Soon'}
            {typeof movie.voteAverage === 'number' && movie.voteAverage > 0
              ? ` · ${movie.voteAverage.toFixed(1)}`
              : ''}
          </p>
        </div>
        {movie.overview && (
          <p className="text-[10px] text-gray-400/90 line-clamp-3 leading-4">
            {movie.overview}
          </p>
        )}
        <span className="mt-2 text-[10px] font-medium uppercase tracking-[0.4em] text-red-400">
          View Details →
        </span>
      </div>
    </button>
  );
};

export default AIChatAssistant;

