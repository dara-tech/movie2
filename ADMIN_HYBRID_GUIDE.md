# Admin Guide for Hybrid System

## Overview
The system now uses a hybrid approach where content is fetched from TMDB on-demand, and only user-specific data is stored in the database.

## What Changed

### ✅ Still Works (No Changes Needed)
- **User Management**: Manage users, roles, permissions
- **Watchlists**: Users can still add items to watchlist (now stores TMDB ID)
- **Watch History**: Tracks what users watched (now stores TMDB ID)
- **Genres**: Manage genres in database
- **Activity Logs**: Admin activity tracking

### 🔄 Updated Features

#### 1. Dashboard Statistics
- **Content Counts**: Now shows "cached" items (items stored in database)
- **Source Indicator**: Shows "TMDB (on-demand)" as content source
- **User Stats**: Still accurate from database
- **Engagement Stats**: Still accurate from database

#### 2. Content Management
**Before**: Managed all movies/TV shows in database
**Now**: 
- View content from TMDB (read-only browsing)
- Option to "cache" specific items to database
- Manage only cached/pinned items
- Delete only removes from database (not from TMDB)

#### 3. Sync Management
**Before**: Bulk sync all content to database
**Now**:
- **Selective Sync**: Choose specific items to cache
- **Featured Sync**: Auto-cache featured items
- **Clear Cache**: Clear hybrid service cache
- **No Bulk Sync**: Not needed anymore

## Database Storage Strategy

### What's Stored:
✅ **User Data**
- User accounts, authentication
- User preferences
- Admin activity logs

✅ **User Engagement**
- Watchlists (with TMDB IDs)
- Watch history (with TMDB IDs)
- User ratings/reviews

✅ **Genres**
- Genre definitions for mapping

✅ **Cached Content** (Optional)
- Featured/pinned items
- Custom content not in TMDB

### What's NOT Stored:
❌ Bulk movies/TV shows
❌ Popular/trending lists
❌ Search results

## Admin Actions

### Viewing Content
- Browse TMDB content via admin panel
- Search TMDB directly
- View cached items in database

### Caching Content
1. Find item in TMDB
2. Click "Cache to Database"
3. Item is stored for faster access
4. Can be managed like before

### Managing Cached Items
- Edit availability
- Add custom notes
- Delete from database (doesn't affect TMDB)

### User Data Management
- Watchlists: Shows TMDB ID if item not cached
- Watch History: Shows TMDB ID if item not cached
- Can still view all user engagement data

## Migration Notes

### Watchlist/History Models
- Now support both `movie`/`tvShow` references AND `tmdbId`
- Existing data still works
- New items can use TMDB ID directly

### No Data Loss
- Existing watchlists still work
- Existing watch history still works
- Can migrate gradually

## Benefits

✅ **Smaller Database**: Only user data stored
✅ **Always Fresh**: Content from TMDB is up-to-date
✅ **Faster**: No bulk syncs needed
✅ **Flexible**: Can still cache specific items
✅ **Scalable**: No database size limits

## Recommendations

1. **Keep Genres**: Still useful for mapping
2. **Cache Featured Items**: Cache popular/featured content for faster access
3. **Monitor TMDB API**: Check API health in sync management
4. **User Engagement**: Focus on user data analytics
5. **Selective Caching**: Only cache items you need to manage

## AI Control Panel

- Access the AI Control Center at `Admin > AI Control > Control Center`.
- Toggle Gemini-powered modules (recommendations, assistant, auto-curation, watch-party prompts).
- Edit prompt templates directly in the dashboard with preview-safe defaults.
- Configure guardrails (mature content, fallback messaging, token limits, blocked genres).
- Review real-time feedback and audit trail of AI changes for accountability.
- All updates are versioned with admin attribution and can be rolled back via the reset action.

