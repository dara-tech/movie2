const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'model'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      default: null,
    },
    timingMs: {
      type: Number,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const AiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    title: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    scheduledForDeletionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

AiConversationSchema.index({ user: 1, updatedAt: -1 });
AiConversationSchema.index({ lastMessageAt: -1 });
AiConversationSchema.index({ scheduledForDeletionAt: 1 });

AiConversationSchema.pre('save', function preSave(next) {
  this.messageCount = this.messages.length;
  if (this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].createdAt || new Date();
    if (!this.title && this.messages[0].role === 'user') {
      const raw = this.messages[0].content || '';
      this.title = raw.slice(0, 80);
    }
  }
  next();
});

module.exports = mongoose.model('AiConversation', AiConversationSchema);

