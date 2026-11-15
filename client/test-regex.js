const { pathToRegexp } = require('path-to-regexp');

const keys = [];
const regex = pathToRegexp('/sitemap-movies/:num.xml', keys);
console.log('Regex:', regex);
console.log('Keys:', keys);
console.log('Match /sitemap-movies/1.xml:', regex.exec('/sitemap-movies/1.xml'));
