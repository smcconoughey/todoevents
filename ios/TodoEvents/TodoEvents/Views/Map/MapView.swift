import SwiftUI
import MapKit

/// Native iOS MapView using MapKit with glass-style controls
struct MapView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @StateObject private var mapViewModel = MapViewModel()
    @State private var selectedEvent: Event?
    @State private var showEventDetail = false
    @State private var zoomLevel: Double = 0.5 // 0 = zoomed out, 1 = zoomed in
    
    var body: some View {
        ZStack {
            // Main Map
            Map(coordinateRegion: $mapViewModel.region, showsUserLocation: true, annotationItems: eventsViewModel.filteredEvents) { event in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng)) {
                    EventMarkerView(event: event) {
                        selectedEvent = event
                        showEventDetail = true
                    }
                }
            }
            .ignoresSafeArea(edges: .all)
            .onAppear {
                mapViewModel.requestLocationPermission()
            }
            .onReceive(mapViewModel.$userLocation.compactMap { $0 }) { location in
                eventsViewModel.userLocation = location
                Task {
                    await eventsViewModel.fetchEvents(at: location)
                }
            }
            
            // Controls Overlay
            VStack {
                HStack {
                    Spacer()
                    
                    // Map Control Buttons - Glass Style
                    VStack(spacing: 0) {
                        GlassButton(icon: "location.fill") {
                            mapViewModel.centerOnUser()
                        }
                        
                        Divider()
                            .frame(width: 36)
                            .background(.white.opacity(0.2))
                        
                        GlassButton(icon: "arrow.clockwise") {
                            Task {
                                await eventsViewModel.fetchEvents()
                            }
                        }
                        
                        Divider()
                            .frame(width: 36)
                            .background(.white.opacity(0.2))
                        
                        GlassButton(icon: "plus") {
                            zoomIn()
                        }
                        
                        Divider()
                            .frame(width: 36)
                            .background(.white.opacity(0.2))
                        
                        GlassButton(icon: "minus") {
                            zoomOut()
                        }
                    }
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
                    .padding(.trailing, 12)
                    .padding(.top, 60)
                }
                
                Spacer()
                
                // Bottom Zoom Slider - Glass Style
                VStack(spacing: 8) {
                    HStack(spacing: 12) {
                        Image(systemName: "minus.magnifyingglass")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        Slider(value: $zoomLevel, in: 0...1)
                            .tint(.blue)
                            .onChange(of: zoomLevel) { newValue in
                                updateZoom(newValue)
                            }
                        
                        Image(systemName: "plus.magnifyingglass")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .sheet(isPresented: $showEventDetail) {
            if let event = selectedEvent {
                NavigationStack {
                    EventDetailView(event: event, eventsViewModel: eventsViewModel)
                }
                .presentationDetents([.medium, .large])
            }
        }
    }
    
    // MARK: - Zoom Functions
    
    private func zoomIn() {
        withAnimation(.easeInOut(duration: 0.3)) {
            let newDelta = max(mapViewModel.region.span.latitudeDelta * 0.5, 0.002)
            mapViewModel.region.span = MKCoordinateSpan(
                latitudeDelta: newDelta,
                longitudeDelta: newDelta
            )
            updateZoomLevel()
        }
    }
    
    private func zoomOut() {
        withAnimation(.easeInOut(duration: 0.3)) {
            let newDelta = min(mapViewModel.region.span.latitudeDelta * 2, 100)
            mapViewModel.region.span = MKCoordinateSpan(
                latitudeDelta: newDelta,
                longitudeDelta: newDelta
            )
            updateZoomLevel()
        }
    }
    
    private func updateZoom(_ value: Double) {
        // Map slider value (0-1) to zoom delta (100 to 0.002)
        let minDelta = 0.002
        let maxDelta = 50.0
        let newDelta = maxDelta * pow(minDelta / maxDelta, value)
        
        mapViewModel.region.span = MKCoordinateSpan(
            latitudeDelta: newDelta,
            longitudeDelta: newDelta
        )
    }
    
    private func updateZoomLevel() {
        // Update slider to reflect current zoom
        let currentDelta = mapViewModel.region.span.latitudeDelta
        let minDelta = 0.002
        let maxDelta = 50.0
        
        if currentDelta > 0 {
            zoomLevel = log(currentDelta / maxDelta) / log(minDelta / maxDelta)
            zoomLevel = max(0, min(1, zoomLevel))
        }
    }
}

// MARK: - Glass Button Component

struct GlassButton: View {
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Event Marker View

struct EventMarkerView: View {
    let event: Event
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(event.eventCategory.color)
                        .frame(width: 36, height: 36)
                        .shadow(color: event.eventCategory.color.opacity(0.4), radius: 4, x: 0, y: 2)
                    
                    Image(systemName: event.eventCategory.icon)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.white)
                }
                
                // Triangle pointer
                Triangle()
                    .fill(event.eventCategory.color)
                    .frame(width: 12, height: 8)
                    .offset(y: -2)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Triangle Shape

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Map Control Button (Legacy - kept for reference)

struct MapControlButton: View {
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial)
                .clipShape(Circle())
                .shadow(radius: 2)
        }
    }
}

#Preview {
    MapView(eventsViewModel: EventsViewModel())
}
