import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import {
  Sparkles,
  Shield,
  Activity,
  RefreshCw,
  Save,
  RotateCcw,
  Sliders,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Star,
  CheckCircle,
  FileText
} from 'lucide-react';
import AdminEmptyState from './AdminEmptyState';

interface ToggleConfig {
  recommendations: boolean;
  conversations: boolean;
  autoCuration: boolean;
  watchPartyPrompts: boolean;
}

interface PromptConfig {
  recommendation: string;
  assistant: string;
  summary: string;
}

interface GuardrailConfig {
  allowMatureContent: boolean;
  fallbackMessage: string;
  maxTokens: number;
  blockedGenres: string[];
}

interface AiConfig {
  toggles: ToggleConfig;
  prompts: PromptConfig;
  guardrails: GuardrailConfig;
  lastModifiedAt?: string;
  lastModifiedBy?: {
    _id: string;
    username?: string;
    email?: string;
  } | null;
}

interface AiFeedbackItem {
  _id: string;
  type: string;
  context?: string;
  rating?: number;
  helpful?: boolean;
  comment?: string;
  createdAt: string;
  user?: {
    _id: string;
    username?: string;
    email?: string;
  } | null;
}

interface AiFeedbackSummary {
  total: number;
  helpful: number;
  notHelpful: number;
  averageRating: number;
}

interface AiAuditLog {
  _id: string;
  action: string;
  details?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  createdAt: string;
  admin?: {
    _id: string;
    username?: string;
    email?: string;
  } | null;
}

