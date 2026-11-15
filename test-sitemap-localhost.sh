#!/bin/bash

# Test sitemap generation on localhost with different domain headers

echo "🧪 Testing Sitemap Generation on Localhost"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5001"

echo -e "${BLUE}1. Testing default localhost (should use default domain)${NC}"
echo "curl $BASE_URL/sitemaps.xml | head -30"
echo ""
curl -s "$BASE_URL/sitemaps.xml" | head -30
echo ""
echo "---"
echo ""

echo -e "${BLUE}2. Testing with Host: freemovie.online${NC}"
echo "curl -H 'Host: freemovie.online' $BASE_URL/sitemaps.xml | head -30"
echo ""
curl -s -H 'Host: freemovie.online' "$BASE_URL/sitemaps.xml" | head -30
echo ""
echo "---"
echo ""

echo -e "${BLUE}3. Testing with Host: moviestream.cc${NC}"
echo "curl -H 'Host: moviestream.cc' $BASE_URL/sitemaps.xml | head -30"
echo ""
curl -s -H 'Host: moviestream.cc' "$BASE_URL/sitemaps.xml" | head -30
echo ""
echo "---"
echo ""

echo -e "${BLUE}4. Testing sitemap_index.xml with freemovie.online${NC}"
echo "curl -H 'Host: freemovie.online' $BASE_URL/sitemap_index.xml | head -20"
echo ""
curl -s -H 'Host: freemovie.online' "$BASE_URL/sitemap_index.xml" | head -20
echo ""
echo "---"
echo ""

echo -e "${BLUE}5. Testing sitemap-movies.xml with freemovie.online${NC}"
echo "curl -H 'Host: freemovie.online' $BASE_URL/sitemap-movies.xml | head -30"
echo ""
curl -s -H 'Host: freemovie.online' "$BASE_URL/sitemap-movies.xml" | head -30
echo ""
echo "---"
echo ""

echo -e "${GREEN}✅ Testing complete!${NC}"
echo ""
echo "Check the URLs in the XML output above:"
echo "- Should show 'freemovie.online' when Host header is set"
echo "- Should show 'moviestream.cc' when Host header is moviestream.cc"
echo "- Should show default domain when no Host header"
