# Forgot Password Feature - Setup Guide

## Overview
The forgot password feature has been successfully implemented. Users can now request password reset links via email and reset their passwords securely.

## Features Implemented

### Backend
- ✅ Password reset token generation and storage
- ✅ Secure token hashing (SHA-256)
- ✅ Email service with HTML templates
- ✅ Token expiration (1 hour)
- ✅ Email enumeration protection
- ✅ Password validation

### Frontend
- ✅ Forgot Password page (`/forgot-password`)
- ✅ Reset Password page (`/reset-password`)
- ✅ Integration with Login page
- ✅ Success/error handling
- ✅ Responsive design matching app theme

## Setup Instructions

### 1. Email Configuration

#### Option A: Development (Ethereal Email - Recommended for Testing)
Ethereal Email is automatically used in development mode if `SMTP_HOST` is not set. It creates fake email accounts for testing.

**No configuration needed!** The system will automatically:
- Create a test account on first use
- Log credentials to console
- Show preview URLs in console

**To view emails:**
- Check server console for preview URL
- Or visit https://ethereal.email and login with credentials shown in console

#### Option B: Production (SMTP)
For production, configure SMTP settings in your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="MovieStream" <your-email@gmail.com>
```

**For Gmail:**
1. Enable 2-Factor Authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password (not your regular password) in `SMTP_PASS`

**For other email providers:**
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port 587
- **Yahoo**: `smtp.mail.yahoo.com`, port 587
- **Custom SMTP**: Use your provider's SMTP settings

### 2. Environment Variables

Add to your `.env` file:

```env
# Required for password reset
CLIENT_URL=http://localhost:3000  # Your frontend URL

# Email Configuration (choose one)
# Option 1: SMTP (Production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="MovieStream" <your-email@gmail.com>

# Option 2: Ethereal (Development - auto-configured)
# Leave SMTP_HOST empty to use Ethereal Email
```

### 3. Database Migration

The User model has been updated with password reset fields:
- `passwordResetToken` - Hashed reset token
- `passwordResetExpires` - Token expiration timestamp

**No migration needed** - Mongoose will automatically add these fields to existing documents.

## Usage Flow

1. **User clicks "Forgot Password?" on login page**
2. **User enters email address** on `/forgot-password` page
3. **System sends email** with reset link (valid for 1 hour)
4. **User clicks link** in email → redirects to `/reset-password?token=...`
5. **User enters new password** and confirms
6. **Password is updated** and user can login

## API Endpoints

### POST `/api/auth/forgot-password`
Request a password reset link.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### POST `/api/auth/reset-password`
Reset password using token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "new-password-here"
}
```

**Response:**
```json
{
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

## Security Features

1. **Token Hashing**: Reset tokens are hashed before storage (SHA-256)
2. **Token Expiration**: Tokens expire after 1 hour
3. **One-Time Use**: Tokens are cleared after successful password reset
4. **Email Enumeration Protection**: Same response whether email exists or not
5. **Password Validation**: Minimum 6 characters required
6. **Secure Token Generation**: Uses crypto.randomBytes(32)

## Testing

### Test in Development
1. Start the server: `npm run dev`
2. Navigate to `/forgot-password`
3. Enter a registered email
4. Check server console for Ethereal Email preview URL
5. Click the link in the preview
6. Reset password

### Test Email Template
The email includes:
- Professional HTML template
- Plain text fallback
- Reset link with token
- Expiration warning
- Security notice

## Troubleshooting

### Email not sending?
1. **Check SMTP credentials** in `.env`
2. **Check server console** for error messages
3. **For Gmail**: Make sure you're using an App Password, not regular password
4. **For development**: Check console for Ethereal Email preview URL

### Token invalid/expired?
- Tokens expire after 1 hour
- Tokens are single-use (cleared after reset)
- Request a new reset link if expired

### Email not received?
1. Check spam folder
2. Verify email address is correct
3. Check SMTP configuration
4. For development, use Ethereal Email preview URL

## Files Modified/Created

### Backend
- `server/models/User.js` - Added password reset fields
- `server/routes/auth.js` - Added forgot/reset password routes
- `server/services/emailService.js` - New email service

### Frontend
- `client/src/components/ForgotPassword.tsx` - New component
- `client/src/components/ResetPassword.tsx` - New component
- `client/src/components/Login.tsx` - Added forgot password link
- `client/src/App.tsx` - Added routes

### Configuration
- `env.example` - Added email configuration examples

## Next Steps (Optional Enhancements)

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **Password Strength**: Add more password requirements
3. **Email Templates**: Customize email design further
4. **Logging**: Add audit logging for password resets
5. **2FA Integration**: Add two-factor authentication option

---

**Note**: Make sure to configure email settings before deploying to production!


