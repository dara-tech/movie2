#!/bin/bash
echo "🧪 Quick Sitemap Test"
echo "Make sure your server is running: npm start (in server directory)"
echo ""
echo "Testing sitemap with different Host headers..."
echo ""

# Test 1: Default (should use moviestream.cc)
echo "1️⃣  Default (no Host header):"
curl -s http://localhost:5001/sitemaps.xml 2>/dev/null | grep -o '<loc>[^<]*</loc>' | head -5
echo ""

# Test 2: freemovie.online
echo "2️⃣  With Host: freemovie.online"
curl -s -H 'Host: freemovie.online' http://localhost:5001/sitemaps.xml 2>/dev/null | grep -o '<loc>[^<]*</loc>' | head -5
echo ""

# Test 3: moviestream.cc
echo "3️⃣  With Host: moviestream.cc"
curl -s -H 'Host: moviestream.cc' http://localhost:5001/sitemaps.xml 2>/dev/null | grep -o '<loc>[^<]*</loc>' | head -5
echo ""

echo "✅ Check if URLs match the Host header!"
