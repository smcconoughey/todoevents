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
                    ContentUnavailableView(
                        "No Events Found",
                        systemImage: "calendar.badge.exclamationmark",
                        description: Text("Try changing your filters or checking another area")
                    )
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
                        await eventsViewModel.fetchEvents()
                    }
                }
            }
            .navigationTitle("Events")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(EventCategory.allCases, id: \.self) { category in
                            Button {
                                eventsViewModel.selectedCategory = category
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
            // Category Icon
            ZStack {
                Circle()
                    .fill(event.eventCategory.color.opacity(0.2))
                    .frame(width: 44, height: 44)
                
                Image(systemName: event.eventCategory.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(event.eventCategory.color)
            }
            
            // Event Info
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    Label(event.formattedDate, systemImage: "calendar")
                    Label(event.formattedTime, systemImage: "clock")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                
                if !event.locationString.isEmpty {
                    Label(event.locationString, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
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
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    EventListView(eventsViewModel: EventsViewModel())
}
