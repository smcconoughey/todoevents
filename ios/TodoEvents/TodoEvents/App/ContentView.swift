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

            // Favorites Tab
            FavoritesView(eventsViewModel: eventsViewModel)
                .tabItem {
                    Image(systemName: "heart")
                    Text("Favorites")
                }
                .tag(2)

            // Profile/Account Tab
            ProfileView(showingLogin: $showingLogin, eventsViewModel: eventsViewModel)
                .tabItem {
                    Image(systemName: "person")
                    Text("Account")
                }
                .tag(3)
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
        .onChange(of: eventsViewModel.searchText) { _ in
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

                        // Filter Button - Bottom Right
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
    @ObservedObject var eventsViewModel: EventsViewModel
    @State private var showDeleteAccountConfirm = false

    var body: some View {
        NavigationStack {
            List {
                if authViewModel.isAuthenticated {
                    // User Info Section
                    Section {
                        HStack(spacing: 14) {
                            ZStack {
                                Circle()
                                    .fill(roleColor.opacity(0.15))
                                    .frame(width: 56, height: 56)
                                Image(systemName: "person.circle.fill")
                                    .font(.system(size: 40))
                                    .foregroundStyle(roleColor)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text(authViewModel.currentUser?.email ?? "User")
                                    .font(.headline)
                                HStack(spacing: 6) {
                                    Text(authViewModel.currentUser?.role.rawValue.capitalized ?? "")
                                        .font(.caption)
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(roleColor)
                                        .clipShape(Capsule())

                                    if authViewModel.currentUser?.role == .premium || authViewModel.currentUser?.role == .enterprise {
                                        Image(systemName: "crown.fill")
                                            .font(.caption)
                                            .foregroundStyle(.yellow)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }

                    // My Events Section
                    Section("My Events") {
                        NavigationLink {
                            MyEventsView(eventsViewModel: eventsViewModel)
                        } label: {
                            Label {
                                HStack {
                                    Text("Manage Events")
                                    Spacer()
                                    Text("\(eventsViewModel.userEvents.count)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color(.systemGray5))
                                        .clipShape(Capsule())
                                }
                            } icon: {
                                Image(systemName: "calendar")
                            }
                        }

                        NavigationLink {
                            FavoritesView(eventsViewModel: eventsViewModel)
                        } label: {
                            Label {
                                HStack {
                                    Text("Saved Events")
                                    Spacer()
                                    Text("\(eventsViewModel.interestedEventIds.count)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color(.systemGray5))
                                        .clipShape(Capsule())
                                }
                            } icon: {
                                Image(systemName: "heart")
                            }
                        }
                    }

                    // App Info
                    Section("About") {
                        HStack {
                            Label("Version", systemImage: "info.circle")
                            Spacer()
                            Text("1.0.0")
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Account Actions
                    Section {
                        Button(role: .destructive) {
                            authViewModel.logout()
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                } else {
                    Section {
                        VStack(spacing: 16) {
                            Image(systemName: "person.crop.circle.badge.plus")
                                .font(.system(size: 60))
                                .foregroundStyle(.cyan)

                            Text("Sign in to TodoEvents")
                                .font(.title3.bold())

                            Text("Create events, save favorites, and manage your account.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)

                            Button {
                                showingLogin = true
                            } label: {
                                Text("Sign In")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(.cyan)
                                    .foregroundStyle(.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                        .padding(.vertical, 20)
                    }
                }
            }
            .navigationTitle("Account")
            .task {
                if authViewModel.isAuthenticated {
                    await eventsViewModel.fetchUserEvents()
                }
            }
        }
    }

    private var roleColor: Color {
        switch authViewModel.currentUser?.role {
        case .admin: return .red
        case .premium: return .purple
        case .enterprise: return .orange
        default: return .cyan
        }
    }
}

// MARK: - Favorites View
struct FavoritesView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @State private var selectedEvent: Event?

    private var favoriteEvents: [Event] {
        eventsViewModel.events.filter { eventsViewModel.interestedEventIds.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if favoriteEvents.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "heart.slash")
                            .font(.system(size: 50))
                            .foregroundStyle(.secondary)
                        Text("No Saved Events")
                            .font(.title2.bold())
                        Text("Tap the heart icon on events to save them here")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                } else {
                    List(favoriteEvents) { event in
                        EventRowView(event: event, distance: eventsViewModel.formattedDistance(to: event))
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedEvent = event
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await eventsViewModel.toggleInterest(for: event) }
                                } label: {
                                    Label("Remove", systemImage: "heart.slash")
                                }
                            }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Saved Events")
            .sheet(item: $selectedEvent) { event in
                NavigationStack {
                    EventDetailView(event: event, eventsViewModel: eventsViewModel)
                }
            }
        }
    }
}

// MARK: - My Events View (Full Implementation)
struct MyEventsView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var selectedEvent: Event?
    @State private var showEditSheet = false
    @State private var eventToEdit: Event?
    @State private var eventToDelete: Event?
    @State private var showDeleteConfirm = false

    var body: some View {
        Group {
            if eventsViewModel.isLoadingUserEvents {
                ProgressView("Loading your events...")
            } else if eventsViewModel.userEvents.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 50))
                        .foregroundStyle(.secondary)
                    Text("No Events Yet")
                        .font(.title2.bold())
                    Text("Events you create will appear here")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding()
            } else {
                List {
                    ForEach(eventsViewModel.userEvents) { event in
                        EventRowView(event: event, distance: eventsViewModel.formattedDistance(to: event))
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedEvent = event
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    eventToDelete = event
                                    showDeleteConfirm = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }

                                Button {
                                    eventToEdit = event
                                    showEditSheet = true
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                .tint(.orange)
                            }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("My Events")
        .refreshable {
            await eventsViewModel.fetchUserEvents()
        }
        .task {
            await eventsViewModel.fetchUserEvents()
        }
        .sheet(item: $selectedEvent) { event in
            NavigationStack {
                EventDetailView(event: event, eventsViewModel: eventsViewModel)
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let event = eventToEdit {
                NavigationStack {
                    EditEventView(event: event, eventsViewModel: eventsViewModel)
                }
            }
        }
        .alert("Delete Event", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {
                eventToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let event = eventToDelete {
                    Task {
                        try? await eventsViewModel.deleteEvent(event)
                        eventToDelete = nil
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete \"\(eventToDelete?.title ?? "this event")\"? This cannot be undone.")
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

#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
}
