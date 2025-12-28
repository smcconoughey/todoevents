import Foundation

// MARK: - Date Filter

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

// MARK: - Distance Filter

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
