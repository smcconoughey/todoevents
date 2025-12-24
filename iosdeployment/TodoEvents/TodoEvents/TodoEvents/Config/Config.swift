import Foundation

/// API Configuration
enum Config {
    /// Base URL for the TodoEvents API
    static let apiBaseURL = "https://todoevents-backend.onrender.com"
    
    /// Google Maps API Key (configure in Info.plist or environment)
    static var googleMapsAPIKey: String {
        Bundle.main.object(forInfoDictionaryKey: "GOOGLE_MAPS_API_KEY") as? String ?? ""
    }
    
    /// Default map center (US center)
    static let defaultLatitude = 39.8283
    static let defaultLongitude = -98.5795
    
    /// Default search radius in miles
    static let defaultSearchRadius = 25.0
    
    /// Keychain service identifier
    static let keychainService = "com.todoevents.auth"
}
