const mongoose = require('mongoose');

const togglesSchema = new mongoose.Schema(
  {
    recommendations: { type: Boolean, default: true },
    conversations: { type: Boolean, default: false },
    autoCuration: { type: Boolean, default: false },
    watchPartyPrompts: { type: Boolean, default: false }
  },
  { _id: false }
);

const promptsSchema = new mongoose.Schema(
  {
    recommendation: {
      type: String,
      default:
        'You are MovieStream\'s recommendation engine. Suggest up to 3 titles that match the viewer profile and current intent. Format as JSON with title, summary, and reason.'
    },
    assistant: {
      type: String,
      default:
        'You are MovieStream\'s assistant. Answer concisely, stay spoiler-free unless explicitly asked, and maintain a helpful, upbeat tone.'
    },
    summary: {
      type: String,
      default:
        'Provide a short, spoiler-aware synopsis in 2 sentences. Mention key themes and tone.'
    }
  },
  { _id: false }
);

const guardrailsSchema = new mongoose.Schema(
  {
    allowMatureContent: { type: Boolean, default: false },
    fallbackMessage: {
      type: String,
      default:
        'Sorry, I could not find a safe recommendation right now. Please adjust your filters or try a different request.'
    },
    maxTokens: { type: Number, default: 512 },
    blockedGenres: { type: [String], default: [] }
  },
  { _id: false }
);

const AiConfigSchema = new mongoose.Schema(
  {
    toggles: { type: togglesSchema, default: () => ({}) },
    prompts: { type: promptsSchema, default: () => ({}) },
    guardrails: { type: guardrailsSchema, default: () => ({}) },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastModifiedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AiConfig', AiConfigSchema);

