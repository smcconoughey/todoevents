# Render Deployment Guide - watchtowerab.com

Complete guide for deploying your Watchtower AB business site to Render with custom domain setup.

## 🚀 **Quick Deploy to Render**

### **Option 1: GitHub Auto-Deploy (Recommended)**

1. **Push to GitHub**:
   ```bash
   # In your repository root
   git add business-site/
   git commit -m "Add Watchtower AB business site"
   git push origin main
   ```

2. **Connect to Render**:
   - Go to [render.com](https://render.com)
   - Click "New +" → "Static Site"
   - Connect your GitHub repository
   - Select your repository

3. **Configure Deployment**:
   - **Name**: `watchtowerab-business-site`
   - **Root Directory**: `business-site`
   - **Build Command**: `echo "No build required"`
   - **Publish Directory**: `./`

### **Option 2: Manual Upload**

1. **Create ZIP file**:
   ```bash
   cd business-site
   zip -r watchtowerab-site.zip .
   ```

2. **Upload to Render**:
   - Go to [render.com](https://render.com)  
   - Click "New +" → "Static Site"
   - Choose "Upload from computer"
   - Upload your ZIP file

## 🌐 **Custom Domain Setup**

### **Step 1: Configure Domain in Render**

1. **In Render Dashboard**:
   - Go to your static site
   - Click "Settings"
   - Scroll to "Custom Domains"
   - Add domains:
     - `watchtowerab.com`
     - `www.watchtowerab.com`

### **Step 2: Configure DNS**

**Point your domain registrar DNS to Render:**

```
Type: CNAME
Name: @
Value: [your-render-site].onrender.com

Type: CNAME  
Name: www
Value: [your-render-site].onrender.com
```

**OR use A Records (if CNAME @ not supported):**

```
Type: A
Name: @
Value: 216.24.57.1

Type: CNAME
Name: www
Value: watchtowerab.com
```

### **Step 3: SSL Certificate**

- Render automatically provisions SSL certificates
- HTTPS will be enabled within 5-10 minutes
- Force HTTPS redirects are automatic

## ⚙️ **render.yaml Configuration**

The included `render.yaml` provides:

### **Static Site Settings**
```yaml
env: static                    # Static site hosting
buildCommand: echo "No build" # No build process needed
staticPublishPath: ./          # Serve from root directory
```

### **Custom Domains**
```yaml
domains:
  - watchtowerab.com
  - www.watchtowerab.com
```

### **Security Headers**
```yaml
headers:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - X-XSS-Protection: 1; mode=block
```

### **Performance Caching**
```yaml
# 1 year cache for static assets
Cache-Control: public, max-age=31536000, immutable
# Applied to: .css, .js, .svg, .ico, .png, .jpg
```

### **URL Redirects**
```yaml
# www to non-www redirect
www.watchtowerab.com → watchtowerab.com
```

## 📁 **File Structure for Render**

```
business-site/
├── render.yaml              ✅ Render configuration
├── index.html               ✅ Main site
├── styles.css               ✅ Styles
├── script.js                ✅ JavaScript
├── sitemap.xml              ✅ SEO
├── robots.txt               ✅ Search engines
├── _redirects               ✅ Netlify compat (ignored)
├── [FAVICON FILES]          📸 Add your favicons
└── images/
    ├── [PRIORITY IMAGES]    📸 Add your images
    └── [ICONS]              ✅ Placeholder SVGs
```

## 🔧 **Environment Settings**

### **Build Settings**
- **Build Command**: `echo "No build required for static site"`
- **Publish Directory**: `./` (current directory)
- **Root Directory**: `business-site` (if in subdirectory)

### **Advanced Settings**
- **Auto-Deploy**: `Yes` (for GitHub integration)
- **Branch**: `main` or `master`
- **Environment**: `Node 18` (default, not used for static)

## 📊 **Performance Optimizations**

### **Automatic Features**
- ✅ **Global CDN**: Render uses a global CDN
- ✅ **Gzip Compression**: Automatic compression
- ✅ **HTTP/2**: Modern protocol support
- ✅ **SSL/TLS**: Free SSL certificates
- ✅ **DDoS Protection**: Built-in security

### **Manual Optimizations**
- ✅ **Cache Headers**: 1-year caching for assets
- ✅ **Security Headers**: XSS, CSRF protection
- ✅ **Image Optimization**: Provide optimized images

## 🔍 **SEO Configuration**

### **Already Configured**
- ✅ **Canonical URLs**: `https://watchtowerab.com`
- ✅ **Meta Tags**: Title, description, keywords
- ✅ **Open Graph**: Social media sharing
- ✅ **JSON-LD**: Structured data
- ✅ **Sitemap**: `/sitemap.xml`
- ✅ **Robots**: `/robots.txt`

### **After Deployment**
1. **Google Search Console**:
   - Add property: `https://watchtowerab.com`
   - Submit sitemap: `https://watchtowerab.com/sitemap.xml`

2. **Analytics** (Optional):
   - Add Google Analytics 4
   - Add Facebook Pixel (if needed)

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Domain Not Working**
- Check DNS propagation: `dig watchtowerab.com`
- Wait 24-48 hours for full DNS propagation
- Verify DNS settings in domain registrar

#### **SSL Certificate Issues**
- Domain must be pointed to Render first
- SSL provisioning takes 5-10 minutes
- Check "Custom Domains" in Render dashboard

#### **Build Failures**
- For static sites, build should be: `echo "No build required"`
- Ensure `staticPublishPath: ./`
- Check file permissions

#### **Images Not Loading**
- Verify images are in `/images/` directory
- Check file paths start with `/` (e.g., `/images/hero.jpg`)
- Ensure image files are properly uploaded

### **Support Resources**
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Status Page**: [status.render.com](https://status.render.com)
- **Support**: [render.com/support](https://render.com/support)

## 💰 **Pricing**

### **Render Static Site**
- **Free Tier**: Available for static sites
- **Pro Tier**: $7/month for advanced features
- **Custom Domains**: Free on all tiers
- **SSL Certificates**: Free on all tiers
- **CDN**: Included on all tiers

### **Bandwidth**
- **Free**: 100 GB/month
- **Pro**: 1 TB/month
- **Additional**: $0.10/GB

## 🔄 **Deployment Process**

### **Initial Deploy**
1. Connect repository or upload files
2. Configure build settings
3. Deploy automatically
4. Add custom domains
5. Configure DNS
6. Wait for SSL provisioning

### **Updates**
- **Auto-Deploy**: Push to GitHub → Automatic deployment
- **Manual Deploy**: Re-upload files or trigger rebuild
- **Zero Downtime**: Render handles deployments seamlessly

---

## 🎯 **Quick Checklist**

### **Before Deploy**
- [ ] Add required images to `/images/` folder
- [ ] Test site locally
- [ ] Verify all links work
- [ ] Check mobile responsiveness

### **During Deploy**
- [ ] Configure Render static site
- [ ] Add custom domains
- [ ] Configure DNS at registrar
- [ ] Verify SSL certificate

### **After Deploy**
- [ ] Test watchtowerab.com and www.watchtowerab.com
- [ ] Submit to Google Search Console
- [ ] Test contact form emails
- [ ] Monitor performance and analytics

---

**🚀 Ready to deploy your professional Watchtower AB business site to Render!**

**Support**: support@todo-events.com