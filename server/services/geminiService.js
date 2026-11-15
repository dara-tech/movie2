const { GoogleGenerativeAI } = require('@google/generative-ai');
const AiConfig = require('../models/AiConfig');
const AiFeedback = require('../models/AiFeedback');

// Gemini models - Update to Gemini 3 when available: gemini-3.0-flash or gemini-3-flash
// Current stable: gemini-2.0-flash-exp
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const DEFAULT_ASSISTANT_MODEL =
  process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const DEFAULT_SUMMARY_MODEL =
  process.env.GEMINI_SUMMARY_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-exp';

let client;
let cachedConfig = null;
let lastConfigFetch = 0;
const CONFIG_TTL = 60 * 1000; // 1 minute

const ensureClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!client) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  return client;
};

const ensureAiConfig = async () => {
  const now = Date.now();
  if (cachedConfig && now - lastConfigFetch < CONFIG_TTL) {
    return cachedConfig;
  }

  let config = await AiConfig.findOne();
  if (!config) {
    config = await AiConfig.create({});
  }

  cachedConfig = config;
  lastConfigFetch = now;
  return cachedConfig;
};

const invalidateConfigCache = () => {
  cachedConfig = null;
  lastConfigFetch = 0;
};

const extractJson = (text) => {
  if (!text) return null;
  const codeFenceMatch = text.match(/```json([\s\S]*?)```/i);
  const rawJson = codeFenceMatch ? codeFenceMatch[1] : text;

  try {
    return JSON.parse(rawJson.trim());
  } catch (error) {
    // Try to locate the first { ... } block
    const braceIndex = rawJson.indexOf('{');
    const lastBraceIndex = rawJson.lastIndexOf('}');
    if (braceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > braceIndex) {
      const possibleJson = rawJson.slice(braceIndex, lastBraceIndex + 1);
      try {
        return JSON.parse(possibleJson);
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
};

const buildGuardrailSummary = (guardrails) => {
  if (!guardrails) return '';
  const lines = [];
  if (guardrails.allowMatureContent === false) {
    lines.push('- Do not recommend or surface adult or explicit content.');
  }
  if (Array.isArray(guardrails.blockedGenres) && guardrails.blockedGenres.length > 0) {
    lines.push(
      `- Blocked genres: ${guardrails.blockedGenres
        .map((genre) => genre.trim())
        .filter(Boolean)
        .join(', ')}`
    );
  }
  if (guardrails.fallbackMessage) {
    lines.push(`- If no safe option is available, respond with the fallback message.`);
  }
  return lines.join('\n');
};

const buildGenerationConfig = (guardrails, overrides = {}) => {
  const maxOutputTokens =
    overrides.maxOutputTokens ||
    guardrails?.maxTokens ||
    parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '', 10) ||
    512;

  return {
    maxOutputTokens: Math.min(Math.max(maxOutputTokens, 128), 8192),
    temperature:
      overrides.temperature ??
      (guardrails?.allowMatureContent ? 0.7 : 0.6),
    topP: overrides.topP ?? 0.8,
    topK: overrides.topK ?? 40,
  };
};

const filterBlockedContent = (items = [], guardrails = {}) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const blockedGenres =
    Array.isArray(guardrails.blockedGenres) && guardrails.blockedGenres.length > 0
      ? new Set(guardrails.blockedGenres.map((genre) => genre.toLowerCase()))
      : null;

  return items.filter((item) => {
    if (!guardrails.allowMatureContent && item.adult) {
      return false;
    }
    if (!blockedGenres || !item.genres) {
      return true;
    }
    const itemGenres = item.genres
      .map((genre) => (typeof genre === 'string' ? genre : genre?.name || ''))
      .map((genre) => genre.toLowerCase());

    return !itemGenres.some((genre) => blockedGenres.has(genre));
  });
};

const geminiGenerate = async ({
  model,
  systemPrompt,
  userPrompt,
  guardrails,
  overrides,
  contents,
}) => {
  const start = Date.now();
  const genAI = ensureClient();
  const generationConfig = buildGenerationConfig(guardrails, overrides);
  const activeModel = genAI.getGenerativeModel({
    model,
    generationConfig,
  });

  const requestContents =
    Array.isArray(contents) && contents.length > 0
      ? contents
      : [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt || ''}\n${userPrompt || ''}`.trim() }],
          },
        ];

  try {
    const result = await activeModel.generateContent({
      contents: requestContents,
    });

    const text = result?.response?.text?.() || '';
    return {
      text,
      timingMs: Date.now() - start,
      model,
      config: generationConfig,
    };
  } catch (error) {
    if (model !== FALLBACK_MODEL) {
      const fallbackModel = genAI.getGenerativeModel({
        model: FALLBACK_MODEL,
        generationConfig,
      });
      const fallbackResult = await fallbackModel.generateContent({
        contents: requestContents,
      });
      const text = fallbackResult?.response?.text?.() || '';
      return {
        text,
        timingMs: Date.now() - start,
        model: FALLBACK_MODEL,
        config: generationConfig,
        fallback: true,
      };
    }
    throw error;
  }
};

const generateRecommendations = async ({
  userContext,
  candidates,
  limit = 5,
}) => {
  const config = await ensureAiConfig();
  if (!config?.toggles?.recommendations) {
    return {
      enabled: false,
      reason: 'recommendations_disabled',
    };
  }

  const guardrails = config.guardrails || {};
  const filteredCandidates = filterBlockedContent(candidates, guardrails);
  if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
    return {
      enabled: false,
      reason: 'no_candidates_after_guardrails',
    };
  }

  const candidatePayload = filteredCandidates.map((movie) => ({
    id: movie._id?.toString() || movie.id || movie.tmdbId?.toString(),
    title: movie.title,
    overview: movie.overview,
    year: movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null,
    voteAverage: movie.voteAverage,
    popularity: movie.popularity,
    runtime: movie.runtime,
    genres: (movie.genres || []).map((genre) =>
      typeof genre === 'string' ? genre : genre?.name || ''
    ),
    adult: Boolean(movie.adult),
    streamingProviders: (movie.watchProviders?.flatrate || []).map(
      (provider) => provider.providerName
    ),
  }));

  const instructions = [
    config.prompts?.recommendation ||
      'Recommend up to 3 titles that best match the viewer profile. Return JSON.',
    'Follow these rules strictly:',
    '- Only choose from the provided candidates.',
    guardrails.allowMatureContent
      ? '- You may include mature content if it fits the request.'
      : '- Do not include adult or explicit content.',
    guardrails.blockedGenres?.length
      ? `- Never include genres: ${guardrails.blockedGenres.join(', ')}.`
      : null,
    '- Respond strictly in JSON format:',
    `{
  "results": [
    {
      "id": "<candidate-id>",
      "reason": "short natural language reason (max 25 words)",
      "confidence": 0.0-1.0
    }
  ],
  "fallback": boolean
}`,
    '- Set "fallback" to true if no safe option is available.',
    guardrails.fallbackMessage
      ? `- If fallback is true, include this message in "reason": "${guardrails.fallbackMessage}".`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    userProfile: userContext || {},
    candidates: candidatePayload,
    limit,
  };

  const { text, model, timingMs } = await geminiGenerate({
    model: DEFAULT_MODEL,
    systemPrompt: instructions,
    userPrompt: JSON.stringify(payload, null, 2),
    guardrails,
    overrides: {
      temperature: 0.4,
      maxOutputTokens: Math.max(guardrails.maxTokens || 512, 256),
    },
  });

  const json = extractJson(text);
  if (!json || !Array.isArray(json.results)) {
    return {
      enabled: true,
      success: false,
      reason: 'invalid_json',
      raw: text,
      model,
      timingMs,
    };
  }

  const uniqueResults = [];
  const seen = new Set();
  for (const entry of json.results) {
    if (!entry?.id || seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    uniqueResults.push({
      id: entry.id,
      reason: entry.reason?.trim() || '',
      confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
    });
    if (uniqueResults.length >= limit) break;
  }

  return {
    enabled: true,
    success: true,
    fallback: Boolean(json.fallback),
    recommendations: uniqueResults,
    raw: text,
    model,
    timingMs,
  };
};

const generateAssistantResponse = async ({ messages, userProfile }) => {
  const config = await ensureAiConfig();
  if (!config?.toggles?.conversations) {
    return {
      enabled: false,
      reason: 'conversations_disabled',
    };
  }

  const guardrails = config.guardrails || {};

  const systemPrompt = [
    config.prompts?.assistant ||
      'You are MovieStream assistant. Respond concisely and stay spoiler-free unless asked.',
    buildGuardrailSummary(guardrails),
    '- Always keep responses under 180 words unless explicitly asked for more detail.',
    '- After your helpful reply, add a single line in the format "@MovieCard: <comma separated keywords or titles>" that best represents the requested content (keep under 50 characters).',
    '- Only omit the "@MovieCard" line when no viewing suggestion is appropriate (e.g. policy refusal).',
    guardrails.blockedGenres?.length
      ? `- Politely refuse requests involving: ${guardrails.blockedGenres.join(', ')}.`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const conversation = (messages || []).slice(-10).map((message) => ({
    role: message.role === 'model' ? 'model' : 'user',
    parts: [{ text: message.content || '' }],
  }));

  const promptParts = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    userProfile
      ? {
          role: 'user',
          parts: [
            {
              text: `User profile context:\n${JSON.stringify(userProfile, null, 2)}`,
            },
          ],
        }
      : null,
    ...conversation,
  ].filter(Boolean);

  const { text, model, timingMs } = await geminiGenerate({
    model: DEFAULT_ASSISTANT_MODEL,
    contents: promptParts,
    guardrails,
    overrides: {
      temperature: 0.7,
      maxOutputTokens: Math.max(guardrails.maxTokens || 512, 256),
    },
  });

  return {
    enabled: true,
    success: Boolean(text),
    response: text?.trim() || guardrails.fallbackMessage || 'Unable to respond right now.',
    model,
    timingMs,
  };
};

const generateSummary = async ({ title, overview, cast, tone = 'neutral' }) => {
  const config = await ensureAiConfig();
  const guardrails = config.guardrails || {};
  const prompt = [
    config.prompts?.summary ||
      'Provide a short, spoiler-aware synopsis in 2 sentences. Mention key themes and tone.',
    `Tone: ${tone}`,
    buildGuardrailSummary(guardrails),
    'Input will include title, overview, and optional cast highlights.',
    'Respond with 2 concise sentences (max 80 words) and avoid spoilers.',
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    title,
    overview,
    cast: cast?.slice(0, 5) || [],
  };

  const { text, model, timingMs } = await geminiGenerate({
    model: DEFAULT_SUMMARY_MODEL,
    systemPrompt: prompt,
    userPrompt: JSON.stringify(payload, null, 2),
    guardrails,
    overrides: {
      temperature: 0.5,
      maxOutputTokens: 256,
    },
  });

  return {
    enabled: true,
    success: Boolean(text),
    summary: text?.trim() || guardrails.fallbackMessage || 'Summary unavailable.',
    model,
    timingMs,
  };
};

const recordFeedback = async ({ type, helpful, rating, comment, userId, context, sessionId }) => {
  try {
    await AiFeedback.create({
      type,
      helpful,
      rating,
      comment,
      context,
      user: userId || null,
      sessionId: sessionId || null,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  ensureAiConfig,
  invalidateConfigCache,
  generateRecommendations,
  generateAssistantResponse,
  generateSummary,
  recordFeedback,
  geminiGenerate,
};

