/**
 * SuperEmbed "advanced" player - same logic as se_player.php
 * Calls getsuperembed.link and redirects to the player URL (no PHP required)
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

const GETSUPEREMBED_BASE = 'https://getsuperembed.link';

// Same defaults as se_player.php (HEX without #)
const DEFAULTS = {
  player_font: 'Poppins',
  player_bg_color: '000000',
  player_font_color: 'ffffff',
  player_primary_color: '34cfeb',
  player_secondary_color: '6900e0',
  player_loader: 1,
  preferred_server: 11, // 11 = fembed (often works); 0 = no preference
  player_sources_toggle_type: 2
};

// GET /api/superembed-player?video_id=tt123&tmdb=1&s=1&e=1
router.get('/', async (req, res) => {
  const video_id = (req.query.video_id || '').trim();
  if (!video_id) {
    return res.status(400).send('Missing video_id');
  }

  const is_tmdb = req.query.tmdb === '1' || req.query.tmdb === 'true' ? 1 : 0;
  const season = Number(req.query.season || req.query.s || 0) || 0;
  const episode = Number(req.query.episode || req.query.e || 0) || 0;

  const params = new URLSearchParams({
    video_id,
    tmdb: String(is_tmdb),
    season: String(season),
    episode: String(episode),
    player_font: req.query.player_font || DEFAULTS.player_font,
    player_bg_color: req.query.player_bg_color || DEFAULTS.player_bg_color,
    player_font_color: req.query.player_font_color || DEFAULTS.player_font_color,
    player_primary_color: req.query.player_primary_color || DEFAULTS.player_primary_color,
    player_secondary_color: req.query.player_secondary_color || DEFAULTS.player_secondary_color,
    player_loader: String(req.query.player_loader || DEFAULTS.player_loader),
    preferred_server: String(req.query.preferred_server || DEFAULTS.preferred_server),
    player_sources_toggle_type: String(req.query.player_sources_toggle_type || DEFAULTS.player_sources_toggle_type)
  });

  const requestUrl = `${GETSUPEREMBED_BASE}/?${params.toString()}`;

  try {
    const { data } = await axios.get(requestUrl, {
      timeout: 10000,
      maxRedirects: 0,
      validateStatus: () => true,
      responseType: 'text'
    });

    const playerUrl = (data || '').trim();
    if (playerUrl && playerUrl.startsWith('https://')) {
      return res.redirect(302, playerUrl);
    }

    logger.warn('SuperEmbed player: upstream did not return a valid URL', { playerUrl: playerUrl?.slice(0, 80) });
    res.status(502).send(playerUrl || 'Request server didn\'t respond');
  } catch (err) {
    logger.warn('SuperEmbed player error:', err.message);
    res.status(502).send(err.message || 'Proxy error');
  }
});

module.exports = router;
