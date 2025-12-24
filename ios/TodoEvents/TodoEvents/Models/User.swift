import Foundation

/// User model matching API UserResponse schema
struct User: Codable, Identifiable {
    let id: Int
    let email: String
    let role: UserRole
}

/// User roles
enum UserRole: String, Codable {
    case admin
    case user
    case premium
    case enterprise
}

/// Login request (form-urlencoded)
struct LoginRequest {
    let username: String
    let password: String
    
    var formData: Data {
        "username=\(username.urlEncoded)&password=\(password.urlEncoded)"
            .data(using: .utf8)!
    }
}

/// Registration request
struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let role: String = "user"
}

/// Auth token response
struct AuthTokenResponse: Codable {
    let accessToken: String
    let tokenType: String
    
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
    }
}

// MARK: - String Extension for URL Encoding
extension String {
    var urlEncoded: String {
        addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? self
    }
}
