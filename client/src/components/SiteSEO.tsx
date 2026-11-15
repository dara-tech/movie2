import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { getOgImageMimeType, getOgImageSecureUrl } from '../lib/seoUtils';

const SITE_NAME = 'MovieStream';
const SITE_URL = process.env.REACT_APP_SITE_URL || 'https://www.moviestream.cc';
const DEFAULT_IMAGE = `${SITE_URL}/placeholder-movie.jpg`;
function normalizeTwitterHandle(raw: string | undefined, fallback: string): string {
  const t = (raw || '').trim();
  if (!t) return fallback;
  return t.startsWith('@') ? t : `@${t}`;
}

const TWITTER_SITE = normalizeTwitterHandle(process.env.REACT_APP_TWITTER_SITE, '@MovieStream');
const TWITTER_CREATOR_RAW = process.env.REACT_APP_TWITTER_CREATOR?.trim();
const TWITTER_CREATOR = TWITTER_CREATOR_RAW ? normalizeTwitterHandle(TWITTER_CREATOR_RAW, '') : '';

type RouteSEO = {
  title: string;
  description: string;
};

const routeSEO: Record<string, RouteSEO> = {
  '/': {
    title: 'Watch Movies and TV Shows Online',
    description:
      'Watch trending movies and TV shows on MovieStream. Discover new releases, top-rated titles, and fan favorites in one place.',
  },
  '/movies': {
    title: 'Latest and Trending Movies Online',
    description:
      'Browse trending, popular, and top-rated movies. Find your next movie to watch with fast discovery and updated listings.',
  },
  '/tvshows': {
    title: 'Popular TV Shows and Series Online',
    description:
      'Explore trending TV shows, latest series episodes, and fan favorites. Stream and discover TV content quickly.',
  },
  '/latest': {
    title: 'Latest Movie and TV Releases',
    description:
      'Stay updated with the latest movie and TV show releases. Discover what is new and trending today.',
  },
  '/search': {
    title: 'Search Movies and TV Shows',
    description:
      'Search movies, TV shows, casts, and genres instantly. Find content faster with smart search on MovieStream.',
  },
};

const shouldSkipDefaultSEO = (pathname: string): boolean =>
  pathname.startsWith('/movie/') ||
  pathname.startsWith('/tvshow/') ||
  pathname.startsWith('/cast/') ||
  pathname.startsWith('/login') ||
  pathname.startsWith('/register') ||
  pathname.startsWith('/forgot-password') ||
  pathname.startsWith('/reset-password') ||
  pathname.startsWith('/admin');

const SiteSEO: React.FC = () => {
  const location = useLocation();
  const { pathname } = location;

  if (shouldSkipDefaultSEO(pathname)) return null;

  const route = routeSEO[pathname] || routeSEO['/movies'];
  const canonicalUrl = `${SITE_URL}${pathname}`;
  const ogImageMime = getOgImageMimeType(DEFAULT_IMAGE);
  const ogImageSecure = getOgImageSecureUrl(DEFAULT_IMAGE);

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
  };

  return (
    <Helmet>
      <title>{`${route.title} | ${SITE_NAME}`}</title>
      <meta name="description" content={route.description} />
      <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" type="application/rss+xml" title={`${SITE_NAME} - Latest Movies & TV Shows`} href={`${SITE_URL}/rss.xml`} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={`${route.title} | ${SITE_NAME}`} />
      <meta property="og:description" content={route.description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      {ogImageSecure ? <meta property="og:image:secure_url" content={ogImageSecure} /> : null}
      <meta property="og:image:type" content={ogImageMime} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} — ${route.title}`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_SITE} />
      {TWITTER_CREATOR ? <meta name="twitter:creator" content={TWITTER_CREATOR} /> : null}
      <meta name="twitter:title" content={`${route.title} | ${SITE_NAME}`} />
      <meta name="twitter:description" content={route.description} />
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
      <meta name="twitter:image:alt" content={`${SITE_NAME} — ${route.title}`} />

      <script type="application/ld+json">{JSON.stringify(websiteJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(organizationJsonLd)}</script>
    </Helmet>
  );
};

export default SiteSEO;
