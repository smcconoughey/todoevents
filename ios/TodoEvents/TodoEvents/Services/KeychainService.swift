import Foundation
import Security

/// Keychain service for secure token storage
final class KeychainService {
    static let shared = KeychainService()
    
    private let service = Config.keychainService
    private let tokenKey = "authToken"
    
    private init() {}
    
    // MARK: - Token Management
    
    /// Save auth token to keychain
    func saveToken(_ token: String) {
        let data = Data(token.utf8)
        
        // Delete existing token first
        deleteToken()
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status != errSecSuccess {
            print("Error saving token to keychain: \(status)")
        }
    }
    
    /// Get auth token from keychain
    func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    /// Delete auth token from keychain
    func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey
        ]
        
        SecItemDelete(query as CFDictionary)
    }
    
    /// Check if user is authenticated
    var isAuthenticated: Bool {
        getToken() != nil
    }
}
