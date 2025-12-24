const fs = require('fs');

// Read the current file
const filePath = 'src/components/EventMap/index.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the renderEventList function and add view counts after the distance display
// Look for the specific pattern in the renderEventList function
const searchPattern = /(const renderEventList[\s\S]*?{distance !== null && \(\s*<div className="flex items-center gap-1">\s*<Navigation className="w-3 h-3" \/>\s*<span>{distance\.toFixed\(1\)} miles away<\/span>\s*<\/div>\s*\)}\s*<\/div>)/;

const replacement = content.replace(searchPattern, (match) => {
  return match + `
              
              {/* Event interaction counts */}
              <div className="flex items-center justify-between mt-3 gap-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs">
                  <span>👁</span>
                  <span className="font-medium">
                    {(event.view_count || 0).toLocaleString()} view{(event.view_count || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs">
                  <span>❤️</span>
                  <span className="font-medium">
                    {(event.interest_count || 0).toLocaleString()} interested
                  </span>
                </div>
              </div>`;
});

// Write back to file
fs.writeFileSync(filePath, replacement);

console.log('View counts added successfully!'); 