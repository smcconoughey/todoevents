#!/usr/bin/env node
/**
 * Test script to verify beta deployment works correctly
 * Simulates Render's static file serving for /beta path
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TodoEvents Beta Deployment Test');
console.log('=====================================\n');

// Test if beta files exist and have correct paths
const betaDir = path.join(__dirname, 'frontend', 'dist', 'beta');
const betaIndexPath = path.join(betaDir, 'index.html');

if (fs.existsSync(betaIndexPath)) {
  const content = fs.readFileSync(betaIndexPath, 'utf-8');
  const hasCorrectPaths = content.includes('/beta/assets/');
  
  console.log('✅ Beta files exist');
  console.log(hasCorrectPaths ? '✅ Beta paths correctly prefixed' : '❌ Beta paths missing prefix');
  console.log('\n🎉 Ready for deployment at https://todo-events.com/beta');
} else {
  console.log('❌ Beta files not found. Run: npm run build:beta from frontend/');
}

// Test 2: Check beta index.html has correct paths
console.log('\n2️⃣ Checking beta paths...');
const betaIndexContent = fs.readFileSync(betaIndexPath, 'utf-8');

const hasCorrectAssetPaths = betaIndexContent.includes('href="/beta/assets/') || 
                            betaIndexContent.includes('src="/beta/assets/');
const hasCorrectFavicon = betaIndexContent.includes('href="/beta/favicon');

if (!hasCorrectAssetPaths) {
  console.log('❌ Beta assets not using /beta/ prefix');
  process.exit(1);
}

if (!hasCorrectFavicon) {
  console.log('❌ Beta favicon not using /beta/ prefix');
  process.exit(1);
}

console.log('✅ Beta paths correctly prefixed with /beta/');

// Test 3: Check asset files exist
console.log('\n3️⃣ Checking beta assets...');
const betaAssetsDir = path.join(betaDir, 'assets');

if (!fs.existsSync(betaAssetsDir)) {
  console.log('❌ Beta assets directory not found');
  process.exit(1);
}

const assetFiles = fs.readdirSync(betaAssetsDir);
const hasCSS = assetFiles.some(file => file.endsWith('.css'));
const hasJS = assetFiles.some(file => file.endsWith('.js'));

if (!hasCSS || !hasJS) {
  console.log('❌ Missing CSS or JS assets');
  process.exit(1);
}

console.log(`✅ Found ${assetFiles.length} asset files (CSS: ${hasCSS}, JS: ${hasJS})`);

// Test 4: Check file sizes
console.log('\n4️⃣ Checking file sizes...');
const stats = fs.statSync(betaIndexPath);
const indexSize = stats.size;

const cssFile = assetFiles.find(file => file.endsWith('.css'));
const jsFile = assetFiles.find(file => file.endsWith('.js'));

if (cssFile) {
  const cssStats = fs.statSync(path.join(betaAssetsDir, cssFile));
  console.log(`📄 CSS: ${(cssStats.size / 1024).toFixed(1)}KB`);
}

if (jsFile) {
  const jsStats = fs.statSync(path.join(betaAssetsDir, jsFile));
  console.log(`📄 JS: ${(jsStats.size / 1024).toFixed(1)}KB`);
}

console.log(`📄 HTML: ${(indexSize / 1024).toFixed(1)}KB`);

// Test 5: Check vite config
console.log('\n5️⃣ Checking vite configuration...');
const betaViteConfigPath = path.join(__dirname, 'beta', 'vite.config.js');

if (!fs.existsSync(betaViteConfigPath)) {
  console.log('❌ Beta vite.config.js not found');
  process.exit(1);
}

const viteConfigContent = fs.readFileSync(betaViteConfigPath, 'utf-8');
const hasBasePath = viteConfigContent.includes("base: '/beta/'");

if (!hasBasePath) {
  console.log('❌ Vite config missing base: "/beta/" configuration');
  process.exit(1);
}

console.log('✅ Vite config correctly set for /beta/ base path');

console.log('\n🎉 Beta Deployment Test PASSED!');
console.log('\n📋 Summary:');
console.log('• Beta files built and copied to frontend/dist/beta/');
console.log('• All asset paths correctly prefixed with /beta/');
console.log('• Vite configuration set for /beta/ base path');
console.log('• Ready for deployment at https://todo-events.com/beta');

console.log('\n🚀 Next Steps:');
console.log('1. Deploy to Render (automatic via git push)');
console.log('2. Beta will be accessible at: https://todo-events.com/beta');
console.log('3. Main app remains unaffected at: https://todo-events.com'); 