const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../services/emailService');

function buildAuthPayload(user, message) {
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '7d' }
  );

  return {
    message,
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
      preferences: user.preferences,
      profile: user.profile
    }
  };
}

async function generateUniqueUsername(baseUsername) {
  const cleanedBase = (baseUsername || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20) || 'user';

  let candidate = cleanedBase;
  let counter = 1;

  while (await User.findOne({ username: candidate })) {
    candidate = `${cleanedBase}${counter}`;
    counter += 1;
  }

  return candidate;
}

router.get('/google-config', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(404).json({ error: 'Google login is not configured' });
  }

  return res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      preferences: {
        assistantName: 'Alex',
        theme: 'light',
        language: 'en'
      }
    });
    
    await user.save();
    
    res.status(201).json(buildAuthPayload(user, 'User created successfully'));
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json(buildAuthPayload(user, 'Login successful'));
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Login or sign up with Google ID token
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }

    const tokenInfoResponse = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { id_token: idToken }
    });

    const {
      aud,
      email,
      email_verified: emailVerified,
      given_name: givenName,
      family_name: familyName,
      picture
    } = tokenInfoResponse.data || {};

    if (!email || emailVerified !== 'true') {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    if (process.env.GOOGLE_CLIENT_ID && aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Google token audience is invalid' });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      const usernameBase = email.split('@')[0] || givenName || 'user';
      const username = await generateUniqueUsername(usernameBase);
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        username,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        preferences: {
          assistantName: 'Alex',
          theme: 'light',
          language: 'en'
        },
        profile: {
          firstName: givenName,
          lastName: familyName,
          avatar: picture
        }
      });

      await user.save();
      return res.status(201).json(buildAuthPayload(user, 'Signed in with Google successfully'));
    }

    if (!user.profile) {
      user.profile = {};
    }
    if (givenName && !user.profile.firstName) {
      user.profile.firstName = givenName;
    }
    if (familyName && !user.profile.lastName) {
      user.profile.lastName = familyName;
    }
    if (picture && !user.profile.avatar) {
      user.profile.avatar = picture;
    }
    await user.save();

    return res.json(buildAuthPayload(user, 'Signed in with Google successfully'));
  } catch (error) {
    if (error.response?.status === 400) {
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
      preferences: user.preferences,
      profile: user.profile,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { preferences: { ...preferences } } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Forgot password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // Always return success message to prevent email enumeration
    // Don't reveal if email exists or not
    if (!user) {
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Set token and expiry (1 hour from now)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();
    
    // Send email with reset token (not the hash)
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.username);
    } catch (emailError) {
      // Clear the token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      return res.status(500).json({ 
        error: 'Failed to send password reset email. Please try again later.' 
      });
    }
    
    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password - Set new password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() } // Token not expired
    });
    
    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired password reset token' 
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update password and clear reset token
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    res.json({ 
      message: 'Password has been reset successfully. You can now login with your new password.' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
