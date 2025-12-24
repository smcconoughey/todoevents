import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var mode: AuthMode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var formError: String?
    
    enum AuthMode {
        case login
        case register
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 60))
                        .foregroundStyle(.blue)
                    
                    Text(mode == .login ? "Welcome Back" : "Create Account")
                        .font(.title.bold())
                    
                    Text(mode == .login ? "Sign in to create and manage events" : "Join to discover local events")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 20)
                
                // Error/Success Messages
                if let error = authViewModel.error ?? formError {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                        Text(error)
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.red.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                
                if let message = authViewModel.statusMessage {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text(message)
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.green.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                
                // Form Fields
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(mode == .login ? .password : .newPassword)
                    
                    if mode == .register {
                        SecureField("Confirm Password", text: $confirmPassword)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.newPassword)
                        
                        // Password Requirements
                        PasswordRequirementsView(password: password)
                    }
                }
                
                // Submit Button
                Button {
                    Task {
                        await handleSubmit()
                    }
                } label: {
                    HStack {
                        if authViewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(mode == .login ? "Sign In" : "Create Account")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(.blue)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(authViewModel.isLoading)
                
                // Toggle Mode
                Button {
                    withAnimation {
                        mode = mode == .login ? .register : .login
                        formError = nil
                        password = ""
                        confirmPassword = ""
                    }
                } label: {
                    Text(mode == .login ? "Don't have an account? Sign up" : "Already have an account? Sign in")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(mode == .login ? "Sign In" : "Sign Up")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
    }
    
    private func handleSubmit() async {
        formError = nil
        
        // Validation
        guard !email.isEmpty, !password.isEmpty else {
            formError = "Please fill in all fields"
            return
        }
        
        if mode == .register {
            guard password == confirmPassword else {
                formError = "Passwords do not match"
                return
            }
            
            let validation = authViewModel.validatePassword(password)
            guard validation.isValid else {
                formError = "Password does not meet requirements"
                return
            }
        }
        
        // Submit
        let success: Bool
        if mode == .register {
            success = await authViewModel.register(email: email, password: password)
            if success {
                // Switch to login mode after successful registration
                mode = .login
                password = ""
            }
        } else {
            success = await authViewModel.login(email: email, password: password)
            if success {
                dismiss()
            }
        }
    }
}

// MARK: - Password Requirements View

struct PasswordRequirementsView: View {
    let password: String
    @EnvironmentObject var authViewModel: AuthViewModel
    
    var body: some View {
        let validation = authViewModel.validatePassword(password)
        
        VStack(alignment: .leading, spacing: 4) {
            Text("Password Requirements:")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            RequirementRow(met: validation.hasLength, text: "At least 8 characters")
            RequirementRow(met: validation.hasUppercase, text: "One uppercase letter")
            RequirementRow(met: validation.hasLowercase, text: "One lowercase letter")
            RequirementRow(met: validation.hasNumber, text: "One number")
            RequirementRow(met: validation.hasSpecial, text: "One special character")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct RequirementRow: View {
    let met: Bool
    let text: String
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(met ? .green : .secondary)
                .font(.caption)
            Text(text)
                .font(.caption)
                .foregroundStyle(met ? .primary : .secondary)
        }
    }
}

#Preview {
    NavigationStack {
        LoginView()
            .environmentObject(AuthViewModel())
    }
}
