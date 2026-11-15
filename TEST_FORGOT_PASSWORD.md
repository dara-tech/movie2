# Testing Forgot Password Feature

## Quick Test Guide

### Option 1: Manual Testing (Recommended)

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   - Go to `http://localhost:3000/login`
   - Click "Forgot Password?" link

3. **Enter a registered email:**
   - Use an email from an existing user account
   - Or create a test user first by registering

4. **Check server console:**
   - Look for: `📧 Using Ethereal Email for testing. Credentials:`
   - Look for: `📧 Password reset email sent! Preview URL:`
   - Copy the preview URL and open it in your browser

5. **Click the reset link:**
   - The preview URL will show the email
   - Click the "Reset Password" button in the email
   - Or copy the reset link from the email

6. **Reset your password:**
   - Enter a new password (min 6 characters)
   - Confirm the password
   - Click "Reset Password"

7. **Test login:**
   - Go back to login page
   - Login with your email and new password

### Option 2: Using Test Script

1. **Make sure server is running:**
   ```bash
   npm run dev
   ```

2. **Run the test script:**
   ```bash
   node test-forgot-password.js user@example.com
   ```
   Replace `user@example.com` with a registered email.

3. **Check server console** for email preview URL

4. **Follow steps 5-7** from Option 1

### Option 3: Using cURL

1. **Request password reset:**
   ```bash
   curl -X POST http://localhost:5001/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com"}'
   ```

2. **Check server console** for email preview URL

3. **Extract token from email** and reset password:
   ```bash
   curl -X POST http://localhost:5001/api/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{"token":"YOUR_TOKEN_HERE","password":"newpassword123"}'
   ```

## Test Scenarios

### ✅ Happy Path
1. User exists in database
2. Email sends successfully
3. User clicks reset link
4. User enters valid new password
5. Password resets successfully
6. User can login with new password

### ❌ Error Cases to Test

1. **Invalid Email:**
   - Enter non-existent email
   - Should still show success message (security)

2. **Expired Token:**
   - Wait 1 hour after receiving email
   - Try to use the reset link
   - Should show "Invalid or expired token"

3. **Used Token:**
   - Use a reset link twice
   - First use should work
   - Second use should fail

4. **Short Password:**
   - Enter password less than 6 characters
   - Should show validation error

5. **Mismatched Passwords:**
   - Enter different passwords in confirm field
   - Should show "Passwords do not match"

6. **Missing Token:**
   - Go to `/reset-password` without token
   - Should show error message

## Expected Console Output

When testing in development mode, you should see:

```
📧 Using Ethereal Email for testing. Credentials: {
  user: 'ethereal.user@ethereal.email',
  pass: 'ethereal-password-here'
}
📧 Password reset email sent! Preview URL: https://ethereal.email/message/...
```

## Test Users

If you need test users, you can:

1. **Register a new user** via the registration page
2. **Use existing admin users** (if created):
   - `superadmin@moviestream.com`
   - `admin@moviestream.com`
   - `user@moviestream.com`

   (Run `npm run create-admin` to create these)

## Troubleshooting

### Email not appearing in console?
- Make sure `NODE_ENV=development` in `.env`
- Make sure `SMTP_HOST` is not set (or empty)
- Check server logs for errors

### "Email service not configured" error?
- In development: This shouldn't happen (Ethereal is auto-configured)
- In production: Set SMTP credentials in `.env`

### Token not working?
- Check if token expired (1 hour limit)
- Check if token was already used
- Make sure you're using the full token from email

### Server not responding?
- Make sure server is running on port 5001
- Check `PORT` in `.env` file
- Check server console for errors

## Success Indicators

✅ **All working if:**
- Email request returns success message
- Server console shows email preview URL
- Reset link works and redirects to reset page
- Password reset completes successfully
- Can login with new password

---

**Ready to test?** Start your server and follow Option 1 above! 🚀


