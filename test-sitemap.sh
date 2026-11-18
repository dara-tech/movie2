#!/bin/bash

# Test script to verify sitemap works for Googlebot
# This simulates how Google fetches your sitemap

echo "Testing sitemap as Googlebot would..."
echo ""

# Test 1: As Googlebot
echo "1. Testing as Googlebot User-Agent:"
curl -L -A "Googlebot/2.1 (+http://www.google.com/bot.html)" -s "https://www.moviestream.cc/sitemaps.xml" | head -20
echo ""
echo "---"
echo ""

# Test 2: As regular browser
echo "2. Testing as regular browser:"
curl -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -s "https://www.moviestream.cc/sitemaps.xml" | head -20
echo ""
echo "---"
echo ""

# Test 3: As curl (no User-Agent)
echo "3. Testing as curl (no User-Agent):"
curl -L -s "https://www.moviestream.cc/sitemaps.xml" | head -20
echo ""
echo "---"
echo ""

# Test 4: Check Content-Type header
echo "4. Checking Content-Type header:"
curl -I -L -A "Googlebot/2.1" "https://www.moviestream.cc/sitemaps.xml" | grep -i "content-type"
echo ""

# Test 5: Verify it's valid XML
echo "5. Verifying XML validity:"
curl -s -L -A "Googlebot/2.1" "https://www.moviestream.cc/sitemaps.xml" | head -1 | grep -q "<?xml"
if [ $? -eq 0 ]; then
  echo "✅ Valid XML detected"
else
  echo "❌ NOT valid XML - this is the problem!"
fi
echo ""

echo "All tests complete. If all responses are identical XML, your sitemap is working correctly!"

