import Foundation
import CoreLocation

/// Event service for CRUD operations
actor EventService {
    static let shared = EventService()
    
    private let api = APIClient.shared
    
    private init() {}
    
    // MARK: - Fetch Events
    
    /// Fetch ALL events without location filter
    func fetchAllEvents(limit: Int = 2000) async throws -> [Event] {
        let queryItems = [
            URLQueryItem(name: "limit", value: String(limit))
        ]
        return try await api.get("/events", queryItems: queryItems)
    }
    
    /// Fetch events near a location
    func fetchEvents(
        latitude: Double,
        longitude: Double,
        radius: Double = Config.defaultSearchRadius,
        category: String? = nil,
        date: String? = nil,
        limit: Int = 500
    ) async throws -> [Event] {
        var queryItems = [
            URLQueryItem(name: "lat", value: String(latitude)),
            URLQueryItem(name: "lng", value: String(longitude)),
            URLQueryItem(name: "radius", value: String(radius)),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        
        if let category = category, category != "all" {
            queryItems.append(URLQueryItem(name: "category", value: category))
        }
        
        if let date = date {
            queryItems.append(URLQueryItem(name: "date", value: date))
        }
        
        return try await api.get("/events", queryItems: queryItems)
    }
    
    /// Fetch a single event by ID
    func fetchEvent(id: Int) async throws -> Event {
        try await api.get("/events/\(id)")
    }
    
    // MARK: - User's Events
    
    /// Fetch events created by the current user
    func fetchUserEvents() async throws -> [Event] {
        try await api.get("/user/events")
    }
    
    // MARK: - Create Event
    
    /// Create a new event
    func createEvent(_ event: EventCreate) async throws -> Event {
        try await api.post("/events", body: event)
    }
    
    // MARK: - Update Event
    
    /// Update an existing event
    func updateEvent(id: Int, event: EventCreate) async throws -> Event {
        try await api.put("/events/\(id)", body: event)
    }
    
    // MARK: - Delete Event
    
    /// Delete an event
    func deleteEvent(id: Int) async throws {
        try await api.delete("/events/\(id)")
    }
    
    // MARK: - Interest
    
    /// Toggle interest in an event
    func toggleInterest(eventId: Int) async throws {
        let _: InterestResponse = try await api.post("/events/\(eventId)/interest", body: EmptyBody())
    }

    /// Record a view for an event
    func recordView(eventId: Int) async throws {
        let _: ViewResponse = try await api.post("/events/\(eventId)/view", body: EmptyBody())
    }
}

// MARK: - Helper Types

struct EmptyBody: Encodable {}

struct EmptyResponse: Decodable {}

struct InterestResponse: Decodable {
    let interested: Bool?
    let interestCount: Int?
    let detail: String?

    enum CodingKeys: String, CodingKey {
        case interested
        case interestCount = "interest_count"
        case detail
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        interested = try container.decodeIfPresent(Bool.self, forKey: .interested)
        interestCount = try container.decodeIfPresent(Int.self, forKey: .interestCount)
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
    }
}

struct ViewResponse: Decodable {
    let viewCount: Int?
    let detail: String?

    enum CodingKeys: String, CodingKey {
        case viewCount = "view_count"
        case detail
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        viewCount = try container.decodeIfPresent(Int.self, forKey: .viewCount)
        detail = try container.decodeIfPresent(String.self, forKey: .detail)
    }
}
