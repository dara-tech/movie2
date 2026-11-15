/**
 * Test script for Forgot Password feature
 * 
 * Usage: node test-forgot-password.js <email>
 * Example: node test-forgot-password.js user@example.com
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001';
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node test-forgot-password.js <email>');
  console.log('Example: node test-forgot-password.js user@example.com');
  process.exit(1);
}

async function testForgotPassword() {
  console.log('🧪 Testing Forgot Password Feature\n');
  console.log(`📧 Email: ${email}`);
  console.log(`🌐 API URL: ${API_URL}\n`);

  try {
    // Step 1: Request password reset
    console.log('Step 1: Requesting password reset...');
    const forgotResponse = await axios.post(`${API_URL}/api/auth/forgot-password`, {
      email: email
    });

    console.log('✅ Success!');
    console.log(`   Message: ${forgotResponse.data.message}\n`);

    // Note: In development, check server console for Ethereal Email preview URL
    console.log('📬 Check your server console for the email preview URL (if using Ethereal Email)');
    console.log('   Or check your email inbox if SMTP is configured.\n');

    console.log('✅ Forgot password test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Check server console for email preview URL (development mode)');
    console.log('   2. Click the reset link in the email');
    console.log('   3. Enter a new password');
    console.log('   4. Test login with the new password');

  } catch (error) {
    console.error('❌ Test failed!');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${error.response.data.error || error.response.data.message}`);
    } else if (error.request) {
      console.error('   No response from server. Is the server running?');
      console.error(`   Make sure the server is running on ${API_URL}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testForgotPassword();


