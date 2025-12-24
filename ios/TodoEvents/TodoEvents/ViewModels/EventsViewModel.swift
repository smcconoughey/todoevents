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
    @Published var selectedCategory: EventCategory = .all {
        didSet { applyFilters() }
    }
    @Published var selectedDateRange: ClosedRange<Date>? {
        didSet { applyFilters() }
    }
    
    // Map state
    @Published var mapCenter: CLLocationCoordinate2D = CLLocationCoordinate2D(
        latitude: Config.defaultLatitude,
        longitude: Config.defaultLongitude
    )
    @Published var userLocation: CLLocationCoordinate2D?
    
    private let eventService = EventService.shared
    
    init() {
        // Initial load
        Task {
            await fetchEvents()
        }
    }
    
    // MARK: - Fetch Events
    
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
        await fetchEvents()
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
        
        // Return distance in miles
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
        
        // Refresh events list
        await fetchEvents()
        
        return newEvent
    }
    
    func deleteEvent(_ event: Event) async throws {
        try await eventService.deleteEvent(id: event.id)
        
        // Remove from local list
        events.removeAll { $0.id == event.id }
        applyFilters()
        
        if selectedEvent?.id == event.id {
            selectedEvent = nil
        }
    }
}
