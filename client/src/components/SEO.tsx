import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  MovieSEOData,
  TVShowSEOData,
  generateMovieSEO,
  generateTVShowSEO,
  generateMovieJSONLD,
  generateTVShowJSONLD,
  truncateText,
  getOgImageMimeType,
  getOgImageSecureUrl
} from '../lib/seoUtils';

interface MovieSEOProps {
  movie: MovieSEOData;
  siteName?: string;
  siteUrl?: string;
  twitterHandle?: string;
}

interface TVShowSEOProps {
  tvShow: TVShowSEOData;
  siteName?: string;
  siteUrl?: string;
  twitterHandle?: string;
}

export const MovieSEO: React.FC<MovieSEOProps> = ({ 
  movie, 
  siteName = 'MovieStream',
  siteUrl = process.env.REACT_APP_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://www.moviestream.cc'),
  twitterHandle = '@MovieStream'
}) => {
  const seoData = generateMovieSEO(movie, { siteName, siteUrl, twitterHandle, defaultImage: '/placeholder-movie.jpg' });
  const jsonLD = generateMovieJSONLD(movie, { siteName, siteUrl, twitterHandle, defaultImage: '/placeholder-movie.jpg' });
  const canonicalPath =
    typeof window !== 'undefined' ? window.location.pathname : seoData.url.replace(siteUrl, '');
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const jsonLDWithUrl = { ...jsonLD, url: canonicalUrl };
  const ogImageMime = getOgImageMimeType(seoData.image);
  const ogImageSecure = getOgImageSecureUrl(seoData.image);
  const twitterCreator = process.env.REACT_APP_TWITTER_CREATOR?.trim();
  const twitterSiteMeta = twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seoData.title} | {siteName}</title>
      <meta name="description" content={truncateText(seoData.description)} />
      <link rel="canonical" href={canonicalUrl} />

      {/* OpenGraph Meta Tags */}
      <meta property="og:type" content={seoData.type} />
      <meta property="og:title" content={seoData.title} />
      <meta property="og:description" content={truncateText(seoData.description)} />
      <meta property="og:image" content={seoData.image} />
      {ogImageSecure ? <meta property="og:image:secure_url" content={ogImageSecure} /> : null}
      <meta property="og:image:type" content={ogImageMime} />
      <meta property="og:image:width" content="1280" />
      <meta property="og:image:height" content="720" />
      <meta property="og:image:alt" content={`${movie.title} — poster`} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={seoData.siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Movie-specific OpenGraph tags */}
      {movie.releaseDate ? <meta property="video:release_date" content={movie.releaseDate} /> : null}
      {movie.runtime ? <meta property="video:duration" content={String(movie.runtime * 60)} /> : null}
      {(movie.genres || []).map((g) => (
        <meta key={g.name} property="video:tag" content={g.name} />
      ))}

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={twitterSiteMeta} />
      {twitterCreator ? (
        <meta
          name="twitter:creator"
          content={twitterCreator.startsWith('@') ? twitterCreator : `@${twitterCreator}`}
        />
      ) : null}
      <meta name="twitter:title" content={seoData.title} />
      <meta name="twitter:description" content={truncateText(seoData.description)} />
      <meta name="twitter:image" content={seoData.image} />
      <meta name="twitter:image:alt" content={`${movie.title} — poster`} />

      {/* Additional Meta Tags */}
      <meta name="keywords" content={`${movie.title}, ${seoData.genres}, movie, streaming, ${seoData.year}`} />
      <meta name="robots" content="index, follow" />
      <meta name="author" content={siteName} />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLDWithUrl)}
      </script>
    </Helmet>
  );
};

export const TVShowSEO: React.FC<TVShowSEOProps> = ({ 
  tvShow, 
  siteName = 'MovieStream',
  siteUrl = process.env.REACT_APP_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://www.moviestream.cc'),
  twitterHandle = '@MovieStream'
}) => {
  const seoData = generateTVShowSEO(tvShow, { siteName, siteUrl, twitterHandle, defaultImage: '/placeholder-movie.jpg' });
  const jsonLD = generateTVShowJSONLD(tvShow, { siteName, siteUrl, twitterHandle, defaultImage: '/placeholder-movie.jpg' });
  const canonicalPath =
    typeof window !== 'undefined' ? window.location.pathname : seoData.url.replace(siteUrl, '');
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const jsonLDWithUrl = { ...jsonLD, url: canonicalUrl };
  const ogImageMime = getOgImageMimeType(seoData.image);
  const ogImageSecure = getOgImageSecureUrl(seoData.image);
  const twitterCreator = process.env.REACT_APP_TWITTER_CREATOR?.trim();
  const twitterSiteMeta = twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seoData.title} | {siteName}</title>
      <meta name="description" content={truncateText(seoData.description)} />
      <link rel="canonical" href={canonicalUrl} />

      {/* OpenGraph Meta Tags */}
      <meta property="og:type" content={seoData.type} />
      <meta property="og:title" content={seoData.title} />
      <meta property="og:description" content={truncateText(seoData.description)} />
      <meta property="og:image" content={seoData.image} />
      {ogImageSecure ? <meta property="og:image:secure_url" content={ogImageSecure} /> : null}
      <meta property="og:image:type" content={ogImageMime} />
      <meta property="og:image:width" content="1280" />
      <meta property="og:image:height" content="720" />
      <meta property="og:image:alt" content={`${tvShow.name} — poster`} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={seoData.siteName} />
      <meta property="og:locale" content="en_US" />

      {/* TV Show-specific OpenGraph tags */}
      {tvShow.firstAirDate ? <meta property="video:release_date" content={tvShow.firstAirDate} /> : null}
      {(tvShow.genres || []).map((g) => (
        <meta key={g.name} property="video:tag" content={g.name} />
      ))}

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={twitterSiteMeta} />
      {twitterCreator ? (
        <meta
          name="twitter:creator"
          content={twitterCreator.startsWith('@') ? twitterCreator : `@${twitterCreator}`}
        />
      ) : null}
      <meta name="twitter:title" content={seoData.title} />
      <meta name="twitter:description" content={truncateText(seoData.description)} />
      <meta name="twitter:image" content={seoData.image} />
      <meta name="twitter:image:alt" content={`${tvShow.name} — poster`} />

      {/* Additional Meta Tags */}
      <meta name="keywords" content={`${tvShow.name}, ${seoData.genres}, TV show, series, streaming, ${seoData.year}`} />
      <meta name="robots" content="index, follow" />
      <meta name="author" content={siteName} />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLDWithUrl)}
      </script>
    </Helmet>
  );
};
