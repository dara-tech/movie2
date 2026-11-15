# Hybrid System - Admin & Database Strategy

## Overview
With the hybrid fetch system, content is fetched from TMDB on-demand. This document outlines what should be stored in the database and how admin features should work.

## What to Store in Database

### ✅ MUST Store (User-Specific Data)
1. **Users & Authentication**
   - User accounts, passwords, roles
   - User preferences and settings
   - Admin activity logs

2. **User Engagement Data**
   - Watchlists (references to movies/TV shows by TMDB ID)
   - Watch history (what users watched, when, progress)
   - User ratings and reviews
   - Watch together rooms

3. **Genres**
   - Genre definitions (for mapping TMDB genres to your system)
   - Custom genres if needed

### ⚠️ OPTIONAL Store (Cached/Pinned Content)
1. **Featured/Pinned Content**
   - Movies/TV shows you want to always have available
   - Featured content for homepage
   - Custom content not in TMDB

2. **Custom Metadata**
   - Custom descriptions, tags
   - Internal notes
   - Availability overrides

### ❌ DON'T Store (Fetch from TMDB)
1. **Bulk Content**
   - All movies/TV shows (fetch on-demand)
   - Popular/trending lists (fetch from TMDB)
   - Search results (fetch from TMDB)

## Admin Features Strategy

### 1. Dashboard Statistics
**Current**: Counts from database
**New Approach**: 
- User stats: From database (accurate)
- Content stats: Show "Available via TMDB" or count cached items
- Engagement stats: From database (watchlists, history)

### 2. Content Management
**Current**: Manage all movies/TV shows in database
**New Approach**:
- **View Mode**: Browse TMDB content (read-only)
- **Cache Mode**: Pin specific items to database for faster access
- **Custom Content**: Add/edit items not in TMDB
- **Availability Override**: Hide/show specific TMDB items

### 3. Sync Management
**Current**: Bulk sync to database
**New Approach**:
- **Selective Sync**: Choose specific items to cache
- **Featured Sync**: Auto-cache featured/popular items
- **Clear Cache**: Clear hybrid service cache
- **TMDB Status**: Check TMDB API health

### 4. User Management
**No Changes**: Still manage users, roles, activity in database

### 5. Analytics
- **User Analytics**: From database (accurate)
- **Content Analytics**: From TMDB API or cached items
- **Engagement**: From database (watchlists, history)

## Database Schema Updates Needed

### Watchlist Model
```javascript
{
  user: ObjectId,
  tmdbId: Number,        // Store TMDB ID instead of reference
  type: 'movie' | 'tvshow',
  // ... rest stays same
}
```

### WatchHistory Model
```javascript
{
  user: ObjectId,
  tmdbId: Number,        // Store TMDB ID instead of reference
  type: 'movie' | 'tvshow',
  // ... rest stays same
}
```

### New: CachedContent Model (Optional)
```javascript
{
  tmdbId: Number,
  type: 'movie' | 'tvshow',
  cachedAt: Date,
  isFeatured: Boolean,
  customNotes: String,
  availabilityOverride: Boolean
}
```

## Migration Steps

1. **Update Watchlist/History Models**
   - Add `tmdbId` field
   - Keep `movie`/`tvShow` references for backward compatibility
   - Migrate existing data

2. **Update Admin Routes**
   - Content management: Show TMDB content with cache option
   - Dashboard: Update stats calculation
   - Sync: Update to selective caching

3. **Update Frontend**
   - Admin content management: Add "Cache from TMDB" button
   - Show TMDB vs Database indicator
   - Update stats display

4. **Clear Old Data (Optional)**
   - Remove bulk synced movies/TV shows
   - Keep only user-specific data
   - Keep genres

## Benefits

✅ **Smaller Database**: Only user data stored
✅ **Always Fresh**: Content from TMDB is up-to-date
✅ **Faster**: No bulk syncs needed
✅ **Flexible**: Can still cache specific items
✅ **Scalable**: No database size limits for content

