import SwiftUI

/// Event categories matching web app configuration - all 26 categories
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
    case networking = "networking"
    case veteran = "veteran"
    case cookout = "cookout"
    case fairFestival = "fair-festival"
    case diving = "diving"
    case shopping = "shopping"
    case health = "health"
    case outdoors = "outdoors"
    case photography = "photography"
    case family = "family"
    case gaming = "gaming"
    case realEstate = "real-estate"
    case adventure = "adventure"
    case seasonal = "seasonal"
    case agriculture = "agriculture"
    case other = "other"
    
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
        case .education: return "Education"
        case .networking: return "Networking"
        case .veteran: return "Veteran"
        case .cookout: return "Cookout"
        case .fairFestival: return "Fair/Festival"
        case .diving: return "Diving"
        case .shopping: return "Shopping"
        case .health: return "Health"
        case .outdoors: return "Outdoors"
        case .photography: return "Photography"
        case .family: return "Family"
        case .gaming: return "Gaming"
        case .realEstate: return "Real Estate"
        case .adventure: return "Adventure"
        case .seasonal: return "Seasonal"
        case .agriculture: return "Agriculture"
        case .other: return "Other"
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
        case .vehicleSports: return .teal
        case .community: return .yellow
        case .religious: return .indigo
        case .education: return .mint
        case .networking: return .blue
        case .veteran: return Color(red: 0.4, green: 0.5, blue: 0.3) // Olive
        case .cookout: return .brown
        case .fairFestival: return .pink
        case .diving: return .cyan
        case .shopping: return .orange
        case .health: return .green
        case .outdoors: return Color(red: 0.2, green: 0.6, blue: 0.3)
        case .photography: return .gray
        case .family: return .pink
        case .gaming: return .purple
        case .realEstate: return .blue
        case .adventure: return .red
        case .seasonal: return Color(red: 0.8, green: 0.2, blue: 0.2)
        case .agriculture: return Color(red: 0.6, green: 0.5, blue: 0.2)
        case .other: return .gray
        }
    }
    
    /// SF Symbol icon name - distinct icons for each category
    var icon: String {
        switch self {
        case .all: return "mappin.circle.fill"
        case .foodDrink: return "fork.knife"
        case .music: return "music.note"
        case .arts: return "paintpalette.fill"
        case .sports: return "sportscourt.fill"
        case .automotive: return "car.fill"
        case .airshows: return "airplane"
        case .vehicleSports: return "sailboat.fill"
        case .community: return "person.3.fill"
        case .religious: return "building.columns.fill"
        case .education: return "graduationcap.fill"
        case .networking: return "link.circle.fill"
        case .veteran: return "star.circle.fill"
        case .cookout: return "flame.fill"
        case .fairFestival: return "party.popper.fill"
        case .diving: return "water.waves"
        case .shopping: return "bag.fill"
        case .health: return "heart.fill"
        case .outdoors: return "tree.fill"
        case .photography: return "camera.fill"
        case .family: return "figure.2.and.child.holdinghands"
        case .gaming: return "gamecontroller.fill"
        case .realEstate: return "house.fill"
        case .adventure: return "figure.hiking"
        case .seasonal: return "snowflake"
        case .agriculture: return "leaf.fill"
        case .other: return "star.fill"
        }
    }
    
    /// UIColor for map markers
    var uiColor: UIColor {
        UIColor(color)
    }
}
