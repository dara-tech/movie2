const path = require('path');
const webpack = require('webpack');

// Remove react-refresh Babel plugin in production so (1) build doesn't throw on Vercel,
// (2) $RefreshSig$ is never injected (runtime is dev-only).
function removeReactRefreshFromBabelOptions(options) {
  if (!options || !Array.isArray(options.plugins)) return;
  options.plugins = options.plugins.filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !(typeof name === 'string' && name.includes('react-refresh'));
  });
}

function patchBabelReactRefresh(config, env) {
  if (env !== 'production') return;
  function visit(rules) {
    if (!Array.isArray(rules)) return;
    for (const rule of rules) {
      if (rule.oneOf) {
        visit(rule.oneOf);
        continue;
      }
      const use = rule.use;
      if (Array.isArray(use)) {
        for (const u of use) {
          const loader = typeof u === 'string' ? u : (u && u.loader);
          const opts = u && u.options;
          if (typeof loader === 'string' && loader.includes('babel') && opts) removeReactRefreshFromBabelOptions(opts);
        }
        continue;
      }
      const loader = rule.loader;
      if (typeof loader === 'string' && loader.includes('babel') && rule.options) removeReactRefreshFromBabelOptions(rule.options);
    }
  }
  if (config.module && config.module.rules) visit(config.module.rules);
}

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env }) => {
      patchBabelReactRefresh(webpackConfig, env);

      // In production, define React Refresh globals as no-ops so injected code never throws
      // (handles cached/build quirks where the Babel plugin still runs)
      if (env === 'production') {
        webpackConfig.plugins = webpackConfig.plugins || [];
        webpackConfig.plugins.push(
          new webpack.DefinePlugin({
            'typeof $RefreshSig$': JSON.stringify('function'),
            '$RefreshSig$': 'function() { return function(type) { return type; }; }',
            'typeof $RefreshReg$': JSON.stringify('function'),
            '$RefreshReg$': 'function() {}',
          })
        );
      }

      // Optimize build performance
      if (env === 'production') {
        // Disable source maps for faster builds (optional - remove if you need them)
        // webpackConfig.devtool = false;
        
        // Optimize chunk splitting
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          // Use faster minification
          minimize: true,
          // Split chunks more efficiently
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Vendor chunk
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20,
              },
              // Common chunk
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
                enforce: true,
              },
            },
          },
        };
      }
      
      // Speed up TypeScript compilation
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        // Reduce module resolution overhead
        symlinks: false,
        // Cache module resolution
        cache: true,
      };
      
      return webpackConfig;
    },
  },
  // Speed up TypeScript compilation
  typescript: {
    enableTypeChecking: false, // Disable type checking during build (faster, but less safe)
    // Or keep it but make it faster:
    // enableTypeChecking: process.env.NODE_ENV === 'production',
  },
};

