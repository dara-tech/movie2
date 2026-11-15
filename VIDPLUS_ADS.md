# VidPlus.to Ad Blocking Information

## Research Results

After researching VidPlus.to documentation and embed parameters, here are the findings:

### ❌ Cannot Disable Ads via API

**VidPlus.to does NOT provide any parameter to disable ads** in their embed player. The available customization parameters are:

- `primaryColor` - Player primary color (hex)
- `subtitleColor` - Subtitle color (hex)  
- `autoplay` - Enable/disable autoplay (1 or 0)
- Controls visibility settings

### Current Implementation

Our code already uses all available VidPlus parameters:
```javascript
// Example URL generated:
https://player.vidplus.to/embed/movie/{tmdbId}?autoplay=1&primaryColor=dc2626
```

### Options to Handle Ads

#### 1. **Client-Side Ad Blockers** (Recommended)
Users can install browser extensions to block ads:
- **uBlock Origin** - Free, open-source ad blocker
- **AdBlock Plus** - Popular ad blocker
- **Video Ad Blocker Plus** - Specifically for video ads

**Note**: Some streaming services may detect ad blockers and restrict content.

#### 2. **Alternative Streaming Providers**
Consider using other providers that might have fewer ads:
- **Vidsrc.to** - Alternative provider (already implemented as fallback)
- **GodrivePlayer** - Another option (already implemented)
- **MultiEmbed** - Multiple sources (already implemented)

#### 3. **Iframe Sandbox Attributes**
We can add sandbox attributes to limit iframe behavior, but this **will NOT block ads**:
```html
<iframe sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>
```

### Recommendation

**For Users:**
- Install a browser ad blocker extension (uBlock Origin recommended)
- The ads are from VidPlus, not our application

**For Developers:**
- Keep VidPlus as default (it's the most reliable)
- Maintain fallback options (Vidsrc, GodrivePlayer, MultiEmbed)
- Consider adding a note in the UI about ad blockers

### References

- VidPlus Documentation: https://vidplus.to/#docs
- Current Implementation: `server/services/vidsrcService.js`

