# Watchtower AB Business Site

Professional business landing page for Watchtower AB, showcasing all company products and services.

## Overview

This is a static HTML/CSS/JavaScript website that serves as the master page for Watchtower AB (inc), featuring:

- **TodoEvents** - Event discovery and management platform
- **MissionOps** - Advanced project planning and risk management
- **Premium & Enterprise Services** - Enhanced features and support
- Professional company information and contact details

## Features

- Modern, responsive design that works on all devices
- Professional branding with gradient highlights
- Smooth scrolling navigation
- Interactive contact form
- Mobile-first responsive design
- SEO optimized with proper meta tags
- Professional typography using Inter font
- Animated elements and micro-interactions

## Required Images

To complete the site, please provide the following images:

### Logo & Icons
- `images/watchtower-logo.svg` - Main Watchtower AB logo (SVG format preferred)
- `images/todoevents-icon.svg` - TodoEvents product icon
- `images/missionops-icon.svg` - MissionOps product icon  
- `images/premium-icon.svg` - Premium/Enterprise services icon
- `favicon.ico` - Site favicon

### Hero Background
- `images/hero-background.jpg` - Professional technology/workspace image (1920x1080px minimum)
  - Suggestions: Modern office space, technology workspace, team collaboration, or abstract tech background
  - Should convey professionalism, innovation, and technology

### Content Images
- `images/enterprise-dashboard.png` - Screenshot or mockup of enterprise dashboard (1200x800px)
- `images/team-workspace.jpg` - Professional team/office photo (800x600px)

### Image Specifications
- **Format**: JPG for photos, SVG for logos/icons, PNG for screenshots
- **Quality**: High resolution, web-optimized
- **Style**: Professional, modern, consistent with brand colors (blues: #3C92FF, #2684FF)

## File Structure

```
business-site/
├── index.html          # Main landing page
├── styles.css          # All CSS styles
├── script.js           # JavaScript functionality
├── README.md           # This file
├── favicon.ico         # Site icon
└── images/             # Image assets
    ├── watchtower-logo.svg
    ├── todoevents-icon.svg
    ├── missionops-icon.svg
    ├── premium-icon.svg
    ├── hero-background.jpg
    ├── enterprise-dashboard.png
    └── team-workspace.jpg
```

## Setup Instructions

1. **Create Images Directory**:
   ```bash
   mkdir business-site/images
   ```

2. **Add Image Files**: Place all required images in the `images/` directory according to the specifications above.

3. **Serve the Site**: 
   - For local development: Use any static file server
   - For production: Deploy to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)

## Deployment Options

### Static Hosting Services
- **Netlify**: Drag and drop the `business-site` folder
- **Vercel**: Connect GitHub repo and deploy
- **GitHub Pages**: Push to repo and enable Pages
- **AWS S3**: Upload files and configure static website hosting
- **Cloudflare Pages**: Connect repo for automatic deployments

### Custom Domain Setup
After deployment, you can configure a custom domain like `watchtower-ab.com` or `company.todo-events.com`.

## Customization

### Colors
The site uses a professional blue color scheme:
- Primary Blue: `#3C92FF`
- Secondary Blue: `#2684FF`
- Accent Gold: `#FFD700` / `#FFA500`
- Dark: `#1a1a1a`
- Light Gray: `#f8f9fa`

### Content Updates
- Company information in the "About" section
- Product descriptions and features
- Contact information and response times
- Legal links and policies

### Contact Form
The contact form uses `mailto:` functionality. For production use, consider integrating with:
- Formspree
- Netlify Forms
- AWS SES
- Custom backend API

## Brand Guidelines

- **Typography**: Inter font family for modern, professional appearance
- **Spacing**: Consistent 120px section padding, 4rem internal spacing
- **Buttons**: Rounded corners (12px), gradient backgrounds, hover animations
- **Cards**: 20px border radius, subtle shadows, hover effects
- **Icons**: Lucide icon style, consistent sizing

## Performance

- Optimized CSS with efficient selectors
- Minimal JavaScript for functionality
- Lazy loading ready for images
- Mobile-first responsive design
- Fast loading static assets

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Responsive design for all screen sizes
- Graceful degradation for older browsers

## Legal Compliance

- Links to TodoEvents legal pages
- Proper copyright attribution
- Commercial license compliance
- Privacy policy references

---

**Watchtower AB, Inc.**  
Email: support@todo-events.com  
Licensed under TODO-EVENTS COMMERCIAL LICENSE AGREEMENT