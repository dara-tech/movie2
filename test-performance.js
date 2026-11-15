#!/usr/bin/env node

/**
 * Performance Testing Script
 * Tests various performance metrics of the application
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkServer(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    protocol.get(url, (res) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      resolve({
        status: res.statusCode,
        responseTime,
        success: res.statusCode >= 200 && res.statusCode < 400
      });
      res.on('data', () => {}); // Consume response
      res.on('end', () => {});
    }).on('error', () => {
      resolve({ success: false, responseTime: null });
    });
  });
}

async function testAPISpeed() {
  log('\n📡 Testing API Response Times...', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  const endpoints = [
    { name: 'Health Check', url: 'http://localhost:5001/api/health' },
    { name: 'Movies List', url: 'http://localhost:5001/api/movies?limit=20' },
    { name: 'Genres', url: 'http://localhost:5001/api/genres' },
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    // Test 3 times and average
    const times = [];
    for (let i = 0; i < 3; i++) {
      const result = await checkServer(endpoint.url);
      if (result.success) {
        times.push(result.responseTime);
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests
    }
    
    if (times.length > 0) {
      const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
      const minTime = Math.min(...times).toFixed(2);
      const maxTime = Math.max(...times).toFixed(2);
      
      results.push({
        name: endpoint.name,
        avg: parseFloat(avgTime),
        min: parseFloat(minTime),
        max: parseFloat(maxTime)
      });
      
      const status = parseFloat(avgTime) < 200 ? 'green' : parseFloat(avgTime) < 500 ? 'yellow' : 'red';
      log(`  ${endpoint.name}:`, status);
      log(`    Average: ${avgTime}ms (min: ${minTime}ms, max: ${maxTime}ms)`, status);
    } else {
      log(`  ${endpoint.name}: Failed to connect`, 'red');
    }
  }
  
  return results;
}

function checkBundleSize() {
  log('\n📦 Checking Bundle Sizes...', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  const buildDir = path.join(__dirname, 'client', 'build', 'static', 'js');
  
  if (!fs.existsSync(buildDir)) {
    log('  Build directory not found. Run "cd client && npm run build" first', 'yellow');
    return null;
  }
  
  const files = fs.readdirSync(buildDir).filter(f => f.endsWith('.js'));
  let totalSize = 0;
  
  files.forEach(file => {
    const filePath = path.join(buildDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    totalSize += stats.size;
    
    const size = parseFloat(sizeKB);
    const status = size < 200 ? 'green' : size < 500 ? 'yellow' : 'red';
    log(`  ${file}: ${sizeKB} KB`, status);
  });
  
  const totalKB = (totalSize / 1024).toFixed(2);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
  log(`  Total: ${totalKB} KB (${totalMB} MB)`, totalSize < 1024 * 1024 ? 'green' : 'yellow');
  
  return {
    totalKB: parseFloat(totalKB),
    totalMB: parseFloat(totalMB),
    fileCount: files.length
  };
}

function checkDependencies() {
  log('\n📚 Checking Dependencies...', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', 'package.json'), 'utf8'));
    const depCount = Object.keys(packageJson.dependencies || {}).length;
    const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
    
    log(`  Production Dependencies: ${depCount}`, 'green');
    log(`  Dev Dependencies: ${devDepCount}`, 'green');
    
    return { depCount, devDepCount };
  } catch (error) {
    log('  Could not read package.json', 'red');
    return null;
  }
}

async function main() {
  log('\n🚀 Performance Testing', 'bold');
  log('═══════════════════════════════════════════════════════════', 'bold');
  
  // Check if servers are running
  log('\n🔍 Checking Server Status...', 'blue');
  const serverHealth = await checkServer('http://localhost:5001/api/health');
  const clientHealth = await checkServer('http://localhost:3000');
  
  if (!serverHealth.success) {
    log('  ✗ Backend server is not running on port 5001', 'red');
    log('  Start it with: cd server && npm start', 'yellow');
    return;
  } else {
    log('  ✓ Backend server is running', 'green');
  }
  
  if (!clientHealth.success) {
    log('  ✗ Frontend server is not running on port 3000', 'red');
    log('  Start it with: cd client && npm start', 'yellow');
    return;
  } else {
    log('  ✓ Frontend server is running', 'green');
  }
  
  // Run tests
  const apiResults = await testAPISpeed();
  const bundleInfo = checkBundleSize();
  const depInfo = checkDependencies();
  
  // Summary
  log('\n📊 Performance Summary', 'bold');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bold');
  
  if (apiResults && apiResults.length > 0) {
    const avgAPI = apiResults.reduce((sum, r) => sum + r.avg, 0) / apiResults.length;
    log(`  Average API Response Time: ${avgAPI.toFixed(2)}ms`, avgAPI < 200 ? 'green' : avgAPI < 500 ? 'yellow' : 'red');
  }
  
  if (bundleInfo) {
    log(`  Total Bundle Size: ${bundleInfo.totalKB.toFixed(2)} KB`, bundleInfo.totalKB < 500 ? 'green' : bundleInfo.totalKB < 1000 ? 'yellow' : 'red');
    log(`  Number of JS Files: ${bundleInfo.fileCount}`, 'green');
  }
  
  if (depInfo) {
    log(`  Total Dependencies: ${depInfo.depCount + depInfo.devDepCount}`, 'green');
  }
  
  log('\n💡 Tips for Better Performance:', 'yellow');
  log('  1. Use Lighthouse in Chrome DevTools for detailed analysis');
  log('  2. Check Network tab for duplicate requests');
  log('  3. Monitor Web Vitals in browser console');
  log('  4. Run: cd client && npm run build && npx webpack-bundle-analyzer build/static/js/*.js');
  log('  5. Test on PageSpeed Insights: https://pagespeed.web.dev/');
  log('');
  
  log('✅ Performance testing complete!', 'green');
  log('');
}

main().catch(console.error);
