import SwiftUI

/// Event categories matching web app configuration
enum EventCategory: String, CaseIterable, Codable {
    case all = "all"
    case foodDrink = "food-drink"
    case music = "music"
    case arts = "arts"
    case sports = "sports"
    case automotive = "automotive"
    case airshows = "airshows"
    case vehicleSports = "vehicle-sports"
    case community = "community"
    case religious = "religious"
    case education = "education"
    
    /// Display name for category
    var displayName: String {
        switch self {
        case .all: return "All"
        case .foodDrink: return "Food & Drink"
        case .music: return "Music"
        case .arts: return "Arts"
        case .sports: return "Sports"
        case .automotive: return "Automotive"
        case .airshows: return "Airshows"
        case .vehicleSports: return "Vehicle Sports"
        case .community: return "Community"
        case .religious: return "Religious"
        case .education: return "Tech & Education"
        }
    }
    
    /// Category color
    var color: Color {
        switch self {
        case .all: return .gray
        case .foodDrink: return .orange
        case .music: return .purple
        case .arts: return .blue
        case .sports: return .green
        case .automotive: return .red
        case .airshows: return .cyan
        case .vehicleSports: return .yellow
        case .community: return .yellow
        case .religious: return .indigo
        case .education: return .teal
        }
    }
    
    /// SF Symbol icon name
    var icon: String {
        switch self {
        case .all: return "mappin"
        case .foodDrink: return "fork.knife"
        case .music: return "music.note"
        case .arts: return "paintpalette"
        case .sports: return "trophy"
        case .automotive: return "car"
        case .airshows: return "airplane"
        case .vehicleSports: return "sailboat"
        case .community: return "person.3"
        case .religious: return "building.columns"
        case .education: return "book"
        }
    }
    
    /// UIColor for map markers
    var uiColor: UIColor {
        UIColor(color)
    }
}
