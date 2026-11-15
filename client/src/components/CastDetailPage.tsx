import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import { truncateText, getOgImageMimeType, getOgImageSecureUrl } from '../lib/seoUtils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Film, 
  Tv, 
  Star, 
  TrendingUp,
  ExternalLink,
  Award
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { moviePath } from '../utils/paths';

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string;
  deathday: string | null;
  placeOfBirth: string;
  profilePath: string;
  knownForDepartment: string;
  popularity: number;
  knownFor: MovieCredit[];
  filmography: MovieCredit[];
  directingCredits: MovieCredit[];
  stats: {
    totalMovies: number;
    totalShows: number;
    averageRating: string | null;
  };
  externalIds: {
    imdb_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
}

interface MovieCredit {
  id: number; // TMDB ID
  tmdbId?: number;
  _id?: string; // Our database ID
  inDatabase?: boolean;
  title: string;
  posterPath: string;
  releaseDate: string;
  voteAverage: number;
  character?: string;
  job?: string;
  popularity?: number;
}

const CastDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFilms, setExpandedFilms] = useState(false);
  const [expandedDirecting, setExpandedDirecting] = useState(false);

  const fetchPersonDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/cast/${id}`);
      setPerson(response.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPersonDetails();
  }, [fetchPersonDetails]);

  const calculateAge = (birthday: string, deathday: string | null) => {
    const birth = new Date(birthday);
    const end = deathday ? new Date(deathday) : new Date();
    const age = end.getFullYear() - birth.getFullYear();
    const monthDiff = end.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
      return age - 1;
    }
    return age;
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Person not found</h1>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const siteUrl =
    process.env.REACT_APP_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://moviestream.cc');
  const canonicalUrl = `${siteUrl.replace(/\/$/, '')}${location.pathname}`;
  const profileImage = person.profilePath
    ? `https://image.tmdb.org/t/p/w780${person.profilePath}`
    : `${siteUrl.replace(/\/$/, '')}/placeholder-movie.jpg`;
  const ogDesc = truncateText(
    person.biography || `${person.name} — filmography and credits on MovieStream.`,
    200
  );
  const ogImageMime = getOgImageMimeType(profileImage);
  const ogImageSecure = getOgImageSecureUrl(profileImage);
  const rawTw = (process.env.REACT_APP_TWITTER_SITE || '').trim();
  const twSite = rawTw ? (rawTw.startsWith('@') ? rawTw : `@${rawTw}`) : '@MovieStream';

  return (
    <div className="min-h-screen bg-black">
      <Helmet>
        <title>{`${person.name} | MovieStream`}</title>
        <meta name="description" content={ogDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${person.name} | MovieStream`} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="MovieStream" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:image" content={profileImage} />
        {ogImageSecure ? <meta property="og:image:secure_url" content={ogImageSecure} /> : null}
        <meta property="og:image:type" content={ogImageMime} />
        <meta property="og:image:width" content="780" />
        <meta property="og:image:height" content="1170" />
        <meta property="og:image:alt" content={`${person.name} — headshot`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={twSite} />
        <meta name="twitter:title" content={`${person.name} | MovieStream`} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={profileImage} />
        <meta name="twitter:image:alt" content={`${person.name} — headshot`} />
      </Helmet>
      {/* Hero Section */}
      <div className="relative h-[50vh] sm:h-[55vh] md:h-[60vh] bg-gradient-to-b from-gray-900 to-black">
        {person.profilePath && (
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(https://image.tmdb.org/t/p/w1920${person.profilePath})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        )}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 h-full flex items-end pb-6 sm:pb-8 md:pb-12">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 items-start sm:items-end w-full">
            {/* Profile Image */}
            <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-64 lg:h-64 rounded-none overflow-hidden border-2 sm:border-4 border-gray-800 shadow-2xl flex-shrink-0">
              {person.profilePath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w780${person.profilePath}`}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center text-3xl sm:text-4xl md:text-6xl text-gray-700 font-black">
                  {person.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="mb-3 sm:mb-4 rounded-none border-gray-700 text-white hover:bg-gray-900 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Back
              </Button>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 uppercase tracking-wider break-words">
                {person.name}
              </h1>
              <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 items-center text-gray-400">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Film className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm uppercase tracking-wide">{person.knownForDepartment}</span>
                </div>
                {person.birthday && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">{calculateAge(person.birthday, person.deathday)} years old</span>
                  </div>
                )}
                {person.placeOfBirth && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm truncate">{person.placeOfBirth}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12 space-y-8 sm:space-y-10 md:space-y-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-black border border-gray-800 rounded-none">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Total Movies</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{person.stats.totalMovies}</p>
                </div>
                <Film className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-blue-600 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black border border-gray-800 rounded-none">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Total Shows</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{person.stats.totalShows}</p>
                </div>
                <Tv className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-purple-600 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black border border-gray-800 rounded-none sm:col-span-2 md:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Average Rating</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {person.stats.averageRating || 'N/A'}
                  </p>
                </div>
                <Star className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-yellow-600 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Biography */}
        {person.biography && (
          <div>
            <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 md:w-16 h-0.5 bg-red-600"></div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Biography</h2>
            </div>
            <Card className="bg-black border border-gray-800 rounded-none">
              <CardContent className="p-4 sm:p-6 md:p-8">
                <p className="text-gray-300 leading-relaxed text-sm sm:text-base md:text-lg whitespace-pre-line">
                  {person.biography}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Known For */}
        {person.knownFor.length > 0 && (
          <div>
            <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 md:w-16 h-0.5 bg-red-600"></div>
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Known For</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {person.knownFor.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => movie._id && navigate(moviePath({ _id: movie._id, title: movie.title }))}
                  className={`group bg-black border ${movie._id ? 'border-gray-800 hover:border-red-600 cursor-pointer' : 'border-gray-900 opacity-60'} rounded-none overflow-hidden transition-all duration-300 ${movie._id ? 'hover:scale-105' : 'cursor-not-allowed'}`}
                >
                  <div className="aspect-[3/4] w-full relative overflow-hidden bg-gray-950">
                    {movie.posterPath ? (
                      <>
                        <img
                          src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                          srcSet={`https://image.tmdb.org/t/p/w300${movie.posterPath} 300w, https://image.tmdb.org/t/p/w500${movie.posterPath} 500w, https://image.tmdb.org/t/p/w780${movie.posterPath} 780w`}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          alt={movie.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-2xl sm:text-3xl md:text-4xl font-black">
                        {movie.title.charAt(0)}
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-black/80 px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1">
                      <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-white text-[10px] sm:text-xs font-bold">{movie.voteAverage.toFixed(1)}</span>
                    </div>
                    {!movie._id && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-red-600/90 px-1.5 sm:px-2 py-0.5 sm:py-1">
                        <span className="text-white text-[9px] sm:text-xs font-bold uppercase">Not Available</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3 border-t border-gray-900">
                    <h4 className={`font-bold text-xs sm:text-sm mb-0.5 sm:mb-1 uppercase tracking-wide truncate transition-colors ${movie._id ? 'text-white group-hover:text-red-600' : 'text-gray-600'}`}>
                      {movie.title}
                    </h4>
                    <p className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-wide truncate">{movie.character}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filmography */}
        {person.filmography.length > 0 && (
          <div>
            <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
              <div className="w-8 sm:w-12 md:w-16 h-0.5 bg-red-600"></div>
              <Film className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Filmography</h2>
              <div className="hidden sm:block flex-1 h-px bg-gray-800"></div>
              <span className="text-gray-500 text-xs sm:text-sm uppercase tracking-wide">{person.filmography.length} Roles</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {(expandedFilms ? person.filmography : person.filmography.slice(0, 12)).map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => movie._id && navigate(moviePath({ _id: movie._id, title: movie.title }))}
                  className={`group bg-black border ${movie._id ? 'border-gray-800 hover:border-red-600 cursor-pointer' : 'border-gray-900 opacity-60'} rounded-none overflow-hidden transition-all duration-300 ${movie._id ? 'hover:scale-105' : 'cursor-not-allowed'}`}
                >
                  <div className="aspect-[3/4] w-full relative overflow-hidden bg-gray-950">
                    {movie.posterPath ? (
                      <>
                        <img
                          src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                          srcSet={`https://image.tmdb.org/t/p/w300${movie.posterPath} 300w, https://image.tmdb.org/t/p/w500${movie.posterPath} 500w, https://image.tmdb.org/t/p/w780${movie.posterPath} 780w`}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          alt={movie.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-2xl sm:text-3xl md:text-4xl font-black">
                        {movie.title.charAt(0)}
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-black/80 px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1">
                      <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-white text-[10px] sm:text-xs font-bold">{movie.voteAverage.toFixed(1)}</span>
                    </div>
                    {!movie._id && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-red-600/90 px-1.5 sm:px-2 py-0.5 sm:py-1">
                        <span className="text-white text-[9px] sm:text-xs font-bold uppercase">Not Available</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3 border-t border-gray-900">
                    <h4 className={`font-bold text-xs sm:text-sm mb-0.5 sm:mb-1 uppercase tracking-wide truncate transition-colors ${movie._id ? 'text-white group-hover:text-red-600' : 'text-gray-600'}`}>
                      {movie.title}
                    </h4>
                    <p className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-wide truncate">{movie.character || movie.job}</p>
                  </div>
                </div>
              ))}
            </div>
            {person.filmography.length > 12 && (
              <div className="flex justify-center mt-6 sm:mt-8">
                <Button
                  onClick={() => setExpandedFilms(!expandedFilms)}
                  className="bg-black border border-gray-800 hover:border-red-600 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-none uppercase tracking-wide font-bold transition-all text-xs sm:text-sm"
                >
                  {expandedFilms ? 'Show Less' : `View All Films (${person.filmography.length})`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Directing Credits */}
        {person.directingCredits.length > 0 && (
          <div>
            <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
              <div className="w-8 sm:w-12 md:w-16 h-0.5 bg-red-600"></div>
              <Award className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Directed By</h2>
              <div className="hidden sm:block flex-1 h-px bg-gray-800"></div>
              <span className="text-gray-500 text-xs sm:text-sm uppercase tracking-wide">{person.directingCredits.length} Films</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {(expandedDirecting ? person.directingCredits : person.directingCredits.slice(0, 12)).map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => movie._id && navigate(moviePath({ _id: movie._id, title: movie.title }))}
                  className={`group bg-black border ${movie._id ? 'border-gray-800 hover:border-blue-600 cursor-pointer' : 'border-gray-900 opacity-60'} rounded-none overflow-hidden transition-all duration-300 ${movie._id ? 'hover:scale-105' : 'cursor-not-allowed'}`}
                >
                  <div className="aspect-[3/4] w-full relative overflow-hidden bg-gray-950">
                    {movie.posterPath ? (
                      <>
                        <img
                          src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`}
                          srcSet={`https://image.tmdb.org/t/p/w300${movie.posterPath} 300w, https://image.tmdb.org/t/p/w500${movie.posterPath} 500w, https://image.tmdb.org/t/p/w780${movie.posterPath} 780w`}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          alt={movie.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700 text-2xl sm:text-3xl md:text-4xl font-black">
                        {movie.title.charAt(0)}
                      </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-black/80 px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1">
                      <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-white text-[10px] sm:text-xs font-bold">{movie.voteAverage.toFixed(1)}</span>
                    </div>
                    {!movie._id && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-red-600/90 px-1.5 sm:px-2 py-0.5 sm:py-1">
                        <span className="text-white text-[9px] sm:text-xs font-bold uppercase">Not Available</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3 border-t border-gray-900">
                    <h4 className={`font-bold text-xs sm:text-sm mb-0.5 sm:mb-1 uppercase tracking-wide truncate transition-colors ${movie._id ? 'text-white group-hover:text-blue-600' : 'text-gray-600'}`}>
                      {movie.title}
                    </h4>
                    <p className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-wide">{movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            {person.directingCredits.length > 12 && (
              <div className="flex justify-center mt-6 sm:mt-8">
                <Button
                  onClick={() => setExpandedDirecting(!expandedDirecting)}
                  className="bg-black border border-gray-800 hover:border-blue-600 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-none uppercase tracking-wide font-bold transition-all text-xs sm:text-sm"
                >
                  {expandedDirecting ? 'Show Less' : `View All Directing Credits (${person.directingCredits.length})`}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Social Links */}
        {(person.externalIds.imdb_id || person.externalIds.instagram_id || person.externalIds.twitter_id || person.externalIds.facebook_id) && (
          <div>
            <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="w-8 sm:w-12 md:w-16 h-0.5 bg-red-600"></div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Follow</h2>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              {person.externalIds.imdb_id && (
                <Button
                  onClick={() => window.open(`https://www.imdb.com/name/${person.externalIds.imdb_id}`, '_blank')}
                  className="bg-black border border-gray-800 hover:border-yellow-600 text-white rounded-none uppercase tracking-wide text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  IMDB
                </Button>
              )}
              {person.externalIds.instagram_id && (
                <Button
                  onClick={() => window.open(`https://www.instagram.com/${person.externalIds.instagram_id}`, '_blank')}
                  className="bg-black border border-gray-800 hover:border-pink-600 text-white rounded-none uppercase tracking-wide text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Instagram
                </Button>
              )}
              {person.externalIds.twitter_id && (
                <Button
                  onClick={() => window.open(`https://twitter.com/${person.externalIds.twitter_id}`, '_blank')}
                  className="bg-black border border-gray-800 hover:border-blue-600 text-white rounded-none uppercase tracking-wide text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Twitter
                </Button>
              )}
              {person.externalIds.facebook_id && (
                <Button
                  onClick={() => window.open(`https://www.facebook.com/${person.externalIds.facebook_id}`, '_blank')}
                  className="bg-black border border-gray-800 hover:border-blue-600 text-white rounded-none uppercase tracking-wide text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Facebook
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CastDetailPage;
