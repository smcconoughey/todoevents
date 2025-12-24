import Foundation

/// API Client for backend communication
actor APIClient {
    static let shared = APIClient()
    
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let session: URLSession
    
    private init() {
        self.baseURL = URL(string: Config.apiBaseURL)!
        
        self.decoder = JSONDecoder()
        
        self.encoder = JSONEncoder()
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }
    
    // MARK: - Public Methods
    
    /// GET request
    func get<T: Decodable>(_ endpoint: String, queryItems: [URLQueryItem]? = nil) async throws -> T {
        let request = try buildRequest(endpoint: endpoint, method: "GET", queryItems: queryItems)
        return try await performRequest(request)
    }
    
    /// POST request with JSON body
    func post<T: Decodable, E: Encodable>(_ endpoint: String, body: E) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        return try await performRequest(request)
    }
    
    /// POST request with form data (for login)
    func postForm<T: Decodable>(_ endpoint: String, formData: Data) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "POST")
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = formData
        return try await performRequest(request)
    }
    
    /// PUT request with JSON body
    func put<T: Decodable, E: Encodable>(_ endpoint: String, body: E) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, method: "PUT")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        return try await performRequest(request)
    }
    
    /// DELETE request
    func delete(_ endpoint: String) async throws {
        let request = try buildRequest(endpoint: endpoint, method: "DELETE")
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }
    
    // MARK: - Private Methods
    
    private func buildRequest(
        endpoint: String,
        method: String,
        queryItems: [URLQueryItem]? = nil
    ) throws -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: true)!
        components.queryItems = queryItems
        
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // Add auth token if available
        if let token = KeychainService.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        return request
    }
    
    private func performRequest<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            print("Decoding error: \(error)")
            if let json = String(data: data, encoding: .utf8) {
                print("Response JSON: \(json)")
            }
            throw APIError.decodingError(error)
        }
    }
    
    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 422:
            throw APIError.validationError
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case validationError
    case notFound
    case serverError(Int)
    case httpError(Int)
    case decodingError(Error)
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Please sign in to continue"
        case .validationError:
            return "Invalid data provided"
        case .notFound:
            return "Resource not found"
        case .serverError(let code):
            return "Server error (\(code))"
        case .httpError(let code):
            return "Request failed (\(code))"
        case .decodingError:
            return "Failed to process server response"
        case .networkError:
            return "Network connection error"
        }
    }
}
