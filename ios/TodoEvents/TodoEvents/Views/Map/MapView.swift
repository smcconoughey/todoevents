import SwiftUI
import MapKit

/// Optimized MapView with video game styling and settings
struct MapView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @StateObject private var mapViewModel = MapViewModel()
    @State private var selectedEvent: Event?
    @State private var showEventDetail = false
    @State private var showSettings = false
    @State private var zoomLevel: Double = 0.5
    @State private var isUpdatingZoom = false
    
    // Computed marker size based on zoom level
    private var markerSize: CGFloat {
        let span = mapViewModel.region.span.latitudeDelta
        if span > 30 { return 14 }
        if span > 15 { return 20 }
        if span > 5 { return 26 }
        if span > 1 { return 32 }
        return 38
    }
    
    private var showIcon: Bool {
        mapViewModel.region.span.latitudeDelta < 10
    }
    
    // Limit visible events based on zoom
    private var visibleEvents: [Event] {
        let span = mapViewModel.region.span.latitudeDelta
        let events = eventsViewModel.filteredEvents
        
        if span > 20 {
            return Array(events.prefix(150))
        } else if span > 10 {
            return Array(events.prefix(400))
        } else if span > 5 {
            return Array(events.prefix(700))
        }
        return events
    }
    
    var body: some View {
        ZStack {
            // Main Map with custom styling
            Map(coordinateRegion: $mapViewModel.region, showsUserLocation: true, annotationItems: visibleEvents) { event in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng)) {
                    GameStyleMarker(
                        event: event,
                        size: markerSize,
                        showIcon: showIcon
                    ) {
                        selectedEvent = event
                        showEventDetail = true
                    }
                }
            }
            .mapStyle(.standard(elevation: .realistic, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
            .ignoresSafeArea(edges: .all)
            .onAppear {
                mapViewModel.requestLocationPermission()
                mapViewModel.startTrackingLocation()
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
                    
                    // Right side controls
                    VStack(spacing: 0) {
                        GameButton(icon: "location.fill", color: .cyan) {
                            mapViewModel.startTrackingLocation()
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                mapViewModel.centerOnUser()
                            }
                        }
                        
                        Divider().frame(width: 36).opacity(0.2)
                        
                        GameButton(icon: "arrow.clockwise", color: .green) {
                            Task {
                                await eventsViewModel.fetchAllEvents()
                            }
                        }
                        
                        Divider().frame(width: 36).opacity(0.2)
                        
                        GameButton(icon: "plus", color: .white) {
                            zoomIn()
                        }
                        
                        Divider().frame(width: 36).opacity(0.2)
                        
                        GameButton(icon: "minus", color: .white) {
                            zoomOut()
                        }
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(.black.opacity(0.7))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(
                                        LinearGradient(
                                            colors: [.cyan.opacity(0.5), .purple.opacity(0.5)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        ),
                                        lineWidth: 1
                                    )
                            )
                            .shadow(color: .cyan.opacity(0.3), radius: 8)
                    )
                    .padding(.trailing, 12)
                    .padding(.top, 60)
                }
                
                Spacer()
                
                HStack(alignment: .bottom) {
                    // Bottom left - event count badge
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(.green)
                                .frame(width: 8, height: 8)
                            Text("\(visibleEvents.count) events")
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        }
                        
                        if eventsViewModel.hidePastEvents {
                            Text("Upcoming only")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(.black.opacity(0.7))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(.green.opacity(0.4), lineWidth: 1)
                            )
                    )
                    .foregroundStyle(.green)
                    
                    Spacer()
                    
                    // Bottom right - settings button
                    Button {
                        showSettings = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "slider.horizontal.3")
                            Text("Filters")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(.black.opacity(0.7))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(
                                            LinearGradient(
                                                colors: [.orange.opacity(0.6), .pink.opacity(0.6)],
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            ),
                                            lineWidth: 1
                                        )
                                )
                                .shadow(color: .orange.opacity(0.2), radius: 6)
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                
                // Zoom Slider
                HStack(spacing: 12) {
                    Image(systemName: "minus")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.cyan)
                    
                    Slider(value: $zoomLevel, in: 0...1)
                        .tint(.cyan)
                        .onChange(of: zoomLevel) { newValue in
                            guard !isUpdatingZoom else { return }
                            updateZoom(newValue)
                        }
                    
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundStyle(.cyan)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(.black.opacity(0.7))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(.cyan.opacity(0.4), lineWidth: 1)
                        )
                        .shadow(color: .cyan.opacity(0.2), radius: 6)
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
        .sheet(isPresented: $showSettings) {
            MapSettingsView(eventsViewModel: eventsViewModel)
                .presentationDetents([.large])
        }
    }
    
    // MARK: - Zoom Functions
    
    private func zoomIn() {
        withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
            let newDelta = max(mapViewModel.region.span.latitudeDelta * 0.5, 0.002)
            mapViewModel.region.span = MKCoordinateSpan(
                latitudeDelta: newDelta,
                longitudeDelta: newDelta
            )
            updateZoomLevel()
        }
    }
    
    private func zoomOut() {
        withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
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

// MARK: - Game Style Marker

struct GameStyleMarker: View {
    let event: Event
    let size: CGFloat
    let showIcon: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            if showIcon {
                // Full marker with glow effect
                VStack(spacing: 0) {
                    ZStack {
                        // Outer glow
                        Circle()
                            .fill(event.eventCategory.color.opacity(0.3))
                            .frame(width: size + 8, height: size + 8)
                            .blur(radius: 4)
                        
                        // Main circle with gradient
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [event.eventCategory.color, event.eventCategory.color.opacity(0.7)],
                                    center: .center,
                                    startRadius: 0,
                                    endRadius: size / 2
                                )
                            )
                            .frame(width: size, height: size)
                            .overlay(
                                Circle()
                                    .stroke(.white.opacity(0.5), lineWidth: 1.5)
                            )
                        
                        Image(systemName: event.eventCategory.icon)
                            .font(.system(size: size * 0.4, weight: .bold))
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.5), radius: 1)
                    }
                    
                    if size >= 30 {
                        // Pointer with glow
                        Triangle()
                            .fill(event.eventCategory.color)
                            .frame(width: size * 0.4, height: size * 0.25)
                            .shadow(color: event.eventCategory.color.opacity(0.5), radius: 2)
                            .offset(y: -2)
                    }
                }
            } else {
                // Simple glowing dot
                ZStack {
                    Circle()
                        .fill(event.eventCategory.color.opacity(0.4))
                        .frame(width: size + 4, height: size + 4)
                        .blur(radius: 2)
                    
                    Circle()
                        .fill(event.eventCategory.color)
                        .frame(width: size, height: size)
                        .overlay(
                            Circle()
                                .stroke(.white.opacity(0.6), lineWidth: 1)
                        )
                }
            }
        }
        .buttonStyle(GameButtonStyle())
    }
}

// MARK: - Game Button

struct GameButton: View {
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(color)
                .frame(width: 50, height: 50)
                .contentShape(Rectangle())
        }
        .buttonStyle(GameButtonStyle())
    }
}

struct GameButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.85 : 1.0)
            .brightness(configuration.isPressed ? 0.2 : 0)
            .animation(.spring(response: 0.15, dampingFraction: 0.6), value: configuration.isPressed)
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
