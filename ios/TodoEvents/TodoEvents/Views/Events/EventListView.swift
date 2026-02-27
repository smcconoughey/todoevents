import SwiftUI

struct EventListView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @State private var selectedEvent: Event?

    var body: some View {
        NavigationStack {
            Group {
                if eventsViewModel.isLoading && eventsViewModel.events.isEmpty {
                    ProgressView("Loading events...")
                } else if eventsViewModel.filteredEvents.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "calendar.badge.exclamationmark")
                            .font(.system(size: 50))
                            .foregroundStyle(.secondary)
                        Text("No Events Found")
                            .font(.title2.bold())
                        Text("Try changing your filters or search query")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)

                        if !eventsViewModel.searchText.isEmpty {
                            Button("Clear Search") {
                                eventsViewModel.searchText = ""
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding()
                } else {
                    List(eventsViewModel.filteredEvents) { event in
                        EventRowView(event: event, distance: eventsViewModel.formattedDistance(to: event))
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedEvent = event
                            }
                    }
                    .listStyle(.plain)
                    .refreshable {
                        await eventsViewModel.fetchAllEvents()
                    }
                }
            }
            .navigationTitle("Events")
            .searchable(text: $eventsViewModel.searchText, prompt: "Search events, venues, hosts...")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(EventCategory.allCases, id: \.self) { category in
                            Button {
                                eventsViewModel.selectedCategory = category
                                eventsViewModel.applyFilters()
                            } label: {
                                HStack {
                                    Image(systemName: category.icon)
                                    Text(category.displayName)
                                    if eventsViewModel.selectedCategory == category {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        Label("Filter", systemImage: "line.3.horizontal.decrease.circle")
                    }
                }

                ToolbarItem(placement: .topBarLeading) {
                    if !eventsViewModel.searchText.isEmpty || eventsViewModel.selectedCategory != .all {
                        Text("\(eventsViewModel.filteredEvents.count) results")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .sheet(item: $selectedEvent) { event in
                NavigationStack {
                    EventDetailView(event: event, eventsViewModel: eventsViewModel)
                }
            }
        }
    }
}

// MARK: - Event Row

struct EventRowView: View {
    let event: Event
    let distance: String?

    var body: some View {
        HStack(spacing: 12) {
            // Category Icon with optional logo overlay
            ZStack {
                if let logoUrl = event.logoImage, !logoUrl.isEmpty,
                   let url = URL(string: logoUrl.hasPrefix("http") ? logoUrl : "\(Config.apiBaseURL)/\(logoUrl)") {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                        default:
                            categoryCircle
                        }
                    }
                } else {
                    categoryCircle
                }
            }

            // Event Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text(event.title)
                        .font(.headline)
                        .lineLimit(1)

                    if event.verified == true {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption2)
                            .foregroundStyle(.green)
                    }
                }

                HStack(spacing: 8) {
                    Label(event.formattedDate, systemImage: "calendar")
                    Label(event.formattedTime, systemImage: "clock")
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    if !event.locationString.isEmpty {
                        Label(event.locationString, systemImage: "mappin")
                            .lineLimit(1)
                    }
                    if let interest = event.interestCount, interest > 0 {
                        Label("\(interest)", systemImage: "heart.fill")
                            .foregroundStyle(.pink)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                // Distance Badge
                if let distance = distance {
                    Text(distance)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.systemGray6))
                        .clipShape(Capsule())
                }

                // Free badge
                if let fee = event.feeRequired, fee.lowercased().contains("free") {
                    Text("Free")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.green)
                } else if let price = event.price, price == 0 {
                    Text("Free")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.green)
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    private var categoryCircle: some View {
        ZStack {
            Circle()
                .fill(event.eventCategory.color.opacity(0.2))
                .frame(width: 44, height: 44)

            Image(systemName: event.eventCategory.icon)
                .font(.system(size: 18))
                .foregroundStyle(event.eventCategory.color)
        }
    }
}

#Preview {
    EventListView(eventsViewModel: EventsViewModel())
}
