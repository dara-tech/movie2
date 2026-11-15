import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Loader2, User, MessageSquare, Trash2, Clock, Sparkles } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import AdminPagination from './AdminPagination';
import AdminEmptyState from './AdminEmptyState';

interface ConversationUser {
  _id: string;
  username?: string;
  email?: string;
}

interface ConversationSummary {
  _id: string;
  title: string;
  user: ConversationUser;
  updatedAt: string;
  createdAt: string;
  lastMessageAt?: string;
  messageCount: number;
  metadata?: Record<string, unknown>;
  scheduledForDeletionAt?: string | null;
}

interface ConversationDetails extends ConversationSummary {
  messages: Array<{
    role: 'user' | 'model';
    content: string;
    model?: string | null;
    timingMs?: number | null;
    createdAt: string;
  }>;
}

interface Pagination {
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

const PAGE_LIMIT = 12;

const formatDate = (value?: string | Date) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
};

const resolveUserLabel = (user?: ConversationUser) => {
  if (!user) return 'Unknown user';
  return user.username || user.email || user._id;
};

const AIConversations: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetails | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const selectedCount = selectedConversationIds.length;
  const allConversationsSelected = useMemo(
    () => conversations.length > 0 && selectedConversationIds.length === conversations.length,
    [conversations, selectedConversationIds],
  );

  const fetchConversations = useCallback(async (page = 1, term = search) => {
    setLoadingList(true);
    try {
      const response = await api.get('/api/admin/ai/conversations', {
        params: {
          page,
          limit: PAGE_LIMIT,
          search: term || undefined,
        },
      });

      const payload = response.data?.data;
      setConversations(payload?.conversations || []);
      setPagination(payload?.pagination || null);
      if (!payload?.conversations?.length) {
        setSelectedConversationId(null);
        setConversationDetail(null);
      }
    } catch (error) {
    } finally {
      setLoadingList(false);
    }
  }, [search]);

  const fetchConversationDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const response = await api.get(`/api/admin/ai/conversations/${id}`);
      setConversationDetail(response.data?.data || null);
    } catch (error) {
      setConversationDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchConversations(1, search);
  }, [fetchConversations, search]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    fetchConversationDetail(id);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const toggleSelectConversation = (id: string) => {
    setSelectedConversationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllConversations = () => {
    if (allConversationsSelected) {
      setSelectedConversationIds([]);
    } else {
      setSelectedConversationIds(conversations.map((item) => item._id));
    }
  };

  const handleBulkDelete = async (autoDelete = false) => {
    if (!selectedConversationIds.length) return;
    setActionLoading(true);
    try {
      await api.post('/api/admin/ai/conversations/bulk-delete', {
        ids: selectedConversationIds,
        autoDelete24h: autoDelete,
      });
      setSelectedConversationIds([]);
      fetchConversations(pagination?.currentPage || 1, search);
    } catch (error) {
    } finally {
      setActionLoading(false);
    }
  };

  const selectedConversation = useMemo(
    () => conversations.find((item) => item._id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Search & Actions Strip */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">AI Concierge Transcripts</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md ml-auto">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search transcript, topic, or user..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="sys-input font-mono pl-7 text-xs"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
            <button type="submit" className="sys-btn sys-btn-primary">
              Search
            </button>
            {search && (
              <button type="button" onClick={handleClearSearch} className="sys-btn">
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Main Grid: Conversation Feed & Detailed Message Transcript */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Left: Conversation List */}
        <div className="xl:col-span-2 ctrl-panel flex flex-col">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <span className="ctrl-panel-title">Session Feed</span>
            </div>
            {pagination && (
              <span className="sys-badge font-mono text-[10px]">
                {pagination.total} sessions
              </span>
            )}
          </div>

          {conversations.length > 0 && (
            <div className="p-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400">
                <input
                  type="checkbox"
                  onChange={handleSelectAllConversations}
                  checked={allConversationsSelected}
                  className="rounded-none bg-zinc-900 border-zinc-700"
                />
                <span>Select All</span>
              </label>

              {selectedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleBulkDelete(false)}
                    disabled={actionLoading}
                    className="sys-btn sys-btn-danger"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete ({selectedCount})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="ctrl-panel-body p-0 flex-1 overflow-y-auto max-h-[650px] divide-y divide-zinc-900">
            {loadingList ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner text="Ingesting transcripts..." color="blue" />
              </div>
            ) : conversations.length === 0 ? (
              <AdminEmptyState
                icon={MessageSquare}
                title="No Conversations"
                description="No member dialogues found matching the filter query"
              />
            ) : (
              conversations.map((conv) => {
                const isActive = conv._id === selectedConversationId;
                const isSelected = selectedConversationIds.includes(conv._id);
                return (
                  <div
                    key={conv._id}
                    onClick={() => handleSelectConversation(conv._id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isActive ? 'bg-[var(--sys-cyan)]/10 border-l-2 border-[var(--sys-cyan)]' : 'hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectConversation(conv._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-none bg-zinc-900 border-zinc-700 mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-xs text-zinc-100 truncate">
                            {conv.title || 'Untitled Dialogue'}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                            {conv.messageCount} msgs
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <User className="w-3 h-3 text-zinc-500" />
                          <span className="truncate">{resolveUserLabel(conv.user)}</span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-600 mt-1">
                          {formatDate(conv.lastMessageAt || conv.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="p-2 border-t border-zinc-800">
              <AdminPagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={(page: number) => fetchConversations(page, search)}
              />
            </div>
          )}
        </div>

        {/* Right: Message Transcript Detail */}
        <div className="xl:col-span-3 ctrl-panel flex flex-col">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
              <span className="ctrl-panel-title">
                {selectedConversation ? selectedConversation.title : 'Dialogue Detail'}
              </span>
            </div>
            {selectedConversation && (
              <span className="text-[10px] font-mono text-zinc-500">
                {formatDate(selectedConversation.createdAt)}
              </span>
            )}
          </div>

          <div className="ctrl-panel-body flex-1 overflow-y-auto max-h-[650px] p-4 space-y-3 bg-black">
            {!selectedConversationId ? (
              <AdminEmptyState
                icon={MessageSquare}
                title="Select a Session"
                description="Click any dialogue in the left feed to inspect complete multi-turn message turns"
              />
            ) : loadingDetail ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner text="Rendering prompt chain..." color="blue" />
              </div>
            ) : conversationDetail?.messages.length === 0 ? (
              <AdminEmptyState
                icon={MessageSquare}
                title="Empty Transcript"
                description="This conversation record does not contain any recorded message turns"
              />
            ) : (
              conversationDetail?.messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 text-xs leading-relaxed font-mono ${
                        isUser
                          ? 'bg-[var(--sys-cyan)]/15 border border-[var(--sys-cyan)]/40 text-zinc-100'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 gap-2">
                        <span className="font-bold uppercase tracking-wider">
                          {isUser ? 'User Member' : 'Gemini 2.5 Flash'}
                        </span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.model && (
                        <div className="mt-1.5 text-[9px] text-zinc-600">
                          Engine: {msg.model} {msg.timingMs ? `· ${msg.timingMs}ms` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConversations;
