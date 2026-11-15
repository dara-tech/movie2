const roadmaps = [
  {
    slug: 'neo-noir-sci-fi-odyssey',
    title: 'Neo-Noir Sci-Fi Odyssey',
    tagline: 'From rain-soaked streets to mind-bending futures',
    description:
      'Ease into cerebral sci-fi with a curated journey that connects iconic cyberpunk worlds and modern philosophical epics.',
    heroImage: 'https://image.tmdb.org/t/p/original/9ZyDu8xYpi3IS6J0fOG3vHk0u8X.jpg',
    difficulty: 'Deep Dive',
    estimatedDuration: '3 nights',
    moodTags: ['Cyberpunk', 'Philosophical', 'Visually Stunning'],
    curatedBy: 'MovieStream Editors',
    lastUpdated: '2025-02-10T00:00:00Z',
    steps: [
      {
        id: 'blade-runner-2049',
        order: 1,
        title: 'Blade Runner 2049',
        tmdbId: 335984,
        summary: 'Return to the neon haze with Denis Villeneuve’s meditative sequel.',
        whyWatch: 'Sets the tone for identity, memory, and corporate dystopia.',
        connection: 'Introduces the modern look and feel of prestige cyberpunk.',
        runtimeMinutes: 164
      },
      {
        id: 'ghost-in-the-shell',
        order: 2,
        title: 'Ghost in the Shell (1995)',
        tmdbId: 9323,
        summary: 'A landmark anime that inspired The Matrix and dozens of sci-fi auteurs.',
        whyWatch: 'Explores consciousness and what it means to be human in a synthetic world.',
        connection: 'Builds on the existential threads from Blade Runner with anime flair.',
        runtimeMinutes: 83
      },
      {
        id: 'ex-machina',
        order: 3,
        title: 'Ex Machina',
        tmdbId: 264660,
        summary: 'A tense three-character chess match about AI ethics and manipulation.',
        whyWatch: 'Grounds the cyberpunk ideas in an intimate thriller.',
        connection: 'Moves from sprawling cities to claustrophobic labs to show another face of AI.',
        runtimeMinutes: 108
      },
      {
        id: 'arrival',
        order: 4,
        title: 'Arrival',
        tmdbId: 329865,
        summary: 'Language, time, and loss collide in this emotional first-contact story.',
        whyWatch: 'Closes the journey with a hopeful, empathetic perspective on the unknown.',
        connection: 'Reunites you with Villeneuve to reframe sci-fi as humanistic and awe-inspiring.',
        runtimeMinutes: 116
      }
    ],
    resources: [
      {
        title: 'Neo-Noir Soundscape',
        url: 'https://open.spotify.com/playlist/37i9dQZF1DXa2SkcxuQxxJ'
      },
      {
        title: 'Behind the Lights: Making Blade Runner 2049',
        url: 'https://www.youtube.com/watch?v=N5mVaybWN3U'
      }
    ]
  },
  {
    slug: 'feel-good-global-adventure',
    title: 'Feel-Good Global Adventure',
    tagline: 'Travel the world through heartwarming stories',
    description:
      'A breezy roadmap that hops between continents, celebrating food, friendship, and second chances.',
    heroImage: 'https://image.tmdb.org/t/p/original/gh2bmprLtUQ8oXCSluzfqaicyrm.jpg',
    difficulty: 'Casual',
    estimatedDuration: 'Weekend binge',
    moodTags: ['Feel-Good', 'Food', 'Travel'],
    curatedBy: 'Community Curators',
    lastUpdated: '2025-01-28T00:00:00Z',
    steps: [
      {
        id: 'chef',
        order: 1,
        title: 'Chef',
        tmdbId: 216015,
        summary: 'A disgraced chef rediscovers joy through a food-truck road trip.',
        whyWatch: 'Sets a warm tone with comfort food, music, and family vibes.',
        connection: 'Introduces the “follow-your-passion” arc that threads the roadmap.',
        runtimeMinutes: 115
      },
      {
        id: 'the-hundred-foot-journey',
        order: 2,
        title: 'The Hundred-Foot Journey',
        tmdbId: 209263,
        summary: 'Indian flavors clash—and eventually blend—with classic French cuisine.',
        whyWatch: 'Explores cultural fusion, mentorship, and resilience.',
        connection: 'Picks up the culinary thread and adds cross-cultural empathy.',
        runtimeMinutes: 122
      },
      {
        id: 'paddington-2',
        order: 3,
        title: 'Paddington 2',
        tmdbId: 346648,
        summary: 'Everyone’s favorite bear turns London upside down with kindness.',
        whyWatch: 'Delivers pure-hearted humor and a reminder to “be kind and polite.”',
        connection: 'Shows how optimism disarms even the grumpiest characters.',
        runtimeMinutes: 104
      },
      {
        id: 'hunt-for-the-wilderpeople',
        order: 4,
        title: 'Hunt for the Wilderpeople',
        tmdbId: 371645,
        summary: 'A Kiwi misfit and his foster uncle spark a national manhunt.',
        whyWatch: 'Blends adventure with heartfelt found-family beats.',
        connection: 'Ends the trip with literal wilderness wanderlust.',
        runtimeMinutes: 101
      }
    ],
    resources: [
      { title: 'Taika Waititi on crafting modern folk tales', url: 'https://www.youtube.com/watch?v=DXc6Eyj4w9w' }
    ]
  },
  {
    slug: 'dune-before-you-watch',
    title: 'Before You Watch Dune II',
    tagline: 'Prep for Arrakis with this lore-friendly queue',
    description:
      'Get the most out of the Dune saga by revisiting the visual language, themes, and ensemble storytelling that inspired it.',
    heroImage: 'https://image.tmdb.org/t/p/original/vC324sdfcS313vh9QXwijLIHPJp.jpg',
    difficulty: 'Focused',
    estimatedDuration: '2 nights',
    moodTags: ['Epic', 'Mythic', 'Politics'],
    curatedBy: 'House Atreides Intel',
    lastUpdated: '2025-02-02T00:00:00Z',
    steps: [
      {
        id: 'lawrence-of-arabia',
        order: 1,
        title: 'Lawrence of Arabia',
        tmdbId: 947,
        summary: 'An officer unites desert tribes in a sweeping historical epic.',
        whyWatch: 'Sets up the desert cinematography and colonial parallels that Dune draws on.',
        connection: 'Highlights the cost of messianic figures—core to Paul Atreides’ arc.',
        runtimeMinutes: 228
      },
      {
        id: 'dune-part-one',
        order: 2,
        title: 'Dune (2021)',
        tmdbId: 438631,
        summary: 'Begin Paul’s transformation amid spice wars and imperial betrayal.',
        whyWatch: 'Refreshes the characters, politics, and visuals directly.',
        connection: 'Acts as the midpoint before Part Two’s operatic conflict.',
        runtimeMinutes: 155
      },
      {
        id: 'arrival',
        order: 3,
        title: 'Arrival',
        tmdbId: 329865,
        summary: 'Language, fate, and sacrifice intersect in Villeneuve’s emotional sci-fi.',
        whyWatch: 'Reinforces Villeneuve’s storytelling cadence and Amy Adams’ performance as a tonal bridge.',
        connection: 'Preps you for Part Two’s themes of destiny and communication.',
        runtimeMinutes: 116
      },
      {
        id: 'dune-part-two-trailer',
        order: 4,
        title: 'Dune: Part Two (Preview)',
        tmdbId: 693134,
        summary: 'Finish with the latest trailer/featurette to jump straight into theaters.',
        whyWatch: 'Use fresh context to appreciate the craft and stakes awaiting on Arrakis.',
        connection: 'Culminates the roadmap by pointing to your next cinematic stop.',
        runtimeMinutes: 3
      }
    ],
    resources: [
      { title: 'Explainer: The Politics of Dune', url: 'https://www.youtube.com/watch?v=9NNQ5wRQB0o' },
      { title: 'Spice Melange Playlist', url: 'https://open.spotify.com/playlist/37i9dQZF1DXcWc5o9LAgj3' }
    ]
  }
];

module.exports = roadmaps;

