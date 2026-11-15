import api from './api';

interface AssistantMessage {
  role: 'user' | 'model';
  content: string;
}

interface AssistantPayload {
  messages: AssistantMessage[];
  userProfile?: Record<string, unknown>;
  conversationId?: string | null;
}

export const requestAssistantResponse = async (payload: AssistantPayload) => {
  const response = await api.post('/api/ai/assistant', payload);
  return response.data as {
    enabled: boolean;
    response?: string;
    model?: string;
    timingMs?: number;
    fallback?: boolean;
    reason?: string;
    conversationId?: string;
  };
};

export const requestSummary = async (payload: {
  title: string;
  overview: string;
  cast?: Array<{ name: string; character?: string }>;
  tone?: string;
}) => {
  const response = await api.post('/api/ai/summary', payload);
  return response.data as {
    success: boolean;
    summary: string;
    model?: string;
    timingMs?: number;
    fallback?: boolean;
  };
};

export const submitAiFeedback = async (payload: {
  type?: string;
  helpful?: boolean;
  rating?: number;
  comment?: string;
  context?: Record<string, unknown>;
  sessionId?: string;
}) => {
  const response = await api.post('/api/ai/feedback', payload);
  return response.data as {
    success: boolean;
    message: string;
  };
};

