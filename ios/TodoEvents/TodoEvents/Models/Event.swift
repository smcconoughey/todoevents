import Foundation

/// Event model matching API EventResponse schema
struct Event: Codable, Identifiable {
    let id: Int
    let title: String
    let description: String
    let shortDescription: String?
    let date: String
    let startTime: String
    let endTime: String?
    let endDate: String?
    let category: String
    let secondaryCategory: String?
    let address: String
    let city: String?
    let state: String?
    let country: String?
    let lat: Double
    let lng: Double
    let recurring: Bool
    let frequency: String?
    let feeRequired: String?
    let price: Double?
    let currency: String?
    let eventUrl: String?
    let hostName: String?
    let organizerUrl: String?
    let verified: Bool?
    let isPremiumEvent: Bool?
    let bannerImage: String?
    let logoImage: String?
    let slug: String?
    let isPublished: Bool?
    let createdBy: Int
    let createdAt: String
    let updatedAt: String?
    let startDatetime: String?
    let endDatetime: String?
    let interestCount: Int?
    let viewCount: Int?
    
    enum CodingKeys: String, CodingKey {
        case id, title, description, date, address, city, state, country, lat, lng
        case recurring, frequency, price, currency, slug, verified
        case shortDescription = "short_description"
        case startTime = "start_time"
        case endTime = "end_time"
        case endDate = "end_date"
        case category
        case secondaryCategory = "secondary_category"
        case feeRequired = "fee_required"
        case eventUrl = "event_url"
        case hostName = "host_name"
        case organizerUrl = "organizer_url"
        case isPremiumEvent = "is_premium_event"
        case bannerImage = "banner_image"
        case logoImage = "logo_image"
        case isPublished = "is_published"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case startDatetime = "start_datetime"
        case endDatetime = "end_datetime"
        case interestCount = "interest_count"
        case viewCount = "view_count"
    }
    
    /// Get the EventCategory enum for this event
    var eventCategory: EventCategory {
        EventCategory(rawValue: category) ?? .all
    }
    
    /// Formatted date string
    var formattedDate: String {
        // Parse the date string (format: "2024-12-25")
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
        if let date = dateFormatter.date(from: date) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            return displayFormatter.string(from: date)
        }
        return date
    }
    
    /// Formatted time string
    var formattedTime: String {
        // Parse time string (format: "14:00" or "2:00 PM")
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        
        if let time = timeFormatter.date(from: startTime) {
            let displayFormatter = DateFormatter()
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: time)
        }
        return startTime
    }
    
    /// Location string combining city and state
    var locationString: String {
        [city, state].compactMap { $0 }.joined(separator: ", ")
    }
}

/// Event creation request
struct EventCreate: Encodable {
    let title: String
    let description: String
    let date: String
    let startTime: String
    let endTime: String?
    let category: String
    let address: String
    let lat: Double
    let lng: Double
    let city: String?
    let state: String?
    let country: String?
    let eventUrl: String?
    let hostName: String?
    let recurring: Bool
    let feeRequired: String?
    let price: Double?
    
    enum CodingKeys: String, CodingKey {
        case title, description, date, address, lat, lng, city, state, country, recurring, price
        case startTime = "start_time"
        case endTime = "end_time"
        case category
        case eventUrl = "event_url"
        case hostName = "host_name"
        case feeRequired = "fee_required"
    }
}
