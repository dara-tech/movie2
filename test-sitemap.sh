#!/bin/bash

# Test script to verify sitemap works for Googlebot
# This simulates how Google fetches your sitemap

echo "Testing sitemap as Googlebot would..."
echo ""

# Test 1: As Googlebot
echo "1. Testing as Googlebot User-Agent:"
curl -A "Googlebot/2.1 (+http://www.google.com/bot.html)" -s "https://moviestream.cc/sitemaps.xml" | head -20
echo ""
echo "---"
echo ""

# Test 2: As regular browser
echo "2. Testing as regular browser:"
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -s "https://moviestream.cc/sitemaps.xml" | head -20
echo ""
echo "---"
echo ""

# Test 3: As curl (no User-Agent)
echo "3. Testing as curl (no User-Agent):"
curl -s "https://moviestream.cc/sitemaps.xml" | head -20
echo ""
echo "---"
echo ""

# Test 4: Check Content-Type header
echo "4. Checking Content-Type header:"
curl -I -A "Googlebot/2.1" "https://moviestream.cc/sitemaps.xml" | grep -i "content-type"
echo ""

# Test 5: Verify it's valid XML
echo "5. Verifying XML validity:"
curl -s -A "Googlebot/2.1" "https://moviestream.cc/sitemaps.xml" | head -1 | grep -q "<?xml"
if [ $? -eq 0 ]; then
  echo "✅ Valid XML detected"
else
  echo "❌ NOT valid XML - this is the problem!"
fi
echo ""

echo "All tests complete. If all responses are identical XML, your sitemap is working correctly!"

