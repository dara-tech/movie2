require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
});

const tvShowDetail = require('./src/components/TVShowDetailPage.tsx');
console.log("TVShowDetailPage required successfully.");
