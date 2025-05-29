#!/usr/bin/env node

/**
 * Sitemap Validation Script for todo-events.com
 * 
 * This script validates the sitemap.xml file to ensure:
 * - All URLs use the correct domain
 * - No broken internal references
 * - Proper XML format
 * - SEO best practices
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITEMAP_PATH = path.join(__dirname, 'public', 'sitemap.xml');
const CORRECT_DOMAIN = 'https://todo-events.com';
const WRONG_DOMAINS = [
  'https://todoevents.onrender.com',
  'http://localhost',
  'http://127.0.0.1'
];

const validateSitemap = async () => {
  console.log('🔍 Validating sitemap...');
  
  // Check if sitemap exists
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error('❌ Sitemap not found at:', SITEMAP_PATH);
    console.log('💡 Run: npm run generate-sitemap');
    process.exit(1);
  }
  
  // Read sitemap content
  const content = fs.readFileSync(SITEMAP_PATH, 'utf8');
  
  let issues = [];
  let warnings = [];
  let stats = {
    totalUrls: 0,
    correctDomain: 0,
    wrongDomain: 0,
    duplicates: [],
    highPriority: 0,
    imageSitemaps: 0
  };
  
  // Basic XML validation
  if (!content.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
    issues.push('Missing XML declaration');
  }
  
  if (!content.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    issues.push('Missing proper urlset declaration');
  }
  
  // Count URLs and check domains
  const urlMatches = content.match(/<loc>(.*?)<\/loc>/g) || [];
  stats.totalUrls = urlMatches.length;
  
  const urls = new Set();
  
  urlMatches.forEach(match => {
    const url = match.replace(/<\/?loc>/g, '');
    
    // Check for duplicates
    if (urls.has(url)) {
      stats.duplicates.push(url);
    }
    urls.add(url);
    
    // Check domain
    if (url.startsWith(CORRECT_DOMAIN)) {
      stats.correctDomain++;
    } else {
      stats.wrongDomain++;
      const wrongDomain = WRONG_DOMAINS.find(domain => url.startsWith(domain));
      if (wrongDomain) {
        issues.push(`Wrong domain found: ${url} (should start with ${CORRECT_DOMAIN})`);
      } else {
        issues.push(`Unknown domain: ${url}`);
      }
    }
  });
  
  // Check priorities
  const priorityMatches = content.match(/<priority>1\.0<\/priority>/g) || [];
  stats.highPriority = priorityMatches.length;
  
  // Check image sitemaps
  const imageMatches = content.match(/<image:image>/g) || [];
  stats.imageSitemaps = imageMatches.length;
  
  // Validate date format
  const dateMatches = content.match(/<lastmod>(.*?)<\/lastmod>/g) || [];
  dateMatches.forEach(match => {
    const date = match.replace(/<\/?lastmod>/g, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      warnings.push(`Invalid date format: ${date} (should be YYYY-MM-DD)`);
    }
  });
  
  // Check for essential pages
  const essentialPages = [
    `${CORRECT_DOMAIN}/`,
    `${CORRECT_DOMAIN}/?category=food-drink`,
    `${CORRECT_DOMAIN}/?category=music`,
    `${CORRECT_DOMAIN}/?category=arts`,
    `${CORRECT_DOMAIN}/?category=sports`,
    `${CORRECT_DOMAIN}/?category=community`
  ];
  
  essentialPages.forEach(page => {
    if (!content.includes(`<loc>${page}</loc>`)) {
      warnings.push(`Essential page missing: ${page}`);
    }
  });
  
  // Output results
  console.log('\n📊 Sitemap Statistics:');
  console.log(`   Total URLs: ${stats.totalUrls}`);
  console.log(`   Correct Domain: ${stats.correctDomain}`);
  console.log(`   Wrong Domain: ${stats.wrongDomain}`);
  console.log(`   High Priority Pages: ${stats.highPriority}`);
  console.log(`   Image Sitemaps: ${stats.imageSitemaps}`);
  console.log(`   Duplicates: ${stats.duplicates.length}`);
  
  // Report issues
  if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    issues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  if (stats.duplicates.length > 0) {
    console.log('\n🔄 Duplicate URLs:');
    stats.duplicates.forEach(url => console.log(`   • ${url}`));
  }
  
  // Final assessment
  if (issues.length === 0) {
    console.log('\n✅ Sitemap validation passed!');
    console.log(`🌐 Ready for submission to search engines:`);
    console.log(`   Google: https://search.google.com/search-console`);
    console.log(`   Bing: https://www.bing.com/webmasters`);
    console.log(`   Direct URL: ${CORRECT_DOMAIN}/sitemap.xml`);
  } else {
    console.log('\n❌ Sitemap validation failed!');
    console.log('💡 Fix the issues above and run validation again.');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.log('\n📝 Consider addressing the warnings for optimal SEO.');
  }
};

// Additional utility functions
const pingSearchEngines = () => {
  console.log('\n🔔 Ping Search Engines (run after deploying):');
  console.log(`   Google: https://www.google.com/ping?sitemap=${CORRECT_DOMAIN}/sitemap.xml`);
  console.log(`   Bing: https://www.bing.com/ping?sitemap=${CORRECT_DOMAIN}/sitemap.xml`);
};

const showQuickCommands = () => {
  console.log('\n🛠️  Quick Commands:');
  console.log('   Generate sitemap: npm run generate-sitemap');
  console.log('   Validate sitemap: npm run validate-sitemap');
  console.log('   Test online: https://www.xml-sitemaps.com/validate-xml-sitemap.html');
};

// Run validation
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  validateSitemap()
    .then(() => {
      pingSearchEngines();
      showQuickCommands();
    })
    .catch(error => {
      console.error('❌ Validation error:', error);
      process.exit(1);
    });
}

export { validateSitemap }; 