import Foundation
import CoreLocation
import SwiftUI

/// View model for events and map state
@MainActor
final class EventsViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published var events: [Event] = []
    @Published var filteredEvents: [Event] = []
    @Published var selectedEvent: Event?
    @Published var isLoading = false
    @Published var error: String?
    
    // Filters
    @Published var selectedCategory: EventCategory = .all
    @Published var selectedDateRange: ClosedRange<Date>?
    
    // Map state
    @Published var mapCenter: CLLocationCoordinate2D = CLLocationCoordinate2D(
        latitude: Config.defaultLatitude,
        longitude: Config.defaultLongitude
    )
    @Published var userLocation: CLLocationCoordinate2D?
    
    private let eventService = EventService.shared
    private var hasInitiallyLoaded = false
    
    init() {}
    
    // MARK: - Initial Load
    
    func loadIfNeeded() async {
        guard !hasInitiallyLoaded else { return }
        hasInitiallyLoaded = true
        await fetchAllEvents()
    }
    
    // MARK: - Category Filter
    
    func setCategory(_ category: EventCategory) {
        selectedCategory = category
        applyFilters()
    }
    
    // MARK: - Fetch Events
    
    /// Fetch ALL events from the database (no location filter)
    func fetchAllEvents() async {
        isLoading = true
        error = nil
        
        do {
            // Fetch ALL events - no location filter
            let fetchedEvents = try await eventService.fetchAllEvents(limit: 2000)
            events = fetchedEvents
            applyFilters()
            isLoading = false
        } catch {
            self.error = "Failed to load events"
            isLoading = false
        }
    }
    
    /// Fetch events for the local area only
    func fetchEvents() async {
        isLoading = true
        error = nil
        
        let lat = userLocation?.latitude ?? mapCenter.latitude
        let lng = userLocation?.longitude ?? mapCenter.longitude
        
        do {
            let fetchedEvents = try await eventService.fetchEvents(
                latitude: lat,
                longitude: lng,
                radius: Config.defaultSearchRadius
            )
            
            events = fetchedEvents
            applyFilters()
            isLoading = false
        } catch {
            self.error = "Failed to load events"
            isLoading = false
        }
    }
    
    func fetchEvents(at coordinate: CLLocationCoordinate2D) async {
        mapCenter = coordinate
        // Don't refetch - we already have all events
    }
    
    // MARK: - Filters
    
    private func applyFilters() {
        var result = events
        
        // Category filter
        if selectedCategory != .all {
            result = result.filter { $0.category == selectedCategory.rawValue }
        }
        
        // Date filter
        if let dateRange = selectedDateRange {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            
            result = result.filter { event in
                guard let eventDate = dateFormatter.date(from: event.date) else {
                    return true
                }
                return dateRange.contains(eventDate)
            }
        }
        
        filteredEvents = result
    }
    
    func clearFilters() {
        selectedCategory = .all
        selectedDateRange = nil
        applyFilters()
    }
    
    // MARK: - Event Selection
    
    func selectEvent(_ event: Event) {
        selectedEvent = event
    }
    
    func clearSelection() {
        selectedEvent = nil
    }
    
    // MARK: - Distance Calculation
    
    func distance(to event: Event) -> Double? {
        guard let userLocation = userLocation else { return nil }
        
        let eventLocation = CLLocation(latitude: event.lat, longitude: event.lng)
        let userCLLocation = CLLocation(latitude: userLocation.latitude, longitude: userLocation.longitude)
        
        return userCLLocation.distance(from: eventLocation) / 1609.34
    }
    
    func formattedDistance(to event: Event) -> String? {
        guard let distance = distance(to: event) else { return nil }
        
        if distance < 0.1 {
            return "Nearby"
        } else if distance < 1 {
            return String(format: "%.1f mi", distance)
        } else {
            return String(format: "%.0f mi", distance)
        }
    }
    
    // MARK: - Event CRUD
    
    func createEvent(_ eventData: EventCreate) async throws -> Event {
        let newEvent = try await eventService.createEvent(eventData)
        await fetchAllEvents()
        return newEvent
    }
    
    func deleteEvent(_ event: Event) async throws {
        try await eventService.deleteEvent(id: event.id)
        events.removeAll { $0.id == event.id }
        applyFilters()
        
        if selectedEvent?.id == event.id {
            selectedEvent = nil
        }
    }
}
