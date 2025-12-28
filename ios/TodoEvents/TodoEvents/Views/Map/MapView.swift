import SwiftUI
import MapKit

/// Clean MapView with minimal UI controls
struct MapView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @Binding var showingFilters: Bool
    @StateObject private var mapViewModel = MapViewModel()
    @State private var selectedEvent: Event?
    @State private var showEventDetail = false
    
    private var markerSize: CGFloat {
        let span = mapViewModel.region.span.latitudeDelta
        if span > 30 { return 28 }
        if span > 15 { return 32 }
        if span > 5 { return 36 }
        return 40
    }
    
    private var visibleEvents: [Event] {
        let span = mapViewModel.region.span.latitudeDelta
        let events = eventsViewModel.filteredEvents
        
        if span > 20 {
            return Array(events.prefix(200))
        } else if span > 10 {
            return Array(events.prefix(500))
        }
        return events
    }
    
    var body: some View {
        ZStack {
            // Main Map
            Map(coordinateRegion: $mapViewModel.region, showsUserLocation: true, annotationItems: visibleEvents) { event in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng)) {
                    EventMarker(event: event, size: markerSize) {
                        selectedEvent = event
                        showEventDetail = true
                    }
                }
            }
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
            .onReceive(mapViewModel.$region) { region in
                // Sync map center to EventsViewModel for distance filter
                eventsViewModel.mapCenter = region.center
            }
            
            // Top right controls only
            VStack {
                HStack {
                    Spacer()
                    
                    VStack(spacing: 0) {
                        // Location button
                        Button {
                            mapViewModel.centerOnUser()
                        } label: {
                            Image(systemName: "location.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.blue)
                                .frame(width: 44, height: 44)
                        }
                        
                        Divider().frame(width: 30)
                        
                        // Refresh button
                        Button {
                            Task { await eventsViewModel.fetchAllEvents() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.green)
                                .frame(width: 44, height: 44)
                        }
                        
                        Divider().frame(width: 30)
                        
                        // Zoom in
                        Button {
                            withAnimation {
                                let newDelta = max(mapViewModel.region.span.latitudeDelta * 0.5, 0.002)
                                mapViewModel.region.span = MKCoordinateSpan(latitudeDelta: newDelta, longitudeDelta: newDelta)
                            }
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.primary)
                                .frame(width: 44, height: 44)
                        }
                        
                        Divider().frame(width: 30)
                        
                        // Zoom out
                        Button {
                            withAnimation {
                                let newDelta = min(mapViewModel.region.span.latitudeDelta * 2, 120)
                                mapViewModel.region.span = MKCoordinateSpan(latitudeDelta: newDelta, longitudeDelta: newDelta)
                            }
                        } label: {
                            Image(systemName: "minus")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.primary)
                                .frame(width: 44, height: 44)
                        }
                    }
                    .background(.regularMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .shadow(color: .black.opacity(0.1), radius: 4)
                    .padding(.trailing, 12)
                    .padding(.top, 60)
                }
                
                Spacer()
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
}

// MARK: - Event Marker

struct EventMarker: View {
    let event: Event
    let size: CGFloat
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(event.eventCategory.color)
                        .frame(width: size, height: size)
                        .shadow(color: event.eventCategory.color.opacity(0.4), radius: 3, x: 0, y: 2)
                    
                    Image(systemName: event.eventCategory.icon)
                        .font(.system(size: size * 0.45, weight: .semibold))
                        .foregroundStyle(.white)
                }
                
                Triangle()
                    .fill(event.eventCategory.color)
                    .frame(width: size * 0.4, height: size * 0.25)
                    .offset(y: -2)
            }
        }
        .buttonStyle(MarkerButtonStyle())
    }
}

struct MarkerButtonStyle: ButtonStyle {
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

// MARK: - Map Settings View

struct MapSettingsView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Hide Past Events", isOn: $eventsViewModel.hidePastEvents)
                    
                    Picker("Date Range", selection: $eventsViewModel.dateFilter) {
                        Text("All Dates").tag(DateFilter.all)
                        Text("Today").tag(DateFilter.today)
                        Text("This Week").tag(DateFilter.thisWeek)
                        Text("This Month").tag(DateFilter.thisMonth)
                        Text("Next 3 Months").tag(DateFilter.next3Months)
                    }
                } header: {
                    Label("Date Filters", systemImage: "calendar")
                }
                
                Section {
                    Picker("Max Distance", selection: $eventsViewModel.distanceFilter) {
                        Text("Any Distance").tag(DistanceFilter.any)
                        Text("5 miles").tag(DistanceFilter.miles5)
                        Text("10 miles").tag(DistanceFilter.miles10)
                        Text("25 miles").tag(DistanceFilter.miles25)
                        Text("50 miles").tag(DistanceFilter.miles50)
                        Text("100 miles").tag(DistanceFilter.miles100)
                    }
                    
                    if eventsViewModel.distanceFilter != .any {
                        Toggle("Use Map Center", isOn: $eventsViewModel.useMapCenterForDistance)
                        
                        HStack {
                            Image(systemName: eventsViewModel.useMapCenterForDistance ? "map" : "location.fill")
                                .foregroundStyle(eventsViewModel.useMapCenterForDistance ? .orange : .blue)
                            Text(eventsViewModel.useMapCenterForDistance ? "Measuring from map center" : 
                                 (eventsViewModel.userLocation != nil ? "Using your location" : "Location unavailable"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Label("Distance", systemImage: "location.circle")
                }
                
                Section {
                    ForEach(EventCategory.allCases.filter { $0 != .all }, id: \.self) { category in
                        Button {
                            eventsViewModel.toggleCategory(category)
                        } label: {
                            HStack {
                                Image(systemName: category.icon)
                                    .foregroundStyle(category.color)
                                    .frame(width: 24)
                                
                                Text(category.displayName)
                                    .foregroundStyle(.primary)
                                
                                Spacer()
                                
                                if eventsViewModel.selectedCategories.contains(category) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.blue)
                                } else {
                                    Image(systemName: "circle")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    
                    HStack {
                        Button("Select All") { eventsViewModel.selectAllCategories() }
                        Spacer()
                        Button("Clear All") { eventsViewModel.clearAllCategories() }
                    }
                    .font(.subheadline)
                    .padding(.top, 4)
                } header: {
                    Label("Categories", systemImage: "tag")
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") { eventsViewModel.resetFilters() }
                }
            }
        }
    }
}

// MARK: - Button Styles

struct GameButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

#Preview {
    MapView(eventsViewModel: EventsViewModel(), showingFilters: .constant(false))
}
