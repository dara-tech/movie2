# 🤖 Telegram Bot Setup Guide

This guide will help you set up Telegram notifications for new movies and TV shows.

## 📋 Prerequisites

- A Telegram account
- Access to your server's `.env` file

## 🚀 Step-by-Step Setup

### Step 1: Create a Telegram Bot

1. **Open Telegram** and search for `@BotFather`
2. **Start a conversation** with BotFather
3. **Send the command**: `/newbot`
4. **Follow the prompts**:
   - Choose a name for your bot (e.g., "MovieStream Notifications")
   - Choose a username (must end with `bot`, e.g., `moviestream_notifications_bot`)
5. **Copy the bot token** that BotFather gives you (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Step 2: Get Your Chat ID

**Option A: Using @userinfobot (Easiest)**

1. Search for `@userinfobot` on Telegram
2. Start a conversation
3. The bot will send you your Chat ID (a number like `123456789`)

**Option B: Using API (For Group Chats)**

1. Add your bot to a group (if you want group notifications)
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":123456789}` in the response
5. Use that number as your `TELEGRAM_CHAT_ID`

**Option C: Using @getidsbot**

1. Search for `@getidsbot` on Telegram
2. Start a conversation
3. The bot will show your Chat ID

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

**Important:**
- Replace `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` with your actual bot token
- Replace `123456789` with your actual chat ID
- For group chats, use the group's chat ID (negative number)

### Step 4: Test the Bot

1. **Restart your server** to load the new environment variables
2. **Trigger a sync** (manually or wait for auto-sync)
3. **Check Telegram** - you should receive a notification when a new movie/TV show is added

## 📱 What You'll Receive

When a new movie or TV show is added, you'll get a message like:

**For Movies:**
```
🎬 New Movie Added!

📽️ The Matrix (1999)

⭐ Rating: 8.7/10
🎭 Genres: Action, Sci-Fi
📅 Release: 1999

A computer hacker learns from mysterious rebels about the true nature of his reality...

🔗 Watch Now →
```

**For TV Shows:**
```
📺 New TV Show Added!

🎭 Game of Thrones (2011)

⭐ Rating: 8.9/10
🎭 Genres: Drama, Fantasy
📅 First Air: 2011
📊 Seasons: 8

Nine noble families fight for control over the lands of Westeros...

🔗 Watch Now →
```

The message includes:
- ✅ Poster image (if available)
- ✅ Title and year
- ✅ Rating
- ✅ Genres
- ✅ Description
- ✅ Direct link to watch

## 🔧 Troubleshooting

### Bot Not Sending Messages?

1. **Check environment variables**:
   ```bash
   # Make sure they're set correctly
   echo $TELEGRAM_BOT_TOKEN
   echo $TELEGRAM_CHAT_ID
   ```

2. **Check server logs**:
   - Look for "Telegram bot not configured" warnings
   - Check for any error messages

3. **Test manually**:
   ```bash
   # In Node.js console or test script
   const telegramService = require('./server/services/telegramService');
   telegramService.sendMessage('Test message');
   ```

4. **Verify bot token**:
   - Make sure the token is correct (no extra spaces)
   - Token format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

5. **Verify chat ID**:
   - For personal chats: positive number
   - For group chats: negative number
   - Make sure you've sent at least one message to the bot first

### Getting "Unauthorized" Error?

- Your bot token is incorrect
- Regenerate token from @BotFather using `/token`

### Getting "Chat Not Found" Error?

- Your chat ID is incorrect
- Make sure you've started a conversation with the bot
- For groups, make sure the bot is added to the group

### Not Receiving Notifications?

- Check if sync is actually creating new movies (not just updating existing ones)
- Check server logs for Telegram errors
- Make sure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in production environment

## 🎯 Features

- ✅ Automatic notifications for new movies
- ✅ Automatic notifications for new TV shows
- ✅ Poster images included
- ✅ Direct links to watch pages
- ✅ Rich formatting with emojis
- ✅ Rating and genre information
- ✅ Graceful error handling (won't break sync if Telegram fails)

## 📝 Notes

- Notifications only send for **new** movies/TV shows (not updates)
- If Telegram service fails, it won't break the sync process
- Images are loaded from TMDB CDN
- Links point to your configured `CLIENT_URL` or `SITE_URL`

## 🔒 Security

- **Never commit** your bot token to version control
- Keep your `.env` file secure
- Use environment variables in production
- Consider using a separate bot for production vs development

---

**Need Help?** Check the server logs for detailed error messages.

