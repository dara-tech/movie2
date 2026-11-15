const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/moviestream');
  } catch (error) {
    process.exit(1);
  }
};

// Create admin users
const createAdminUsers = async () => {
  try {

    // Check if admin users already exist
    const existingAdmin = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (existingAdmin) {
      return;
    }

    // Create Super Admin
    const superAdminPassword = await bcrypt.hash('admin123', 10);
    const superAdmin = new User({
      username: 'superadmin',
      email: 'superadmin@moviestream.com',
      password: superAdminPassword,
      role: 'super_admin',
      isActive: true,
      preferences: {
        assistantName: 'Admin Assistant',
        theme: 'dark',
        language: 'en'
      },
      profile: {
        firstName: 'Super',
        lastName: 'Admin',
        bio: 'System Administrator'
      }
    });

    await superAdmin.save();

    // Create Regular Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      username: 'admin',
      email: 'admin@moviestream.com',
      password: adminPassword,
      role: 'admin',
      isActive: true,
      preferences: {
        assistantName: 'Admin Assistant',
        theme: 'dark',
        language: 'en'
      },
      profile: {
        firstName: 'Admin',
        lastName: 'User',
        bio: 'Content Administrator'
      }
    });

    await admin.save();

    // Create Test Regular User
    const userPassword = await bcrypt.hash('user123', 10);
    const user = new User({
      username: 'testuser',
      email: 'user@moviestream.com',
      password: userPassword,
      role: 'user',
      isActive: true,
      preferences: {
        assistantName: 'Alex',
        theme: 'dark',
        language: 'en'
      },
      profile: {
        firstName: 'Test',
        lastName: 'User',
        bio: 'Regular user for testing'
      }
    });

    await user.save();


  } catch (error) {
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await createAdminUsers();
  process.exit(0);
};

// Run the script
main();
