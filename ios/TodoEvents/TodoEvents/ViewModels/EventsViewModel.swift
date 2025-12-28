import Foundation
import CoreLocation
import SwiftUI

// MARK: - Filter Enums

enum DateFilter: String, CaseIterable {
    case all = "all"
    case today = "today"
    case thisWeek = "thisWeek"
    case thisMonth = "thisMonth"
    case next3Months = "next3Months"
    
    var displayName: String {
        switch self {
        case .all: return "All Dates"
        case .today: return "Today"
        case .thisWeek: return "This Week"
        case .thisMonth: return "This Month"
        case .next3Months: return "Next 3 Months"
        }
    }
}

enum DistanceFilter: Double, CaseIterable {
    case any = 0
    case miles5 = 5
    case miles10 = 10
    case miles25 = 25
    case miles50 = 50
    case miles100 = 100
    
    var displayName: String {
        switch self {
        case .any: return "Any Distance"
        case .miles5: return "5 miles"
        case .miles10: return "10 miles"
        case .miles25: return "25 miles"
        case .miles50: return "50 miles"
        case .miles100: return "100 miles"
        }
    }
}
/// View model for events and map state
@MainActor
final class EventsViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published var events: [Event] = []
    @Published var filteredEvents: [Event] = []
    @Published var selectedEvent: Event?
    @Published var isLoading = false
    @Published var error: String?
    
    // Filter State
    @Published var selectedCategory: EventCategory = .all
    @Published var selectedCategories: Set<EventCategory> = Set(EventCategory.allCases.filter { $0 != .all })
    @Published var hidePastEvents: Bool = true
    @Published var dateFilter: DateFilter = .all
    @Published var distanceFilter: DistanceFilter = .any
    @Published var useMapCenterForDistance: Bool = false
    
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
    
    // MARK: - Category Management
    
    func setCategory(_ category: EventCategory) {
        selectedCategory = category
        applyFilters()
    }
    
    func toggleCategory(_ category: EventCategory) {
        if selectedCategories.contains(category) {
            selectedCategories.remove(category)
        } else {
            selectedCategories.insert(category)
        }
        applyFilters()
    }
    
    func selectAllCategories() {
        selectedCategories = Set(EventCategory.allCases.filter { $0 != .all })
        applyFilters()
    }
    
    func clearAllCategories() {
        selectedCategories.removeAll()
        applyFilters()
    }
    
    func resetFilters() {
        selectedCategory = .all
        selectedCategories = Set(EventCategory.allCases.filter { $0 != .all })
        hidePastEvents = true
        dateFilter = .all
        distanceFilter = .any
        applyFilters()
    }
    
    // MARK: - Fetch Events
    
    func fetchAllEvents() async {
        isLoading = true
        error = nil
        
        do {
            let fetchedEvents = try await eventService.fetchAllEvents(limit: 2000)
            events = fetchedEvents
            applyFilters()
            isLoading = false
        } catch {
            self.error = "Failed to load events"
            isLoading = false
        }
    }
    
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
    }
    
    // MARK: - Filters
    
    func applyFilters() {
        var result = events
        
        // Category filter (using selectedCategories set)
        if selectedCategory != .all {
            result = result.filter { $0.category == selectedCategory.rawValue }
        } else if !selectedCategories.isEmpty && selectedCategories.count < EventCategory.allCases.count - 1 {
            // Use multi-category filter
            let categoryRawValues = selectedCategories.map { $0.rawValue }
            result = result.filter { categoryRawValues.contains($0.category) }
        }
        
        // Date filters
        let today = Calendar.current.startOfDay(for: Date())
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
        // Hide past events
        if hidePastEvents {
            result = result.filter { event in
                guard let eventDate = dateFormatter.date(from: event.date) else { return true }
                return eventDate >= today
            }
        }
        
        // Date range filter
        switch dateFilter {
        case .all:
            break
        case .today:
            result = result.filter { event in
                guard let eventDate = dateFormatter.date(from: event.date) else { return false }
                return Calendar.current.isDateInToday(eventDate)
            }
        case .thisWeek:
            let endOfWeek = Calendar.current.date(byAdding: .day, value: 7, to: today)!
            result = result.filter { event in
                guard let eventDate = dateFormatter.date(from: event.date) else { return false }
                return eventDate >= today && eventDate <= endOfWeek
            }
        case .thisMonth:
            let endOfMonth = Calendar.current.date(byAdding: .month, value: 1, to: today)!
            result = result.filter { event in
                guard let eventDate = dateFormatter.date(from: event.date) else { return false }
                return eventDate >= today && eventDate <= endOfMonth
            }
        case .next3Months:
            let endDate = Calendar.current.date(byAdding: .month, value: 3, to: today)!
            result = result.filter { event in
                guard let eventDate = dateFormatter.date(from: event.date) else { return false }
                return eventDate >= today && eventDate <= endDate
            }
        }
        
        // Distance filter - use map center or user location
        if distanceFilter != .any {
            let referenceLocation: CLLocationCoordinate2D
            if useMapCenterForDistance {
                referenceLocation = mapCenter
            } else if let userLoc = userLocation {
                referenceLocation = userLoc
            } else {
                // No location available, use map center as fallback
                referenceLocation = mapCenter
            }
            
            let maxDistance = distanceFilter.rawValue
            result = result.filter { event in
                let eventLocation = CLLocation(latitude: event.lat, longitude: event.lng)
                let refCLLocation = CLLocation(latitude: referenceLocation.latitude, longitude: referenceLocation.longitude)
                let distanceInMiles = refCLLocation.distance(from: eventLocation) / 1609.34
                return distanceInMiles <= maxDistance
            }
        }
        
        filteredEvents = result
    }
    
    // MARK: - Selection
    
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
