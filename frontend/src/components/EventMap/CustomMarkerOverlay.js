// Custom marker overlay that completely bypasses Google Maps markers
// This gives us full control over rendering without Google Maps interference

export class CustomMarkerOverlay extends google.maps.OverlayView {
  constructor(position, icon, count = 1, categories = [], onClick = null) {
    super();
    this.position = position;
    this.icon = icon;
    this.count = count;
    this.categories = categories;
    this.onClick = onClick;
    this.div = null;
  }

  onAdd() {
    // Create the custom marker element
    this.div = document.createElement('div');
    this.div.style.position = 'absolute';
    this.div.style.cursor = 'pointer';
    this.div.style.width = '80px';
    this.div.style.height = '80px';
    this.div.style.zIndex = '1000';
    
    // Determine if this is a cluster or single marker
    if (this.count > 1 && this.categories.length > 0) {
      this.renderCluster();
    } else {
      this.renderSingle();
    }

    // Add click handler
    if (this.onClick) {
      this.div.addEventListener('click', this.onClick);
    }

    // Add to map
    const panes = this.getPanes();
    panes.overlayMouseTarget.appendChild(this.div);
  }

  renderSingle() {
    const category = this.categories[0] || { id: 'all', markerColor: '#6B7280' };
    const iconHtml = this.getIconSVG(category);
    
    this.div.innerHTML = `
      <div style="
        width: 80px; 
        height: 80px; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        pointer-events: all;
      ">
        ${iconHtml}
      </div>
    `;
  }

  renderCluster() {
    // Check if all categories are the same
    const firstCategoryId = this.categories[0]?.id;
    const allSameCategory = this.categories.every(cat => cat.id === firstCategoryId);
    
    console.log(`🔄 Rendering cluster: ${this.count} events, categories:`, this.categories.map(c => c.id));
    console.log(`🔍 All same category (${firstCategoryId}):`, allSameCategory);
    
    if (allSameCategory && this.count >= 2) {
      // Show multiple icons of the same type
      console.log(`✨ Showing ${this.count} duplicate icons for category: ${firstCategoryId}`);
      this.renderDuplicateIcons();
    } else {
      // Show single dominant icon
      const dominantCategory = this.categories[0] || { id: 'all', markerColor: '#6B7280' };
      console.log(`📍 Showing single icon for dominant category: ${dominantCategory.id}`);
      const iconHtml = this.getIconSVG(dominantCategory);
      
      this.div.innerHTML = `
        <div style="
          width: 80px; 
          height: 80px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          pointer-events: all;
        ">
          ${iconHtml}
        </div>
      `;
    }
  }

  renderDuplicateIcons() {
    const category = this.categories[0];
    const iconCount = Math.min(4, Math.max(2, Math.floor(this.count / 2)));
    
    let positions = [];
    if (iconCount === 2) {
      positions = [{ x: 15, y: 15 }, { x: 45, y: 45 }];
    } else if (iconCount === 3) {
      positions = [{ x: 15, y: 15 }, { x: 45, y: 15 }, { x: 30, y: 45 }];
    } else {
      positions = [{ x: 15, y: 15 }, { x: 45, y: 15 }, { x: 15, y: 45 }, { x: 45, y: 45 }];
    }

    const duplicateIcons = positions.map(pos => `
      <div style="
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        width: 24px;
        height: 24px;
        transform: translate(-50%, -50%);
      ">
        ${this.getIconSVG(category, 24)}
      </div>
    `).join('');

    this.div.innerHTML = `
      <div style="
        width: 80px; 
        height: 80px; 
        position: relative;
        pointer-events: all;
      ">
        ${duplicateIcons}
      </div>
    `;
  }

  getIconSVG(category, size = 32) {
    const icons = {
      'food-drink': '🍽️',
      'music': '🎵', 
      'arts': '🎨',
      'sports': '🏆',
      'automotive': '🚗',
      'airshows': '✈️',
      'community': '👥',
      'religious': '⛪',
      'education': '📚',
      'networking': '💻',
      'all': '📍'
    };

    const emoji = icons[category.id] || icons['all'];
    const color = category.markerColor || '#6B7280';

    return `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, ${color}80, ${color});
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.55}px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        font-family: 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
        font-weight: normal;
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent 50%);
          border-radius: 50%;
        "></div>
        <span style="
          z-index: 2;
          position: relative;
          line-height: 1;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">${emoji}</span>
      </div>
    `;
  }

