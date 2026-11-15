/**
 * Telegram Bot Webhook Routes
 * Handles incoming messages from Telegram for AI chat
 */

const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');
const logger = require('../utils/logger');

/**
 * POST /api/telegram/webhook
 * PUBLIC webhook endpoint for Telegram bot messages (no authentication required)
 * Telegram sends messages directly to this endpoint
 */
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    // Respond immediately to Telegram (within 3 seconds)
    res.status(200).json({ ok: true });

    // Process update asynchronously
    telegramService.processWebhookUpdate(update).catch(error => {
      logger.error('Error processing Telegram webhook update:', error);
    });
  } catch (error) {
    logger.error('Error handling Telegram webhook:', error);
    res.status(200).json({ ok: true }); // Always respond OK to Telegram
  }
});

/**
 * POST /api/telegram/set-webhook
 * Set webhook URL for Telegram bot (admin only)
 */
router.post('/set-webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required'
      });
    }

    await telegramService.loadSettings();
    
    if (!telegramService.botToken) {
      return res.status(400).json({
        success: false,
        message: 'Telegram bot token not configured'
      });
    }

    const axios = require('axios');
    const setWebhookUrl = `https://api.telegram.org/bot${telegramService.botToken}/setWebhook`;
    
    const response = await axios.post(setWebhookUrl, {
      url: webhookUrl
    });

    if (response.data.ok) {
      logger.info(`Telegram webhook set to: ${webhookUrl}`);
      res.json({
        success: true,
        message: 'Webhook set successfully',
        webhookUrl
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.description || 'Failed to set webhook'
      });
    }
  } catch (error) {
    logger.error('Error setting Telegram webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set webhook',
      error: error.message
    });
  }
});

/**
 * GET /api/telegram/webhook-info
 * Get current webhook information
 */
router.get('/webhook-info', async (req, res) => {
  try {
    await telegramService.loadSettings();
    
    if (!telegramService.botToken) {
      return res.status(400).json({
        success: false,
        message: 'Telegram bot token not configured'
      });
    }

    const axios = require('axios');
    const getWebhookInfoUrl = `https://api.telegram.org/bot${telegramService.botToken}/getWebhookInfo`;
    
    const response = await axios.get(getWebhookInfoUrl);
    
    res.json({
      success: true,
      data: response.data.result
    });
  } catch (error) {
    logger.error('Error getting webhook info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook info',
      error: error.message
    });
  }
});

module.exports = router;

