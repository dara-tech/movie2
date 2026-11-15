const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const geminiService = require('../services/geminiService');
const AiConversation = require('../models/AiConversation');

const buildUserProfile = (userDoc) => {
  if (!userDoc) return null;
  const profile = {};
  if (userDoc.username) profile.username = userDoc.username;
  if (userDoc.email) profile.email = userDoc.email;
  if (userDoc.preferences) profile.preferences = userDoc.preferences;
  if (userDoc.profile) profile.profile = userDoc.profile;
  return Object.keys(profile).length > 0 ? profile : null;
};

const MAX_MESSAGES_PER_CONVERSATION = 200;

router.post('/assistant', auth, async (req, res) => {
  try {
    const {
      messages = [],
      userProfile: profileOverride,
      conversationId,
    } = req.body || {};

    let profile = profileOverride || null;
    if (!profile) {
      const userDoc = await User.findById(req.user.id)
        .select('username email preferences profile')
        .lean();
      profile = buildUserProfile(userDoc);
    }

    let conversation = null;
    if (conversationId) {
      conversation = await AiConversation.findOne({
        _id: conversationId,
        user: req.user.id,
      });
    }

    if (!conversation) {
      conversation = await AiConversation.create({
        user: req.user.id,
        messages: [],
        metadata: {},
      });
    }

    const sanitizedMessages = (messages || []).map((message) => ({
      role: message.role === 'model' ? 'model' : 'user',
      content: message.content || '',
    }));

    const latestUserMessage = sanitizedMessages.length > 0
      ? sanitizedMessages[sanitizedMessages.length - 1]
      : null;

    if (!latestUserMessage || latestUserMessage.role !== 'user') {
      return res.status(400).json({
        enabled: false,
        message: 'Last message must be from the user.',
      });
    }

    conversation.messages.push({
      role: 'user',
      content: latestUserMessage.content,
      createdAt: new Date(),
    });

    if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
      conversation.messages = conversation.messages.slice(
        conversation.messages.length - MAX_MESSAGES_PER_CONVERSATION,
      );
    }

    const result = await geminiService.generateAssistantResponse({
      messages,
      userProfile: profile,
    });

    if (!result.enabled) {
      conversation.messages.push({
        role: 'model',
        content:
          result.reason === 'conversations_disabled'
            ? 'AI conversations are currently disabled by an administrator.'
            : 'The assistant is unavailable at the moment. Please try again later.',
        createdAt: new Date(),
      });
      conversation.metadata = {
        ...conversation.metadata,
        disabledReason: result.reason,
        updatedAt: new Date(),
      };
    } else {
      conversation.messages.push({
        role: 'model',
        content: result.response,
        model: result.model,
        timingMs: result.timingMs,
        createdAt: new Date(),
      });

      conversation.metadata = {
        ...conversation.metadata,
        lastModel: result.model,
        lastTimingMs: result.timingMs,
      };
    }

    if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
      conversation.messages = conversation.messages.slice(
        conversation.messages.length - MAX_MESSAGES_PER_CONVERSATION,
      );
    }

    await conversation.save();

    if (!result.enabled) {
      return res.json({
        enabled: false,
        reason: result.reason,
        conversationId: conversation._id,
      });
    }

    return res.json({
      enabled: true,
      response: result.response,
      model: result.model,
      timingMs: result.timingMs,
      fallback: !result.success,
      conversationId: conversation._id,
    });
  } catch (error) {
    res.status(500).json({
      enabled: false,
      message: 'Failed to generate assistant response',
    });
  }
});

router.post('/summary', auth, async (req, res) => {
  try {
    const { title, overview, cast, tone } = req.body || {};
    if (!title || !overview) {
      return res.status(400).json({
        success: false,
        message: 'Title and overview are required',
      });
    }

    const result = await geminiService.generateSummary({
      title,
      overview,
      cast,
      tone,
    });

    res.json({
      success: result.success,
      summary: result.summary,
      model: result.model,
      timingMs: result.timingMs,
      fallback: !result.success,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate summary',
    });
  }
});

router.post('/feedback', auth, async (req, res) => {
  try {
    const { type = 'recommendation', helpful, rating, comment, context, sessionId } = req.body || {};

    const result = await geminiService.recordFeedback({
      type,
      helpful,
      rating,
      comment,
      context,
      sessionId,
      userId: req.user.id,
    });

    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: 'Failed to record feedback',
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Feedback recorded',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to record feedback',
    });
  }
});

module.exports = router;