const AIControlPanel: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [formState, setFormState] = useState<AiConfig | null>(null);
  const [blockedGenresDraft, setBlockedGenresDraft] = useState('');

  const [feedbackSummary, setFeedbackSummary] = useState<AiFeedbackSummary>({
    total: 0,
    helpful: 0,
    notHelpful: 0,
    averageRating: 0
  });
  const [feedbackItems, setFeedbackItems] = useState<AiFeedbackItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AiAuditLog[]>([]);

  const hasUnsavedChanges = useMemo(() => {
    if (!config || !formState) return false;
    return JSON.stringify(config) !== JSON.stringify(formState);
  }, [config, formState]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configResponse, feedbackResponse, auditResponse] = await Promise.all([
        api.get('/api/admin/ai/config'),
        api.get('/api/admin/ai/feedback'),
        api.get('/api/admin/ai/audit?limit=12')
      ]);

      const configData: AiConfig = configResponse.data?.data;
      setConfig(configData);
      setFormState(configData);
      setBlockedGenresDraft(
        (configData.guardrails?.blockedGenres || []).join(', ')
      );

      const feedbackData = feedbackResponse.data?.data;
      if (feedbackData) {
        setFeedbackSummary(feedbackData.summary || feedbackSummary);
        setFeedbackItems(feedbackData.items || []);
      }

      const auditData = auditResponse.data?.data;
      if (auditData) {
        setAuditLogs(auditData.logs || []);
      }
    } catch (error) {
      showToast('Failed to load AI control telemetry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateToggle = (key: keyof ToggleConfig, value: boolean) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            toggles: {
              ...prev.toggles,
              [key]: value
            }
          }
        : prev
    );
  };

  const updatePrompt = (key: keyof PromptConfig, value: string) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            prompts: {
              ...prev.prompts,
              [key]: value
            }
          }
        : prev
    );
  };

  const updateGuardrail = (key: keyof GuardrailConfig, value: string | number | boolean | string[]) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            guardrails: {
              ...prev.guardrails,
              [key]: value
            }
          }
        : prev
    );
  };

  const handleReset = () => {
    if (!config) return;
    setFormState(config);
    setBlockedGenresDraft((config.guardrails?.blockedGenres || []).join(', '));
    showToast('Changes reverted to saved state', 'info');
  };

  const handleSave = async () => {
    if (!formState) return;
    setSaving(true);
    try {
      const blockedGenres = blockedGenresDraft
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean);

      const payload: AiConfig = {
        ...formState,
        guardrails: {
          ...formState.guardrails,
          blockedGenres
        }
      };

      const response = await api.put('/api/admin/ai/config', payload);
      const updatedConfig: AiConfig = response.data?.data;
      setConfig(updatedConfig);
      setFormState(updatedConfig);
      setBlockedGenresDraft(
        (updatedConfig.guardrails?.blockedGenres || []).join(', ')
      );

      showToast('AI Platform configuration committed', 'success');
      const auditResponse = await api.get('/api/admin/ai/audit?limit=12');
      if (auditResponse.data?.data?.logs) {
        setAuditLogs(auditResponse.data.data.logs);
      }
    } catch (error) {
      showToast('Failed to update AI configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner fullScreen color="blue" size="xl" text="Initializing Gemini control surface..." />
    );
  }

  if (!formState) {
    return (
      <div className="sys-flush-stack space-y-4">
        <AdminEmptyState
          icon={Sparkles}
          title="AI Subsystem Unreachable"
          description="Could not negotiate session with the generative assistant backend"
        />
      </div>
    );
  }

  return (
    <div className="sys-flush-stack space-y-4">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Recommendations</span>
            <Sparkles className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`status-led led-${formState.toggles.recommendations ? 'cyan' : 'amber'}`} />
            <span className="text-sm font-bold font-mono text-zinc-100 uppercase">
              {formState.toggles.recommendations ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-1">discovery personalization</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Auto Curation</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`status-led led-${formState.toggles.autoCuration ? 'green' : 'amber'}`} />
            <span className="text-sm font-bold font-mono text-zinc-100 uppercase">
              {formState.toggles.autoCuration ? 'Online' : 'Halted'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-1">background featured rails</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Assistant Concierge</span>
            <MessageSquare className="w-3.5 h-3.5 text-[var(--sys-magenta)]" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`status-led led-${formState.toggles.conversations ? 'cyan' : 'amber'}`} />
            <span className="text-sm font-bold font-mono text-zinc-100 uppercase">
              {formState.toggles.conversations ? 'Active' : 'Offline'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-1">conversational support</div>
        </div>

        <div className="ctrl-panel p-3">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] uppercase tracking-wider mb-1">
            <span>Safety Guardrail</span>
            <Shield className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`status-led led-${!formState.guardrails.allowMatureContent ? 'green' : 'amber'}`} />
            <span className="text-sm font-bold font-mono text-zinc-100 uppercase">
              {formState.guardrails.allowMatureContent ? 'Permissive' : 'Strict PG'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-1">content policy filter</div>
        </div>
      </div>

      {/* Control Actions Strip */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Gemini Assistant Control Surface</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={!hasUnsavedChanges || saving}
              className="sys-btn"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Discard Changes</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              className="sys-btn sys-btn-primary"
            >
              <Save className={`w-3.5 h-3.5 mr-1.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Writing...' : 'Commit Configuration'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Toggles Panel */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">Model Capability Toggles</span>
          </div>
        </div>

        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                key: 'recommendations' as const,
                title: 'Personalized Recommender Engine',
                description: 'Use Gemini vectors to personalize discovery carousels and tailored rails.'
              },
              {
                key: 'conversations' as const,
                title: 'Conversational Concierge',
                description: 'Enable members to converse directly with Gemini for movie queries.'
              },
              {
                key: 'autoCuration' as const,
                title: 'Automated Catalog Curation',
                description: 'Background worker dynamically categorizes top media sets.'
              }
            ].map(({ key, title, description }) => (
              <div
                key={key}
                className="flex items-start justify-between p-3.5 bg-zinc-950 border border-zinc-900"
              >
                <div className="pr-3">
                  <div className="text-xs font-semibold text-zinc-100">{title}</div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
                </div>
                <label className="sys-switch shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={formState.toggles[key]}
                    onChange={(e) => updateToggle(key, e.target.checked)}
                  />
                  <span className="sys-slider" />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt Templates */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[var(--sys-cyan)]" />
            <span className="ctrl-panel-title">System Prompt Directives</span>
          </div>
        </div>

        <div className="ctrl-panel-body">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="sys-label">Recommendation Directive</label>
              <textarea
                value={formState.prompts.recommendation}
                onChange={(e) => updatePrompt('recommendation', e.target.value)}
                className="sys-input font-mono text-xs h-36 resize-y"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Directs persona and heuristics for movie suggestion generation
              </span>
            </div>

            <div>
              <label className="sys-label">Chat Concierge Directive</label>
              <textarea
                value={formState.prompts.assistant}
                onChange={(e) => updatePrompt('assistant', e.target.value)}
                className="sys-input font-mono text-xs h-36 resize-y"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Controls tone, guardrails, and conversation etiquette
              </span>
            </div>

            <div>
              <label className="sys-label">Synopsis & Summary Directive</label>
              <textarea
                value={formState.prompts.summary}
                onChange={(e) => updatePrompt('summary', e.target.value)}
                className="sys-input font-mono text-xs h-36 resize-y"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Enforces spoiler-free synopsis abstraction guidelines
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Guardrails */}
      <div className="ctrl-panel">
        <div className="ctrl-panel-header">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="ctrl-panel-title">Safety & Token Output Limits</span>
          </div>
        </div>

        <div className="ctrl-panel-body space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900">
              <div>
                <div className="text-xs font-semibold text-zinc-100">Permit Mature Content</div>
                <div className="text-[11px] text-zinc-500">Allow R-rated or mature suggestions in generative output</div>
              </div>
              <label className="sys-switch shrink-0">
                <input
                  type="checkbox"
                  checked={formState.guardrails.allowMatureContent}
                  onChange={(e) => updateGuardrail('allowMatureContent', e.target.checked)}
                />
                <span className="sys-slider" />
              </label>
            </div>

            <div>
              <label className="sys-label">Max Token Ceiling (128 - 4096)</label>
              <input
                type="number"
                min={128}
                max={4096}
                value={formState.guardrails.maxTokens}
                onChange={(e) => updateGuardrail('maxTokens', Number(e.target.value) || 0)}
                className="sys-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="sys-label">Blocked Genres (comma separated)</label>
              <input
                type="text"
                value={blockedGenresDraft}
                onChange={(e) => setBlockedGenresDraft(e.target.value)}
                placeholder="e.g. Horror, Explicit, Violence"
                className="sys-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="sys-label">Fallback Safety Message</label>
              <input
                type="text"
                value={formState.guardrails.fallbackMessage}
                onChange={(e) => updateGuardrail('fallbackMessage', e.target.value)}
                className="sys-input font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Feedback Pulse */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-[var(--sys-amber)]" />
              <span className="ctrl-panel-title">Member Sentiment Pulse</span>
            </div>
            <span className="sys-badge font-mono text-[10px]">
              {feedbackSummary.total} ratings
            </span>
          </div>

          <div className="ctrl-panel-body space-y-3">
            <div className="grid grid-cols-3 gap-2 font-mono text-center">
              <div className="p-2 bg-zinc-950 border border-zinc-900">
                <span className="text-[10px] text-zinc-500 uppercase block">Helpful</span>
                <span className="text-base font-bold text-emerald-400">{feedbackSummary.helpful}</span>
              </div>
              <div className="p-2 bg-zinc-950 border border-zinc-900">
                <span className="text-[10px] text-zinc-500 uppercase block">Not Helpful</span>
                <span className="text-base font-bold text-red-400">{feedbackSummary.notHelpful}</span>
              </div>
              <div className="p-2 bg-zinc-950 border border-zinc-900">
                <span className="text-[10px] text-zinc-500 uppercase block">Mean Score</span>
                <span className="text-base font-bold text-[var(--sys-amber)]">{feedbackSummary.averageRating.toFixed(1)}/5</span>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {feedbackItems.length === 0 ? (
                <AdminEmptyState
                  icon={Star}
                  title="No Feedback Logged"
                  description="No user feedback signals collected yet"
                />
              ) : (
                feedbackItems.map((item) => (
                  <div key={item._id} className="p-2.5 bg-zinc-950 border border-zinc-900 text-xs font-mono">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="uppercase">{item.type}</span>
                      <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-zinc-200 mt-1">{item.comment || 'No textual comment provided'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="ctrl-panel">
          <div className="ctrl-panel-header">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="ctrl-panel-title">AI Engine Audit Trail</span>
            </div>
            <span className="sys-badge font-mono text-[10px]">
              {auditLogs.length} events
            </span>
          </div>

          <div className="ctrl-panel-body p-0">
            {auditLogs.length === 0 ? (
              <AdminEmptyState
                icon={Shield}
                title="No Configuration Audits"
                description="No modifications to AI engine parameters have been logged"
              />
            ) : (
              <div className="divide-y divide-zinc-900 max-h-72 overflow-y-auto font-mono text-xs">
                {auditLogs.map((log) => (
                  <div key={log._id} className="p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={log.success ? 'text-emerald-400 uppercase font-bold' : 'text-red-400 uppercase font-bold'}>
                        {log.action}
                      </span>
                      <span className="text-zinc-500">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.details && <div className="text-zinc-300">{log.details}</div>}
                    <div className="text-[10px] text-zinc-500">
                      Actor: {log.admin?.username || log.admin?.email || 'System'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIControlPanel;
