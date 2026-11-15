#!/bin/bash

# Performance Testing Script
# This script helps test the application's performance using various tools

echo "🚀 Performance Testing Script"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo "📡 Checking if server is running..."
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server is running on port 5001"
else
    echo -e "${RED}✗${NC} Server is not running on port 5001"
    echo "Please start the server first: cd server && npm start"
    exit 1
fi

# Check if client is running
echo "🌐 Checking if client is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Client is running on port 3000"
else
    echo -e "${RED}✗${NC} Client is not running on port 3000"
    echo "Please start the client first: cd client && npm start"
    exit 1
fi

echo ""
echo "📊 Performance Test Options:"
echo "1. Lighthouse CLI (requires: npm install -g lighthouse)"
echo "2. Web Vitals (check browser console)"
echo "3. Network Analysis (Chrome DevTools)"
echo "4. Bundle Size Analysis"
echo ""

# Check if lighthouse is installed
if command -v lighthouse &> /dev/null; then
    echo -e "${GREEN}✓${NC} Lighthouse CLI is installed"
    echo ""
    echo "Running Lighthouse performance audit..."
    lighthouse http://localhost:3000 \
        --only-categories=performance \
        --output=html \
        --output-path=./lighthouse-report.html \
        --chrome-flags="--headless" \
        --quiet
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Lighthouse report generated: lighthouse-report.html"
        echo "Open the report in your browser to view detailed metrics"
    else
        echo -e "${RED}✗${NC} Lighthouse audit failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} Lighthouse CLI not installed"
    echo "Install it with: npm install -g lighthouse"
    echo "Or use Lighthouse in Chrome DevTools (F12 > Lighthouse tab)"
fi

echo ""
echo "📦 Bundle Size Analysis:"
echo "Run this command to analyze bundle size:"
echo "  cd client && npm run build && npx webpack-bundle-analyzer build/static/js/*.js"
echo ""

echo "🌐 Web Vitals:"
echo "Open http://localhost:3000 in your browser"
echo "Open DevTools Console (F12) to see performance metrics"
echo ""

echo "📈 Network Analysis:"
echo "1. Open Chrome DevTools (F12)"
echo "2. Go to Network tab"
echo "3. Reload the page (Cmd/Ctrl + R)"
echo "4. Check:"
echo "   - Total requests count"
echo "   - Total transfer size"
echo "   - Load time"
echo "   - Duplicate requests (should be minimal with caching)"
echo ""

echo "✅ Performance testing complete!"
echo ""
echo "Target Metrics:"
echo "  - Performance Score: 90+"
echo "  - LCP (Largest Contentful Paint): <2.5s"
echo "  - FCP (First Contentful Paint): <1.8s"
echo "  - TBT (Total Blocking Time): <200ms"
echo "  - CLS (Cumulative Layout Shift): <0.1"
echo ""
