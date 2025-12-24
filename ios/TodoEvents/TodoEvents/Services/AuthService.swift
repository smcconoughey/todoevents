import Foundation

/// Authentication service for login/register
actor AuthService {
    static let shared = AuthService()
    
    private let api = APIClient.shared
    
    private init() {}
    
    // MARK: - Login
    
    /// Login with email and password
    /// Returns the access token on success
    func login(email: String, password: String) async throws -> String {
        let request = LoginRequest(username: email, password: password)
        
        let response: AuthTokenResponse = try await api.postForm("/token", formData: request.formData)
        
        return response.accessToken
    }
    
    // MARK: - Register
    
    /// Register a new user
    func register(email: String, password: String) async throws -> User {
        let request = RegisterRequest(email: email, password: password)
        
        let user: User = try await api.post("/users", body: request)
        
        return user
    }
    
    // MARK: - Current User
    
    /// Get current authenticated user
    func getCurrentUser() async throws -> User {
        try await api.get("/users/me")
    }
}
