const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { requireAdmin } = require('../middleware/adminAuth');
const SiteSettings = require('../models/SiteSettings');
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const logger = require('../utils/logger');

// Canonical list of all streaming servers available in MovieStream
const AVAILABLE_SERVERS = [
  {
    id: 'vidsrcme.ru',
    name: 'vidsrcme.ru',
    baseUrl: 'https://vidsrcme.ru',
    type: 'vidsrc-new',
    quality: '1080p',
    description: 'Fast adaptive streaming mirror with high availability'
  },
  {
    id: 'vidsrc-embed.ru',
    name: 'vidsrc-embed.ru',
    baseUrl: 'https://vidsrc-embed.ru',
    type: 'vidsrc-new',
    quality: '1080p',
    description: 'Direct vidsrc embed mirror in Full HD'
  },
  {
    id: 'vidsrcme.su',
    name: 'vidsrcme.su',
    baseUrl: 'https://vidsrcme.su',
    type: 'vidsrc-new',
    quality: '1080p',
    description: 'Direct low-latency mirror'
  },
  {
    id: 'vidsrc-me.ru',
    name: 'vidsrc-me.ru',
    baseUrl: 'https://vidsrc-me.ru',
    type: 'vidsrc-new',
    quality: '1080p',
    description: 'Stable alternate mirror'
  },
  {
    id: 'vidsrc-embed.su',
    name: 'vidsrc-embed.su',
    baseUrl: 'https://vidsrc-embed.su',
    type: 'vidsrc-new',
    quality: '1080p',
    description: 'High-definition backup embed mirror'
  },
  {
    id: 'vsrc.su',
    name: 'vsrc.su',
    baseUrl: 'https://vsrc.su',
    type: 'vidsrc-new',
    quality: '1080p',
    description: 'Ultra fast streaming node'
  },
  {
    id: 'zxcstream',
    name: 'ZXCStream',
    baseUrl: 'https://zxcstream.xyz',
    type: 'zxcstream',
    quality: '1080p',
    description: 'Fast modern embed player with autoplay'
  },
  {
    id: 'moviepire',
    name: 'MoviePire',
    baseUrl: 'https://video.moviepire.co',
    type: 'moviepire',
    quality: '1080p',
    description: 'Fast modern embed player with autoplay'
  },
  {
    id: 'vidlink',
    name: 'VidLink (Clean)',
    baseUrl: 'https://vidlink.pro',
    type: 'vidlink',
    quality: '1080p',
    description: 'Clean UI, minimal ads player'
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed',
    baseUrl: 'https://player.autoembed.cc',
    type: 'autoembed',
    quality: '1080p',
    description: 'Reliable multi-source embed player'
  },
  {
    id: 'multiembed',
    name: 'SuperEmbed',
    baseUrl: 'https://multiembed.mov',
    type: 'multiembed',
    quality: 'HD',
    description: 'MultiEmbed stream aggregation player'
  },
  {
    id: 'vidsrc-to',
    name: 'Vidsrc.to',
    baseUrl: 'https://vidsrc.to',
    type: 'vidsrc-to',
    quality: 'HD',
    description: 'Popular international stream embed'
  },
  {
    id: 'vidplus',
    name: 'VidPlus',
    baseUrl: 'https://vidplus.to',
    type: 'vidplus',
    quality: 'HD',
    description: 'Fast alternate embed source'
  },
  {
    id: 'vidsrc',
    name: 'Vidsrc (vidsrc.me)',
    baseUrl: 'https://vidsrc.me',
    type: 'vidsrc',
    quality: 'HD',
    description: 'Classic vidsrc embed source'
  },
  {
    id: 'vidbinge',
    name: 'VidBinge',
    baseUrl: 'https://www.vidbinge.to',
    type: 'vidbinge',
    quality: 'HD',
    description: 'Direct embed source'
  },
  {
    id: 'godrive',
    name: 'GodrivePlayer',
    baseUrl: 'https://godriveplayer.com',
    type: 'godrive',
    quality: 'HD',
    description: 'Google Drive proxy player'
  }
];

// In-memory ping cache for responsiveness
const serviceHealth = {};

function pingUrl(targetUrl, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const start = Date.now();
      const req = client.get(
        targetUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: '*/*'
          },
          timeout: timeoutMs,
        },
        (res) => {
          const duration = Date.now() - start;
          req.destroy();
          // Status code < 500 (including 200, 301, 302, 403, 404) means the server host is reachable and running
          // 5xx (500, 502, 503, 521) or network drop means the host is failing
          const ok = res.statusCode < 500;
          resolve({ ok, time: duration, statusCode: res.statusCode });
        }
      );
      req.on('error', (err) => resolve({ ok: false, time: null, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, time: null, error: 'Timeout' });
      });
    } catch (err) {
      resolve({ ok: false, time: null, error: err.message });
    }
  });
}

