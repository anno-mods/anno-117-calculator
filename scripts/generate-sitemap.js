#!/usr/bin/env node

/**
 * Generate sitemap.xml with current date
 * Run: node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://anno-mods.github.io/anno-117-calculator/';
const OUTPUT_PATH = path.join(__dirname, '..', 'sitemap.xml');

// Get current date in ISO format (YYYY-MM-DD)
const getCurrentDate = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

// Supported languages
const LANGUAGES = [
  'en',
  'de',
  'fr',
  'es',
  'it',
  'pl',
  'pt-BR',
  'ru',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko'
];

// Generate sitemap XML
const generateSitemap = () => {
  const lastmod = getCurrentDate();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${BASE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
`;

  // Add hreflang links for all languages
  LANGUAGES.forEach(lang => {
    xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}"/>\n`;
  });

  // Add default language
  xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}"/>\n`;

  xml += `  </url>
</urlset>
`;

  return xml;
};

// Write sitemap to file
const writeSitemap = () => {
  try {
    const sitemap = generateSitemap();
    fs.writeFileSync(OUTPUT_PATH, sitemap, 'utf8');
    console.log(`✓ Sitemap generated successfully: ${OUTPUT_PATH}`);
    console.log(`  Last modified: ${getCurrentDate()}`);
  } catch (error) {
    console.error('✗ Error generating sitemap:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  writeSitemap();
}

module.exports = { generateSitemap, writeSitemap };
