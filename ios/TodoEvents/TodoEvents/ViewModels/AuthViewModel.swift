import Foundation
import SwiftUI

/// View model for authentication state
@MainActor
final class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var error: String?
    @Published var statusMessage: String?
    
    private let authService = AuthService.shared
    private let keychain = KeychainService.shared
    
    init() {
        // Check if already authenticated
        if keychain.isAuthenticated {
            isAuthenticated = true
            Task {
                await loadCurrentUser()
            }
        }
    }
    
    // MARK: - Login
    
    func login(email: String, password: String) async -> Bool {
        isLoading = true
        error = nil
        statusMessage = nil
        
        do {
            let token = try await authService.login(email: email, password: password)
            keychain.saveToken(token)
            isAuthenticated = true
            
            // Load user info
            await loadCurrentUser()
            
            statusMessage = "Successfully signed in!"
            isLoading = false
            return true
        } catch let apiError as APIError {
            error = apiError.errorDescription
            isLoading = false
            return false
        } catch {
            self.error = "Login failed. Please try again."
            isLoading = false
            return false
        }
    }
    
    // MARK: - Register
    
    func register(email: String, password: String) async -> Bool {
        isLoading = true
        error = nil
        statusMessage = nil
        
        do {
            _ = try await authService.register(email: email, password: password)
            statusMessage = "Account created! Please sign in."
            isLoading = false
            return true
        } catch let apiError as APIError {
            if case .validationError = apiError {
                error = "Email already registered or password too weak"
            } else {
                error = apiError.errorDescription
            }
            isLoading = false
            return false
        } catch {
            self.error = "Registration failed. Please try again."
            isLoading = false
            return false
        }
    }
    
    // MARK: - Logout
    
    func logout() {
        keychain.deleteToken()
        isAuthenticated = false
        currentUser = nil
        error = nil
        statusMessage = nil
    }
    
    // MARK: - Load Current User
    
    private func loadCurrentUser() async {
        do {
            currentUser = try await authService.getCurrentUser()
        } catch {
            // Token might be invalid
            print("Failed to load current user: \(error)")
        }
    }
    
    // MARK: - Password Validation
    
    struct PasswordValidation {
        var hasLength: Bool = false
        var hasUppercase: Bool = false
        var hasLowercase: Bool = false
        var hasNumber: Bool = false
        var hasSpecial: Bool = false
        
        var isValid: Bool {
            hasLength && hasUppercase && hasLowercase && hasNumber && hasSpecial
        }
    }
    
    func validatePassword(_ password: String) -> PasswordValidation {
        PasswordValidation(
            hasLength: password.count >= 8,
            hasUppercase: password.range(of: "[A-Z]", options: .regularExpression) != nil,
            hasLowercase: password.range(of: "[a-z]", options: .regularExpression) != nil,
            hasNumber: password.range(of: "[0-9]", options: .regularExpression) != nil,
            hasSpecial: password.range(of: "[!@#$%^&*(),.?\":{}|<>]", options: .regularExpression) != nil
        )
    }
}
