/**
 * Test script for Telegram Bot AI Chat
 * Simulates Telegram webhook messages to test the bot
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5001';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('🤖 Testing Telegram Bot AI Chat\n');
console.log(`🌐 API URL: ${API_URL}`);
console.log(`🔑 Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}\n`);

// Mock Telegram update object
function createMockUpdate(text, userId = 123456789, username = 'testuser') {
  return {
    update_id: Date.now(),
    message: {
      message_id: Math.floor(Math.random() * 1000),
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Test',
        username: username,
        language_code: 'en'
      },
      chat: {
        id: userId,
        first_name: 'Test',
        username: username,
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      text: text
    }
  };
}

async function testWebhookInfo() {
  console.log('📋 Test 1: Get Webhook Info');
  console.log('─'.repeat(50));
  try {
    const response = await axios.get(`${API_URL}/api/telegram/webhook-info`);
    console.log('✅ Success!');
    console.log('   Webhook Info:', JSON.stringify(response.data.data, null, 2));
    console.log('');
    return true;
  } catch (error) {
    console.log('❌ Failed!');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.message || error.response.data.error}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
    return false;
  }
}

async function testWebhookMessage(text) {
  console.log(`💬 Test 2: Send Message "${text}"`);
  console.log('─'.repeat(50));
  try {
    const update = createMockUpdate(text);
    const response = await axios.post(`${API_URL}/api/telegram/webhook`, update, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Webhook received successfully!');
    console.log(`   Response: ${JSON.stringify(response.data)}`);
    console.log('   ⚠️  Note: Check server logs to see if AI response was sent');
    console.log('');
    return true;
  } catch (error) {
    console.log('❌ Failed!');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.message || error.response.data.error}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
    return false;
  }
}

async function testCommands() {
  console.log('⌨️  Test 3: Test Commands');
  console.log('─'.repeat(50));
  
  const commands = ['/start', '/help', '/clear'];
  let successCount = 0;
  
  for (const cmd of commands) {
    try {
      const update = createMockUpdate(cmd);
      const response = await axios.post(`${API_URL}/api/telegram/webhook`, update, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`✅ ${cmd} - Webhook received`);
      successCount++;
    } catch (error) {
      console.log(`❌ ${cmd} - Failed: ${error.message}`);
    }
  }
  
  console.log(`\n   Results: ${successCount}/${commands.length} commands processed`);
  console.log('');
  return successCount === commands.length;
}

async function runTests() {
  console.log('🚀 Starting Telegram Bot Tests\n');
  
  // Test 1: Webhook Info
  await testWebhookInfo();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Commands
  await testCommands();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: AI Chat Messages
  await testWebhookMessage('Hello!');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testWebhookMessage('Recommend a good action movie');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testWebhookMessage('What is The Matrix about?');
  
  console.log('✅ All tests completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Check server logs for AI responses');
  console.log('   2. Set webhook URL in production:');
  console.log(`      POST ${API_URL}/api/telegram/set-webhook`);
  console.log('      Body: { "webhookUrl": "https://your-domain.com/api/telegram/webhook" }');
  console.log('   3. Or use ngrok for local testing:');
  console.log('      ngrok http 5001');
  console.log('      Then set webhook to: https://your-ngrok-url.ngrok.io/api/telegram/webhook');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});



