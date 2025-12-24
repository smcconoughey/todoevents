import SwiftUI
import MapKit

/// Optimized MapView with zoom-based marker sizing and better performance
struct MapView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @StateObject private var mapViewModel = MapViewModel()
    @State private var selectedEvent: Event?
    @State private var showEventDetail = false
    @State private var zoomLevel: Double = 0.5
    @State private var isUpdatingZoom = false
    
    // Computed marker size based on zoom level
    private var markerSize: CGFloat {
        let span = mapViewModel.region.span.latitudeDelta
        if span > 30 { return 12 }      // Very zoomed out - tiny dots
        if span > 15 { return 18 }      // Country view - small
        if span > 5 { return 24 }       // Regional view - medium
        if span > 1 { return 30 }       // City view
        return 36                        // Neighborhood view - full size
    }
    
    // Should show icon inside marker
    private var showIcon: Bool {
        mapViewModel.region.span.latitudeDelta < 10
    }
    
    // Limit visible events based on zoom
    private var visibleEvents: [Event] {
        let span = mapViewModel.region.span.latitudeDelta
        let events = eventsViewModel.filteredEvents
        
        // When zoomed out, limit markers to reduce clutter
        if span > 20 {
            return Array(events.prefix(100))
        } else if span > 10 {
            return Array(events.prefix(300))
        } else if span > 5 {
            return Array(events.prefix(500))
        }
        return events
    }
    
    var body: some View {
        ZStack {
            // Main Map - Use standard MapMarker for better performance when zoomed out
            Map(coordinateRegion: $mapViewModel.region, showsUserLocation: true, annotationItems: visibleEvents) { event in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng)) {
                    OptimizedMarker(
                        event: event,
                        size: markerSize,
                        showIcon: showIcon
                    ) {
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
                Task { @MainActor in
                    eventsViewModel.userLocation = location
                }
            }
            
            // Controls Overlay
            VStack {
                HStack {
                    Spacer()
                    
                    // Map Control Buttons
                    VStack(spacing: 0) {
                        LiquidGlassButton(icon: "location.fill", size: 50) {
                            withAnimation(.easeOut(duration: 0.25)) {
                                mapViewModel.centerOnUser()
                            }
                        }
                        
                        Divider().frame(width: 40).opacity(0.3)
                        
                        LiquidGlassButton(icon: "arrow.clockwise", size: 50) {
                            Task {
                                await eventsViewModel.fetchAllEvents()
                            }
                        }
                        
                        Divider().frame(width: 40).opacity(0.3)
                        
                        LiquidGlassButton(icon: "plus", size: 50) {
                            zoomIn()
                        }
                        
                        Divider().frame(width: 40).opacity(0.3)
                        
                        LiquidGlassButton(icon: "minus", size: 50) {
                            zoomOut()
                        }
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(.ultraThinMaterial)
                            .shadow(color: .black.opacity(0.2), radius: 12, x: 0, y: 6)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(.white.opacity(0.3), lineWidth: 0.5)
                    )
                    .padding(.trailing, 12)
                    .padding(.top, 60)
                }
                
                Spacer()
                
                // Bottom Zoom Slider
                HStack(spacing: 12) {
                    Image(systemName: "minus.magnifyingglass")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.secondary)
                    
                    Slider(value: $zoomLevel, in: 0...1)
                        .tint(.blue)
                        .onChange(of: zoomLevel) { newValue in
                            guard !isUpdatingZoom else { return }
                            updateZoom(newValue)
                        }
                    
                    Image(systemName: "plus.magnifyingglass")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(.ultraThinMaterial)
                        .shadow(color: .black.opacity(0.15), radius: 10, x: 0, y: 4)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(.white.opacity(0.3), lineWidth: 0.5)
                )
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
        withAnimation(.easeOut(duration: 0.2)) {
            let newDelta = max(mapViewModel.region.span.latitudeDelta * 0.5, 0.002)
            mapViewModel.region.span = MKCoordinateSpan(
                latitudeDelta: newDelta,
                longitudeDelta: newDelta
            )
            updateZoomLevel()
        }
    }
    
    private func zoomOut() {
        withAnimation(.easeOut(duration: 0.2)) {
            let newDelta = min(mapViewModel.region.span.latitudeDelta * 2, 120)
            mapViewModel.region.span = MKCoordinateSpan(
                latitudeDelta: newDelta,
                longitudeDelta: newDelta
            )
            updateZoomLevel()
        }
    }
    
    private func updateZoom(_ value: Double) {
        let minDelta = 0.002
        let maxDelta = 120.0
        let newDelta = maxDelta * pow(minDelta / maxDelta, value)
        
        mapViewModel.region.span = MKCoordinateSpan(
            latitudeDelta: newDelta,
            longitudeDelta: newDelta
        )
    }
    
    private func updateZoomLevel() {
        isUpdatingZoom = true
        let currentDelta = mapViewModel.region.span.latitudeDelta
        let minDelta = 0.002
        let maxDelta = 120.0
        
        if currentDelta > 0 {
            zoomLevel = log(currentDelta / maxDelta) / log(minDelta / maxDelta)
            zoomLevel = max(0, min(1, zoomLevel))
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            isUpdatingZoom = false
        }
    }
}

// MARK: - Optimized Marker (size-aware)

struct OptimizedMarker: View {
    let event: Event
    let size: CGFloat
    let showIcon: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            if showIcon {
                // Full marker with icon
                VStack(spacing: 0) {
                    ZStack {
                        Circle()
                            .fill(event.eventCategory.color)
                            .frame(width: size, height: size)
                            .shadow(color: event.eventCategory.color.opacity(0.4), radius: 3, x: 0, y: 2)
                        
                        Image(systemName: event.eventCategory.icon)
                            .font(.system(size: size * 0.4, weight: .medium))
                            .foregroundStyle(.white)
                    }
                    
                    if size >= 30 {
                        Triangle()
                            .fill(event.eventCategory.color)
                            .frame(width: size * 0.35, height: size * 0.22)
                            .offset(y: -2)
                    }
                }
            } else {
                // Simple dot for zoomed out view
                Circle()
                    .fill(event.eventCategory.color)
                    .frame(width: size, height: size)
                    .shadow(color: event.eventCategory.color.opacity(0.5), radius: 2)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Liquid Glass Button Component

struct LiquidGlassButton: View {
    let icon: String
    let size: CGFloat
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size * 0.36, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: size, height: size)
                .contentShape(Rectangle())
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
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

#Preview {
    MapView(eventsViewModel: EventsViewModel())
}
