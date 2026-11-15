import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Enforce completely dark mode globally (no light mode)
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme', 'dark');
}

// Suppress known streaming service errors (VidPlus, Vidsrc proxy errors)
if (typeof window !== 'undefined') {
  // Intercept Performance API to prevent errors from ad scripts
  if (window.performance && window.performance.measure) {
    const originalMeasure = window.performance.measure.bind(window.performance);
    window.performance.measure = function(name: string, startMark?: string, endMark?: string) {
      try {
        // Check if the mark exists before measuring
        if (startMark) {
          const marks = window.performance.getEntriesByName(startMark, 'mark');
          if (marks.length === 0) {
            // Mark doesn't exist, silently fail (ad script error)
            return {} as PerformanceMeasure;
          }
        }
        if (endMark) {
          const marks = window.performance.getEntriesByName(endMark, 'mark');
          if (marks.length === 0) {
            // Mark doesn't exist, silently fail (ad script error)
            return {} as PerformanceMeasure;
          }
        }
        return originalMeasure(name, startMark, endMark);
      } catch (error: any) {
        // Suppress Performance API errors from ad scripts
        const errorMessage = error?.message || error?.toString() || '';
        if (errorMessage.includes('mark') || errorMessage.includes('measure') || 
            errorMessage.includes('hidden_iframe') || errorMessage.includes('roagrofoogrobo')) {
          return {} as PerformanceMeasure;
        }
        throw error;
      }
    };
  }

  const originalError = console.error;
  const originalWarn = console.warn;
  
  // List of error patterns to suppress (from VidPlus player, YouTube embeds, and ad networks)
  const suppressedPatterns = [
    /Origin.*is not allowed by Access-Control-Allow-Origin/i,
    /Failed to load resource.*status of 404.*(start|impression|firstQuartile|midpoint|thirdQuartile|clickTracking|pause|server|jwplayer\.stats)/i,
    /Failed to load resource.*status of (500|502|530).*(m3u8-proxy|ts-proxy)/i,
    /Blocked a frame with origin.*protocol/i,
    /Refused to execute.*X-Content-Type-Options/i,
    /does not appear in the worker-src directive/i,
    /ChunkLoadError.*jwplayer/i,
    /TypeError.*undefined is not an object.*evaluating.*show|hide/i,
    /AbortError.*The operation was aborted/i,
    // YouTube embedded player CORS errors (analytics/tracking requests)
    /Fetch API cannot load.*youtube\.com\/api\/stats/i,
    /Fetch API cannot load.*googlevideo\.com\/videoplayback/i,
    /XMLHttpRequest cannot load.*youtube\.com\/youtubei\/v1\/log_event/i,
    /XMLHttpRequest cannot load.*youtube\.com\/api\/stats/i,
    /due to access control checks.*youtube/i,
    /due to access control checks.*googlevideo/i,
    // Ad network errors (Performance API marks, ad script errors)
    /No mark named.*exists/i,
    /hidden_iframe:start/i,
    /hidden_iframe/i,
    /roagrofoogrobo\.com/i,
    /quge5\.com/i,
    /measure@\[native code\]/i,
    /Performance\.mark.*not found/i,
    /Performance\.measure/i,
    /Failed to execute.*measure.*on.*Performance/i,
  ];
  
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    // Only suppress if it matches known streaming service errors
    if (suppressedPatterns.some(pattern => pattern.test(message))) {
      return; // Suppress this error
    }
    originalError.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    // Suppress warnings about streaming services
    if (suppressedPatterns.some(pattern => pattern.test(message))) {
      return; // Suppress this warning
    }
    originalWarn.apply(console, args);
  };
  
  // Suppress unhandled promise rejections from streaming services
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason?.toString() || '';
    if (suppressedPatterns.some(pattern => pattern.test(reason))) {
      event.preventDefault(); // Suppress the error
      return;
    }
  });
  
  // Suppress global error events from YouTube, streaming services, and ad networks
  window.addEventListener('error', (event) => {
    const message = event.message || event.error?.message || '';
    const source = event.filename || '';
    const stack = event.error?.stack || '';
    
    // Check if error is from ad networks or Performance API
    const isAdNetworkError = suppressedPatterns.some(pattern => 
      pattern.test(message) || 
      pattern.test(stack) ||
      (source && (
        source.includes('youtube') || 
        source.includes('googlevideo') ||
        source.includes('roagrofoogrobo') ||
        source.includes('quge5')
      ))
    );
    
    if (isAdNetworkError) {
      event.preventDefault(); // Suppress the error
      event.stopPropagation(); // Stop error from bubbling
      return false; // Prevent default behavior
    }
  }, true); // Use capture phase to catch errors early

  // Also catch errors in the error event's error property
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const errorMessage = message?.toString() || '';
    const errorSource = source?.toString() || '';
    const errorStack = error?.stack?.toString() || '';
    
    if (suppressedPatterns.some(pattern => 
      pattern.test(errorMessage) || 
      pattern.test(errorStack) ||
      errorSource.includes('roagrofoogrobo') ||
      errorSource.includes('quge5')
    )) {
      return true; // Suppress the error
    }
    
    // Call original handler if exists
    if (originalOnError) {
      return originalOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };
}

// Register service worker (disabled in development to avoid cache issues)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { 
      updateViaCache: 'none' // Always check for updates, don't use cache
    })
      .then((registration) => {
        
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
        
        // Listen for new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                // New service worker activated, reload page
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((registrationError) => {
      });
  });
}

// Unregister service workers in development
if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
      }
      // Clear all caches
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      });
    });
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
