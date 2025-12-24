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
        .tint(.blue)
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
    }
}

// MARK: - Map Tab View
struct MapTabView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @Binding var showingCreateEvent: Bool
    
    var body: some View {
        NavigationStack {
            ZStack {
                MapView(eventsViewModel: eventsViewModel)
                    .ignoresSafeArea(edges: .top)
                
                // Overlay controls
                VStack {
                    Spacer()
                    
                    HStack {
                        // Create Event Button - Bottom Left, Liquid Glass
                        Button {
                            showingCreateEvent = true
                        } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(
                                    Circle()
                                        .fill(.blue)
                                        .shadow(color: .blue.opacity(0.4), radius: 8, x: 0, y: 4)
                                )
                        }
                        .buttonStyle(ScaleButtonStyle())
                        .padding(.leading, 16)
                        
                        Spacer()
                    }
                    
                    // Filter Bar
                    FilterBarView(eventsViewModel: eventsViewModel)
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                }
            }
            .navigationTitle("Explore")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
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
                                .foregroundStyle(.blue)
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

// MARK: - Filter Bar
struct FilterBarView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(EventCategory.allCases, id: \.self) { category in
                    CategoryChip(
                        category: category,
                        isSelected: eventsViewModel.selectedCategory == category
                    ) {
                        eventsViewModel.setCategory(category)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.2), lineWidth: 0.5)
        )
    }
}

// MARK: - Category Chip
struct CategoryChip: View {
    let category: EventCategory
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: category.icon)
                    .font(.caption)
                Text(category.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? category.color : Color.gray.opacity(0.2))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
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
