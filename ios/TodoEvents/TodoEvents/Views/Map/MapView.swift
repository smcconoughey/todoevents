import SwiftUI
import MapKit

/// Native iOS MapView using MapKit
struct MapView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @StateObject private var mapViewModel = MapViewModel()
    @State private var selectedEvent: Event?
    @State private var showEventDetail = false
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            Map(coordinateRegion: $mapViewModel.region, showsUserLocation: true, annotationItems: eventsViewModel.filteredEvents) { event in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng)) {
                    EventMarkerView(event: event) {
                        selectedEvent = event
                        showEventDetail = true
                    }
                }
            }
            .ignoresSafeArea(edges: .top)
            .onAppear {
                mapViewModel.requestLocationPermission()
            }
            .onChange(of: mapViewModel.userLocation) { newLocation in
                if let location = newLocation {
                    eventsViewModel.userLocation = location
                    Task {
                        await eventsViewModel.fetchEvents(at: location)
                    }
                }
            }
            
            // Map Controls
            VStack(spacing: 12) {
                // Center on user button
                MapControlButton(icon: "location.fill") {
                    mapViewModel.centerOnUser()
                }
                
                // Refresh events
                MapControlButton(icon: "arrow.clockwise") {
                    Task {
                        await eventsViewModel.fetchEvents()
                    }
                }
            }
            .padding(.trailing, 16)
            .padding(.top, 16)
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
                        .shadow(radius: 3)
                    
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

// MARK: - Map Control Button

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
