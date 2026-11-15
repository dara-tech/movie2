const express = require('express');
const router = express.Router();
const roadmaps = require('../data/roadmaps');
const geminiService = require('../services/geminiService');
const tmdbService = require('../services/tmdbService');
const auth = require('../middleware/auth');

router.get('/', (req, res) => {
  const summaries = roadmaps.map((roadmap) => ({
    slug: roadmap.slug,
    title: roadmap.title,
    tagline: roadmap.tagline,
    description: roadmap.description,
    heroImage: roadmap.heroImage,
    difficulty: roadmap.difficulty,
    estimatedDuration: roadmap.estimatedDuration,
    moodTags: roadmap.moodTags,
    curatedBy: roadmap.curatedBy,
    lastUpdated: roadmap.lastUpdated,
    stepCount: roadmap.steps.length
  }));
  res.json({ roadmaps: summaries });
});

router.post('/generate', auth, async (req, res) => {
  try {
    const { userRequest } = req.body;

    if (!userRequest || typeof userRequest !== 'string' || userRequest.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a description of what you want to watch.'
      });
    }

    // Processing user request

    const systemPrompt = `You are a movie curator creating personalized watch roadmaps. Based on the user's request, generate a curated roadmap of 4-6 movies or TV shows that form a meaningful journey.

CRITICAL REQUIREMENTS:
- You MUST provide EXACT movie/show titles (use the official title from TMDB)
- For each step, provide the EXACT title as it appears in The Movie Database (TMDB)
- Include the release year in the title if needed for disambiguation (e.g., "Blade Runner (1982)" or "Blade Runner 2049 (2017)")
- ALL fields are REQUIRED - do not leave any empty
- Provide detailed, meaningful descriptions for each step

Return ONLY valid JSON in this exact format (no markdown, no code blocks, just pure JSON):
{
  "title": "Roadmap title (e.g., 'Neo-Noir Sci-Fi Odyssey')",
  "tagline": "Short catchy tagline (max 10 words)",
  "description": "2-3 sentence description of the journey",
  "difficulty": "Casual" | "Focused" | "Deep Dive",
  "estimatedDuration": "e.g., 'Weekend binge' or '3 nights'",
  "moodTags": ["Tag1", "Tag2", "Tag3"],
  "steps": [
    {
      "id": "unique-id-1",
      "order": 1,
      "title": "EXACT Movie/Show Title (as in TMDB, include year if needed)",
      "tmdbId": null,
      "summary": "Detailed 1-2 sentence summary of the movie/show",
      "whyWatch": "Detailed explanation of why this fits the journey (2-3 sentences)",
      "connection": "Detailed explanation of how it connects to previous/next step (2-3 sentences)",
      "runtimeMinutes": null,
      "contentType": "movie" | "tvshow"
    }
  ]
}

IMPORTANT RULES:
- Set tmdbId to null - we will look it up automatically
- Set runtimeMinutes to null - we will fetch it automatically
- You MUST specify contentType as either "movie" or "tvshow" for each step
- Use EXACT titles from TMDB (you can include release year in parentheses for clarity)
- Create 4-6 steps (minimum 4, maximum 6)
- Each step MUST have complete information - summary, whyWatch, and connection should be detailed
- Make the journey feel curated and intentional with clear thematic connections
- Difficulty: "Casual" for light/easy, "Focused" for moderate, "Deep Dive" for challenging/complex
- Be creative but realistic with movie selections
- Return ONLY the JSON object, no additional text before or after`;

    const userPrompt = `Create a personalized watch roadmap based on this request: "${userRequest.trim()}"

Generate a curated journey of 4-6 movies or TV shows that match the user's interest. 
- Use EXACT titles as they appear in The Movie Database (TMDB)
- Include release year in parentheses if needed (e.g., "The Matrix (1999)")
- Specify whether each is a "movie" or "tvshow" in the contentType field
- Make sure each step connects to the overall theme and builds a meaningful viewing experience
- Provide detailed, meaningful descriptions for why each step matters`;

    const result = await geminiService.geminiGenerate({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      systemPrompt,
      userPrompt,
      guardrails: {},
      overrides: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    });


    if (!result || !result.text) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate roadmap. Please try again.',
        error: 'No response from AI'
      });
    }

    // Extract JSON from response - try multiple methods
    let jsonText = result.text.trim();
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Try to find JSON object
    let jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // No JSON found in response
      return res.status(500).json({
        success: false,
        message: 'Invalid response format from AI.',
        raw: result.text.substring(0, 500)
      });
    }

    let roadmapData;
    try {
      roadmapData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      // JSON parse error
      return res.status(500).json({
        success: false,
        message: 'Failed to parse AI response.',
        error: parseError.message,
        raw: result.text.substring(0, 500)
      });
    }

    // Validate required fields
    if (!roadmapData.title || !roadmapData.steps || !Array.isArray(roadmapData.steps)) {
      return res.status(500).json({
        success: false,
        message: 'Generated roadmap missing required fields.',
        raw: roadmapData
      });
    }

    if (roadmapData.steps.length < 3) {
      return res.status(500).json({
        success: false,
        message: 'Roadmap must have at least 3 steps.',
        raw: roadmapData
      });
    }

    
    // Search TMDB for each step to get accurate IDs and information
    const enrichedSteps = await Promise.all(
      roadmapData.steps.map(async (step, index) => {
        const stepTitle = step.title || '';
        const contentType = step.contentType || 'movie';
        
        // Extract title without year if present
        const titleWithoutYear = stepTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim();
        
        // Searching for step
        
        let tmdbId = step.tmdbId;
        let details = null;
        
        // If no tmdbId provided, search for it
        if (!tmdbId || tmdbId === null) {
          try {
            if (contentType === 'tvshow') {
              const searchResults = await tmdbService.searchTvShows(titleWithoutYear, 1);
              if (searchResults.results && searchResults.results.length > 0) {
                // Try exact match first
                const exactMatch = searchResults.results.find(
                  r => r.name.toLowerCase() === titleWithoutYear.toLowerCase()
                );
                const match = exactMatch || searchResults.results[0];
                tmdbId = match.id;
                // Found TV show
              }
            } else {
              const searchResults = await tmdbService.searchMovies(titleWithoutYear, 1);
              if (searchResults.results && searchResults.results.length > 0) {
                // Try exact match first
                const exactMatch = searchResults.results.find(
                  r => r.title.toLowerCase() === titleWithoutYear.toLowerCase()
                );
                const match = exactMatch || searchResults.results[0];
                tmdbId = match.id;
                // Found movie
              }
            }
          } catch (searchError) {
          }
        }
        
        // If we have a tmdbId, fetch details
        if (tmdbId) {
          try {
            if (contentType === 'tvshow') {
              details = await tmdbService.getTvShowDetails(tmdbId);
            } else {
              details = await tmdbService.getMovieDetails(tmdbId);
            }
            
            // Update title with actual TMDB title if different
            const actualTitle = contentType === 'tvshow' ? details.name : details.title;
            if (actualTitle && actualTitle !== step.title) {
            }
          } catch (detailsError) {
          }
        }
        
        if (!tmdbId || !details) {
          return {
            ...step,
            tmdbId: null,
            posterPath: null,
            backdropPath: null,
            runtimeMinutes: step.runtimeMinutes || null
          };
        }

        // Enrich step with TMDB data
        const actualTitle = contentType === 'tvshow' ? details.name : details.title;
        const actualOverview = details.overview || step.summary;
        const runtime = details.runtime || (details.episode_run_time?.[0] || null);
        
        return {
          ...step,
          title: actualTitle || step.title, // Use actual TMDB title
          tmdbId: tmdbId,
          posterPath: details.poster_path,
          backdropPath: details.backdrop_path,
          contentType: contentType,
          summary: step.summary || actualOverview, // Use AI summary if provided, otherwise TMDB overview
          runtimeMinutes: step.runtimeMinutes || runtime,
          // Keep AI-generated whyWatch and connection as they're more contextual
          whyWatch: step.whyWatch || `A ${contentType === 'tvshow' ? 'TV show' : 'film'} that fits this journey.`,
          connection: step.connection || 'Part of this curated viewing experience.'
        };
      })
    );
    
    // Filter out steps that couldn't be found
    const validSteps = enrichedSteps.filter(step => step.tmdbId !== null);
    
    if (validSteps.length < 3) {
      return res.status(500).json({
        success: false,
        message: `Could not find enough valid titles in TMDB. Found ${validSteps.length} out of ${roadmapData.steps.length} steps.`,
        found: validSteps.map(s => s.title),
        missing: enrichedSteps.filter(s => !s.tmdbId).map(s => s.title)
      });
    }

    // Find the first step with a backdrop for the hero image
    const heroBackdrop = validSteps.find(step => step.backdropPath)?.backdropPath;
    const heroPoster = validSteps.find(step => step.posterPath)?.posterPath;

    // Generate a slug from title
    const slug = roadmapData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    // Add metadata
    const fullRoadmap = {
      slug: `${slug}-${Date.now()}`,
      ...roadmapData,
      steps: validSteps,
      heroImage: heroBackdrop
        ? `https://image.tmdb.org/t/p/original${heroBackdrop}`
        : heroPoster
        ? `https://image.tmdb.org/t/p/original${heroPoster}`
        : 'https://image.tmdb.org/t/p/original/placeholder.jpg',
      curatedBy: 'AI Generated',
      lastUpdated: new Date().toISOString(),
      stepCount: validSteps.length,
      resources: roadmapData.resources || []
    };


    res.json({
      success: true,
      roadmap: fullRoadmap,
      model: result.model,
      timingMs: result.timingMs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate roadmap.',
      error: error.toString()
    });
  }
});

router.get('/:slug', (req, res) => {
  const roadmap = roadmaps.find((item) => item.slug === req.params.slug);
  if (!roadmap) {
    return res.status(404).json({ message: 'Roadmap not found' });
  }
  res.json({ roadmap });
});

module.exports = router;

