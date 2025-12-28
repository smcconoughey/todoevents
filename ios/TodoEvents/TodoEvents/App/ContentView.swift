import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var eventsViewModel = EventsViewModel()
    @State private var selectedTab = 0
    @State private var showingLogin = false
    @State private var showingCreateEvent = false
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Map Tab
            MapTabView(
                eventsViewModel: eventsViewModel,
                showingCreateEvent: $showingCreateEvent
            )
            .tabItem {
                Image(systemName: "map")
                Text("Explore")
            }
            .tag(0)
            
            // Events List Tab
            EventListView(eventsViewModel: eventsViewModel)
                .tabItem {
                    Image(systemName: "list.bullet")
                    Text("Events")
                }
                .tag(1)
            
            // Profile/Account Tab
            ProfileView(showingLogin: $showingLogin)
                .tabItem {
                    Image(systemName: "person")
                    Text("Account")
                }
                .tag(2)
        }
        .tint(.cyan)
        .sheet(isPresented: $showingLogin) {
            NavigationStack {
                LoginView()
            }
        }
        .sheet(isPresented: $showingCreateEvent) {
            NavigationStack {
                CreateEventView(eventsViewModel: eventsViewModel)
            }
        }
        .task {
            await eventsViewModel.loadIfNeeded()
        }
        .onChange(of: eventsViewModel.hidePastEvents) { _ in
            eventsViewModel.applyFilters()
        }
        .onChange(of: eventsViewModel.dateFilter) { _ in
            eventsViewModel.applyFilters()
        }
        .onChange(of: eventsViewModel.distanceFilter) { _ in
            eventsViewModel.applyFilters()
        }
        .onReceive(NotificationCenter.default.publisher(for: .showLoginSheet)) { _ in
            showingLogin = true
        }
    }
}

// MARK: - Map Tab View
struct MapTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @ObservedObject var eventsViewModel: EventsViewModel
    @Binding var showingCreateEvent: Bool
    @State private var showingLoginPrompt = false
    @State private var showingFilters = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                MapView(eventsViewModel: eventsViewModel, showingFilters: $showingFilters)
                    .ignoresSafeArea(edges: .top)
                
                // Overlay controls
                VStack {
                    Spacer()
                    
                    HStack {
                        // Create Event Button - Bottom Left
                        Button {
                            if authViewModel.isAuthenticated {
                                showingCreateEvent = true
                            } else {
                                showingLoginPrompt = true
                            }
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(
                                    Circle()
                                        .fill(authViewModel.isAuthenticated ? .blue : .gray)
                                        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                                )
                        }
                        .padding(.leading, 16)
                        
                        Spacer()
                        
                        // Filter Button - Bottom Right (same size)
                        Button {
                            showingFilters = true
                        } label: {
                            Image(systemName: "line.3.horizontal.decrease")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(
                                    Circle()
                                        .fill(.blue)
                                        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                                )
                        }
                        .padding(.trailing, 16)
                    }
                    .padding(.bottom, 8)
                    
                    // Filter Bar
                    FilterBarView(eventsViewModel: eventsViewModel)
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                }
            }
            .navigationTitle("Explore")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Sign In Required", isPresented: $showingLoginPrompt) {
                Button("Sign In") {
                    NotificationCenter.default.post(name: .showLoginSheet, object: nil)
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Please sign in to create events.")
            }
            .sheet(isPresented: $showingFilters) {
                MapSettingsView(eventsViewModel: eventsViewModel)
            }
        }
    }
}

// Notification for showing login
extension Notification.Name {
    static let showLoginSheet = Notification.Name("showLoginSheet")
}

// MARK: - Profile View
struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Binding var showingLogin: Bool
    
    var body: some View {
        NavigationStack {
            List {
                if authViewModel.isAuthenticated {
                    Section {
                        HStack {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 50))
                                .foregroundStyle(.cyan)
                            VStack(alignment: .leading) {
                                Text(authViewModel.currentUser?.email ?? "User")
                                    .font(.headline)
                                Text(authViewModel.currentUser?.role.rawValue.capitalized ?? "")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                    
                    Section("My Events") {
                        NavigationLink {
                            MyEventsView()
                        } label: {
                            Label("Manage Events", systemImage: "calendar")
                        }
                    }
                    
                    Section {
                        Button(role: .destructive) {
                            authViewModel.logout()
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                } else {
                    Section {
                        Button {
                            showingLogin = true
                        } label: {
                            Label("Sign In", systemImage: "person.crop.circle.badge.plus")
                        }
                    }
                    
                    Section {
                        Text("Sign in to create and manage your events.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Account")
        }
    }
}

// MARK: - Filter Bar (Quick Category Access)
struct FilterBarView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(EventCategory.allCases.prefix(8), id: \.self) { category in
                    QuickCategoryChip(
                        category: category,
                        isSelected: eventsViewModel.selectedCategory == category
                    ) {
                        eventsViewModel.setCategory(category)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .padding(.vertical, 10)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.1), radius: 4)
    }
}

// MARK: - Quick Category Chip
struct QuickCategoryChip: View {
    let category: EventCategory
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: category.icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(category.displayName)
                    .font(.system(size: 11, weight: .medium))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(isSelected ? category.color : Color.gray.opacity(0.2))
            )
            .foregroundStyle(isSelected ? .white : .primary)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Placeholder Views
struct MyEventsView: View {
    var body: some View {
        Text("My Events")
            .navigationTitle("My Events")
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
}