// ----------------------------------------------------
// Public Endpoint: Get active streaming servers & default server
// ----------------------------------------------------
router.get('/config', async (req, res) => {
  try {
    const settings = await SiteSettings.getSettings();
    const defaultServerId = settings.streaming?.defaultServerId || 'vidsrcme.ru';
    const disabledServerIds = settings.streaming?.disabledServerIds || [];

    const servers = AVAILABLE_SERVERS.map((server) => ({
      ...server,
      isEnabled: !disabledServerIds.includes(server.id),
      isDefault: server.id === defaultServerId
    }));

    res.json({
      success: true,
      data: {
        defaultServerId,
        disabledServerIds,
        servers
      }
    });
  } catch (error) {
    logger.error('Error fetching public streaming config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch streaming configuration'
    });
  }
});

// ----------------------------------------------------
// All following endpoints require Admin authorization
// ----------------------------------------------------
router.use(requireAdmin);

// Get all services with their status and default marker
router.get('/services', async (req, res) => {
  try {
    const settings = await SiteSettings.getSettings();
    const defaultServerId = settings.streaming?.defaultServerId || 'vidsrcme.ru';
    const disabledServerIds = settings.streaming?.disabledServerIds || [];

    const services = AVAILABLE_SERVERS.map((server) => {
      const isEnabled = !disabledServerIds.includes(server.id);
      const isDefault = server.id === defaultServerId;
      const health = serviceHealth[server.id] || { isWorking: true, responseTime: 120 };

      return {
        id: server.id,
        name: server.name,
        baseUrl: server.baseUrl,
        type: server.type,
        quality: server.quality,
        description: server.description,
        isEnabled,
        isDefault,
        isWorking: health.isWorking,
        responseTime: health.responseTime,
        lastChecked: health.lastChecked || new Date().toISOString()
      };
    });

    res.json(services);
  } catch (error) {
    logger.error('Error fetching admin streaming services:', error);
    res.status(500).json({ message: 'Error fetching streaming services' });
  }
});

// Set default active server
router.put('/default/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const exists = AVAILABLE_SERVERS.some((s) => s.id === serviceId);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    const settings = await SiteSettings.getSettings();
    if (!settings.streaming) {
      settings.streaming = {};
    }

    settings.streaming.defaultServerId = serviceId;
    // Automatically enable the default server if it was previously disabled
    if (Array.isArray(settings.streaming.disabledServerIds)) {
      settings.streaming.disabledServerIds = settings.streaming.disabledServerIds.filter(
        (id) => id !== serviceId
      );
    }
    settings.streaming.updatedAt = new Date();
    await settings.save();

    logger.info(`Admin set default streaming server to: ${serviceId}`);

    res.json({
      success: true,
      defaultServerId: serviceId,
      message: `Default streaming server changed to ${serviceId}`
    });
  } catch (error) {
    logger.error('Error updating default streaming server:', error);
    res.status(500).json({ success: false, message: 'Failed to update default server' });
  }
});

// Toggle enabled/disabled status of a server
router.put('/services/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { isEnabled } = req.body;

    const exists = AVAILABLE_SERVERS.some((s) => s.id === serviceId);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    const settings = await SiteSettings.getSettings();
    if (!settings.streaming) {
      settings.streaming = { defaultServerId: 'vidsrcme.ru', disabledServerIds: [] };
    }

    const currentDefault = settings.streaming.defaultServerId || 'vidsrcme.ru';

    // Cannot disable the currently selected default server
    if (isEnabled === false && currentDefault === serviceId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot disable the default active server. Please set another server as default first.'
      });
    }

    let disabledList = Array.isArray(settings.streaming.disabledServerIds)
      ? [...settings.streaming.disabledServerIds]
      : [];

    if (isEnabled === false) {
      if (!disabledList.includes(serviceId)) {
        disabledList.push(serviceId);
      }
    } else {
      disabledList = disabledList.filter((id) => id !== serviceId);
    }

    settings.streaming.disabledServerIds = disabledList;
    settings.streaming.updatedAt = new Date();
    await settings.save();

    logger.info(`Admin toggled streaming server ${serviceId} -> isEnabled: ${isEnabled}`);

    res.json({
      success: true,
      message: `Server ${serviceId} is now ${isEnabled ? 'Active' : 'Inactive'}`,
      disabledServerIds: disabledList
    });
  } catch (error) {
    logger.error('Error updating streaming service:', error);
    res.status(500).json({ success: false, message: 'Failed to update service' });
  }
});

