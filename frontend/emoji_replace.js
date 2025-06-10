const fs = require('fs');
const path = require('path');

// Define emoji to WebIcon replacements
const emojiReplacements = {
  '📍': '<WebIcon emoji="📍" size={16} className="mr-2 inline" />',
  '📅': '<WebIcon emoji="📅" size={16} className="mr-2 inline" />',
  '🎯': '<WebIcon emoji="🎯" size={16} className="mr-2 inline" />',
  '💡': '<WebIcon emoji="💡" size={14} className="mr-1 inline" />',
  '☀️': '<WebIcon emoji="☀️" size={16} />',
  '🌙': '<WebIcon emoji="🌙" size={16} />',
  '🌆': '<WebIcon emoji="🌆" size={16} />',
  '⚙️': '<WebIcon emoji="⚙️" size={16} className="mr-2 inline" />',
  '🏷️': '<WebIcon emoji="🏷️" size={16} className="mr-2 inline" />',
  '🔍': '<WebIcon emoji="🔍" size={16} className="mr-2 inline" />',
  '🎨': '<WebIcon emoji="🎨" size={16} className="mr-2 inline" />',
  '🗺️': '<WebIcon emoji="🗺️" size={16} className="mr-2 inline" />',
  '🗣️': '<WebIcon emoji="🗣️" size={16} className="mr-2 inline" />',
  '🔗': '<WebIcon emoji="🔗" size={16} className="mr-2 inline" />',
  '📧': '<WebIcon emoji="📧" size={16} className="mr-2 inline" />',
  '🌟': '<WebIcon emoji="🌟" size={16} className="mr-2 inline" />',
  '🚀': '<WebIcon emoji="🚀" size={16} className="mr-2 inline" />',
  '⚠️': '<WebIcon emoji="⚠️" size={16} className="mr-2 inline" />'
};

// Function to replace emojis in specific patterns
function replaceEmojisInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  // Simple emoji replacements in JSX content
  Object.entries(emojiReplacements).forEach(([emoji, replacement]) => {
    // Replace standalone emojis in text
    const standalonePattern = new RegExp(`^(\\s*)${emoji}\\s+`, 'gm');
    newContent = newContent.replace(standalonePattern, `$1${replacement}\n$1`);
    
    // Replace emojis in labels and text
    const labelPattern = new RegExp(`>${emoji}\\s+([^<]+)<`, 'g');
    newContent = newContent.replace(labelPattern, `>${replacement}$1<`);
    
    // Replace emojis in icon properties
    const iconPattern = new RegExp(`icon:\\s*'${emoji}'`, 'g');
    newContent = newContent.replace(iconPattern, `icon: ${replacement}`);
  });
  
  // Special patterns for specific cases
  
  // Distance display pattern
  newContent = newContent.replace(
    /📍\s*\{([^}]+)\.toFixed\(1\)\}\s*miles away/g,
    '<WebIcon emoji="📍" size={14} className="mr-1" />\n                  {$1.toFixed(1)} miles away'
  );
  
  // Console log patterns (remove emojis from console logs)
  newContent = newContent.replace(/console\.log\('🎯[^']*'/g, "console.log('");
  newContent = newContent.replace(/console\.log\('📊[^']*'/g, "console.log('");
  
  // Canvas text patterns (remove emojis from canvas text)
  newContent = newContent.replace(/`📅\s*\$\{/g, '`${');
  newContent = newContent.replace(/`📍\s*\$\{/g, '`${');
  
  // Share text patterns (remove emojis from share text)
  newContent = newContent.replace(/📅\s*\$\{/g, '${');
  newContent = newContent.replace(/📍\s*\$\{/g, '${');
  
  fs.writeFileSync(filePath, newContent);
  console.log(`Updated: ${filePath}`);
}

// Files to process
const filesToProcess = [
  'src/components/EventMap/index.jsx',
  'src/components/WelcomePopup.jsx',
  'src/components/EventMap/MarkerStyleToggle.jsx'
];

console.log('Starting emoji replacement...');

filesToProcess.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    replaceEmojisInFile(fullPath);
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log('Emoji replacement complete!'); 