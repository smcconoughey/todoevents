// Script to validate schema.org markup on event pages
const fetch = require('node-fetch');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const path = require('path');

const eventUrls = [
  'http://localhost:5173/e/buffalo-ny-canalside-fourth-of-july-fireworks-211298',
  'http://localhost:5173/e/fort-lauderdales-las-olas-beach-fourth-of-july-spectacular-211244',
  'http://localhost:5173/e/orlandos-lake-eola-park-fourth-of-july-fireworks-210824'
];

// Fields to validate
const requiredFields = [
  'url',
  'image',
  'eventStatus',
  'endDate',
  'performer',
  'offers',
  'organizer.url'
];

async function validateEventPage(url) {
  console.log(`\nValidating: ${url}`);
  
  try {
    let html;
    
    // Handle local file paths
    if (url.startsWith('file:') || url.endsWith('.html')) {
      const filePath = url.startsWith('file:') ? 
        url.replace('file://', '') : 
        path.resolve(process.cwd(), url);
      
      console.log(`Reading local file: ${filePath}`);
      html = fs.readFileSync(filePath, 'utf8');
    } else {
      // Fetch remote URL
      const response = await fetch(url);
      html = await response.text();
    }
    
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Find all JSON-LD scripts
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    if (scripts.length === 0) {
      console.log('❌ No JSON-LD scripts found');
      return;
    }
    
    let eventSchema = null;
    
    // Find the Event schema
    scripts.forEach(script => {
      try {
        const json = JSON.parse(script.textContent);
        if (json['@type'] === 'Event' || 
            json['@type'] === 'MusicEvent' || 
            json['@type'] === 'SportsEvent' ||
            json['@type'] === 'TheaterEvent') {
          eventSchema = json;
        }
      } catch (e) {
        console.log('❌ Error parsing JSON-LD:', e.message);
      }
    });
    
    if (!eventSchema) {
      console.log('❌ No Event schema found');
      return;
    }
    
    console.log('✅ Found Event schema');
    
    // Validate required fields
    let missingFields = [];
    
    for (const field of requiredFields) {
      if (field.includes('.')) {
        // Handle nested fields
        const [parent, child] = field.split('.');
        if (!eventSchema[parent] || !eventSchema[parent][child]) {
          missingFields.push(field);
        }
      } else if (!eventSchema[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields.join(', '));
    } else {
      console.log('✅ All required fields present');
    }
    
    // Display schema summary
    console.log('\nSchema Summary:');
    console.log('- Name:', eventSchema.name);
    console.log('- URL:', eventSchema.url);
    console.log('- Image:', eventSchema.image);
    console.log('- Start Date:', eventSchema.startDate);
    console.log('- End Date:', eventSchema.endDate || 'Missing');
    console.log('- Event Status:', eventSchema.eventStatus || 'Missing');
    console.log('- Performer:', eventSchema.performer ? eventSchema.performer.name : 'Missing');
    console.log('- Organizer:', eventSchema.organizer ? eventSchema.organizer.name : 'Missing');
    console.log('- Organizer URL:', eventSchema.organizer && eventSchema.organizer.url ? eventSchema.organizer.url : 'Missing');
    console.log('- Offers:', eventSchema.offers ? `${eventSchema.offers.price} ${eventSchema.offers.priceCurrency}` : 'Missing');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function main() {
  console.log('Schema.org Validation Tool');
  console.log('=========================');
  
  // Use a custom URL if provided as command line argument
  const customUrl = process.argv[2];
  
  if (customUrl) {
    await validateEventPage(customUrl);
  } else {
    // Validate default event URLs
    for (const url of eventUrls) {
      await validateEventPage(url);
    }
  }
}

main().catch(console.error); 