// Test/ping a specific streaming service with optional auto-deactivate
router.post('/test/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { autoDeactivate = true } = req.body || {};
    const server = AVAILABLE_SERVERS.find((s) => s.id === serviceId);
    if (!server) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const { ok, time, statusCode, error: pingError } = await pingUrl(server.baseUrl);

    serviceHealth[serviceId] = {
      isWorking: ok,
      responseTime: time || 999,
      lastChecked: new Date().toISOString()
    };

    let wasAutoDeactivated = false;
    let disabledServerIds = [];

    if (!ok && autoDeactivate) {
      const settings = await SiteSettings.getSettings();
      let disabledList = Array.isArray(settings.streaming?.disabledServerIds)
        ? [...settings.streaming.disabledServerIds]
        : [];
      if (!disabledList.includes(serviceId)) {
        disabledList.push(serviceId);
        settings.streaming.disabledServerIds = disabledList;
        settings.streaming.updatedAt = new Date();
        await settings.save();
        wasAutoDeactivated = true;
        logger.info(`Stream server ${serviceId} failed test (${pingError || statusCode}) and was auto-deactivated`);
      }
      disabledServerIds = disabledList;
    }

    res.json({
      success: ok,
      responseTime: time || 999,
      autoDeactivated: wasAutoDeactivated,
      disabledServerIds,
      message: ok
        ? 'Server is online and responding'
        : wasAutoDeactivated
        ? `Server failed (${pingError || 'HTTP ' + statusCode}) and was automatically deactivated`
        : `Server did not respond (${pingError || 'HTTP ' + statusCode})`
    });
  } catch (error) {
    logger.error('Error testing service:', error);
    res.status(500).json({ success: false, message: 'Error testing service' });
  }
});

// Test all servers and optionally auto-deactivate failing servers
router.post('/test-all', async (req, res) => {
  try {
    const { autoDeactivate = true } = req.body || {};
    const settings = await SiteSettings.getSettings();
    let disabledList = Array.isArray(settings.streaming?.disabledServerIds)
      ? [...settings.streaming.disabledServerIds]
      : [];

    const results = [];
    let newlyDeactivatedCount = 0;

    for (const server of AVAILABLE_SERVERS) {
      const { ok, time, statusCode, error: pingError } = await pingUrl(server.baseUrl, 3500);
      serviceHealth[server.id] = {
        isWorking: ok,
        responseTime: time || 999,
        lastChecked: new Date().toISOString()
      };

      let autoDeactivated = false;
      if (!ok && autoDeactivate) {
        if (!disabledList.includes(server.id)) {
          disabledList.push(server.id);
          newlyDeactivatedCount++;
          autoDeactivated = true;
        }
      }

      results.push({
        id: server.id,
        name: server.name,
        ok,
        responseTime: time || 999,
        autoDeactivated,
        error: pingError || (statusCode ? `HTTP ${statusCode}` : null)
      });
    }

    if (newlyDeactivatedCount > 0) {
      settings.streaming.disabledServerIds = disabledList;
      settings.streaming.updatedAt = new Date();
      await settings.save();
      logger.info(`Test All completed: auto-deactivated ${newlyDeactivatedCount} failing stream servers`);
    }

    res.json({
      success: true,
      results,
      disabledServerIds: disabledList,
      newlyDeactivatedCount,
      message: `Tested ${AVAILABLE_SERVERS.length} servers: ${newlyDeactivatedCount} automatically deactivated.`
    });
  } catch (error) {
    logger.error('Error in test-all streaming servers:', error);
    res.status(500).json({ success: false, message: 'Error testing all services' });
  }
});

// Streaming statistics
router.get('/stats', async (req, res) => {
  try {
    const totalMovies = await Movie.countDocuments();
    const totalTvShows = await TvShow.countDocuments();

    const moviesWithStreaming = await Movie.countDocuments({
      $or: [{ tmdbId: { $exists: true, $ne: null } }, { imdbId: { $exists: true, $ne: null } }]
    });

    const tvShowsWithStreaming = await TvShow.countDocuments({
      $or: [{ tmdbId: { $exists: true, $ne: null } }, { imdbId: { $exists: true, $ne: null } }]
    });

    res.json({
      totalMovies,
      moviesWithStreaming,
      totalTvShows,
      tvShowsWithStreaming,
      totalServers: AVAILABLE_SERVERS.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching streaming statistics' });
  }
});

module.exports = router;