  draw() {
    const overlayProjection = this.getProjection();
    const pixel = overlayProjection.fromLatLngToDivPixel(this.position);
    
    if (this.div) {
      this.div.style.left = (pixel.x - 40) + 'px';
      this.div.style.top = (pixel.y - 40) + 'px';
    }
  }

  onRemove() {
    if (this.div) {
      this.div.parentNode.removeChild(this.div);
      this.div = null;
    }
  }

  setPosition(position) {
    this.position = position;
    this.draw();
  }
}

// Cluster manager for custom overlays
export class CustomClusterManager {
  constructor(map, markers = [], options = {}) {
    this.map = map;
    this.markers = markers;
    this.overlays = [];
    this.gridSize = options.gridSize || 60;
    this.maxZoom = options.maxZoom || 15;
  }

  clearOverlays() {
    this.overlays.forEach(overlay => {
      overlay.setMap(null);
    });
    this.overlays = [];
  }

  addMarkers(markers) {
    this.markers = markers;
    this.updateClusters();
  }

  updateClusters() {
    this.clearOverlays();
    
    const zoom = this.map.getZoom();
    if (zoom > this.maxZoom) {
      // Show individual markers at high zoom
      this.markers.forEach(marker => {
        const overlay = new CustomMarkerOverlay(
          marker.position,
          marker.icon,
          1,
          [marker.category],
          marker.onClick
        );
        overlay.setMap(this.map);
        this.overlays.push(overlay);
      });
      return;
    }

    // Group markers into clusters
    const clusters = this.createClusters();
    
    clusters.forEach(cluster => {
      const overlay = new CustomMarkerOverlay(
        cluster.center,
        null,
        cluster.markers.length,
        cluster.markers.map(m => m.category),
        () => {
          // On cluster click, zoom in or show events
          if (cluster.markers.length === 1) {
            cluster.markers[0].onClick();
          } else {
            this.map.setZoom(this.map.getZoom() + 2);
            this.map.setCenter(cluster.center);
          }
        }
      );
      overlay.setMap(this.map);
      this.overlays.push(overlay);
    });
  }

  createClusters() {
    const clusters = [];
    const processed = new Set();
    
    console.log(`🏗️ Creating clusters from ${this.markers.length} markers`);
    
    this.markers.forEach((marker, index) => {
      if (processed.has(index)) return;
      
      const cluster = {
        center: marker.position,
        markers: [marker]
      };
      
      // Find nearby markers
      this.markers.forEach((otherMarker, otherIndex) => {
        if (index === otherIndex || processed.has(otherIndex)) return;
        
        const distance = this.getPixelDistance(marker.position, otherMarker.position);
        if (distance < this.gridSize) {
          cluster.markers.push(otherMarker);
          processed.add(otherIndex);
        }
      });
      
      processed.add(index);
      
      // Calculate cluster center
      if (cluster.markers.length > 1) {
        const avgLat = cluster.markers.reduce((sum, m) => sum + m.position.lat, 0) / cluster.markers.length;
        const avgLng = cluster.markers.reduce((sum, m) => sum + m.position.lng, 0) / cluster.markers.length;
        cluster.center = { lat: avgLat, lng: avgLng };
      }
      
      const categoryIds = cluster.markers.map(m => m.category.id);
      console.log(`📦 Cluster created: ${cluster.markers.length} markers, categories: [${categoryIds.join(', ')}]`);
      
      clusters.push(cluster);
    });
    
    console.log(`✅ Total clusters created: ${clusters.length}`);
    return clusters;
  }

  getPixelDistance(pos1, pos2) {
    const projection = this.map.getProjection();
    const pixel1 = projection.fromLatLngToPoint(new google.maps.LatLng(pos1.lat, pos1.lng));
    const pixel2 = projection.fromLatLngToPoint(new google.maps.LatLng(pos2.lat, pos2.lng));
    
    const scale = Math.pow(2, this.map.getZoom());
    const dx = (pixel1.x - pixel2.x) * scale;
    const dy = (pixel1.y - pixel2.y) * scale;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
} 