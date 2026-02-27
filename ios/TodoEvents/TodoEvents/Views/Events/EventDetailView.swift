import SwiftUI
import MapKit

struct EventDetailView: View {
    let event: Event
    @ObservedObject var eventsViewModel: EventsViewModel
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false
    @State private var showEditSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Banner Image
                if let bannerUrl = event.bannerImage, !bannerUrl.isEmpty,
                   let url = URL(string: bannerUrl.hasPrefix("http") ? bannerUrl : "\(Config.apiBaseURL)/\(bannerUrl)") {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(3/1, contentMode: .fill)
                                .frame(maxWidth: .infinity)
                                .frame(height: 180)
                                .clipped()
                        case .failure:
                            categoryHeader
                        default:
                            Rectangle()
                                .fill(event.eventCategory.color.opacity(0.2))
                                .frame(height: 180)
                                .overlay(ProgressView())
                        }
                    }
                } else {
                    categoryHeader
                }

                VStack(alignment: .leading, spacing: 20) {
                    // Title + Interest Button
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(event.title)
                                .font(.title2.bold())

                            if let secondary = event.secondaryCategory,
                               let cat = EventCategory(rawValue: secondary) {
                                Label(cat.displayName, systemImage: cat.icon)
                                    .font(.caption)
                                    .foregroundStyle(cat.color)
                            }
                        }

                        Spacer()

                        // Interest / Favorite Button
                        Button {
                            Task { await eventsViewModel.toggleInterest(for: event) }
                        } label: {
                            VStack(spacing: 2) {
                                Image(systemName: eventsViewModel.isInterested(in: event) ? "heart.fill" : "heart")
                                    .font(.system(size: 24))
                                    .foregroundStyle(eventsViewModel.isInterested(in: event) ? .red : .secondary)
                                    .animation(.spring(response: 0.3, dampingFraction: 0.5), value: eventsViewModel.isInterested(in: event))

                                if let count = event.interestCount, count > 0 {
                                    Text("\(count)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    // Stats Row
                    if (event.viewCount ?? 0) > 0 || (event.interestCount ?? 0) > 0 {
                        HStack(spacing: 16) {
                            if let views = event.viewCount, views > 0 {
                                Label("\(views) views", systemImage: "eye")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let interest = event.interestCount, interest > 0 {
                                Label("\(interest) interested", systemImage: "heart")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Description
                    Text(event.description)
                        .font(.body)
                        .foregroundStyle(.secondary)

                    Divider()

                    // Date & Time
                    VStack(alignment: .leading, spacing: 12) {
                        DetailRow(icon: "calendar", title: "Date", value: event.formattedDate)
                        DetailRow(icon: "clock", title: "Time", value: event.formattedTime)

                        if let endTime = event.endTime {
                            DetailRow(icon: "clock.badge.checkmark", title: "Ends", value: endTime)
                        }

                        if let endDate = event.endDate, !endDate.isEmpty {
                            DetailRow(icon: "calendar.badge.clock", title: "End Date", value: formatDateString(endDate))
                        }

                        if event.recurring {
                            DetailRow(
                                icon: "repeat",
                                title: "Recurring",
                                value: event.frequency?.capitalized ?? "Yes"
                            )
                        }
                    }

                    Divider()

                    // Location
                    VStack(alignment: .leading, spacing: 12) {
                        DetailRow(icon: "mappin.and.ellipse", title: "Address", value: event.address)

                        if !event.locationString.isEmpty {
                            DetailRow(icon: "building.2", title: "City", value: event.locationString)
                        }

                        if let distance = eventsViewModel.formattedDistance(to: event) {
                            DetailRow(icon: "location", title: "Distance", value: distance)
                        }
                    }

                    // Mini Map
                    Map(coordinateRegion: .constant(MKCoordinateRegion(
                        center: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng),
                        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    )), annotationItems: [event]) { event in
                        MapMarker(coordinate: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng), tint: event.eventCategory.color)
                    }
                    .frame(height: 150)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Divider()

                    // Additional Info
                    if event.hostName != nil || event.eventUrl != nil || event.price != nil || event.feeRequired != nil {
                        VStack(alignment: .leading, spacing: 12) {
                            if let host = event.hostName {
                                DetailRow(icon: "person.circle", title: "Host", value: host)
                            }

                            if let fee = event.feeRequired, !fee.isEmpty, fee.lowercased() != "no" {
                                DetailRow(icon: "ticket", title: "Admission", value: fee)
                            } else if let price = event.price, price > 0 {
                                DetailRow(
                                    icon: "dollarsign.circle",
                                    title: "Price",
                                    value: String(format: "$%.2f", price)
                                )
                            } else {
                                DetailRow(icon: "dollarsign.circle", title: "Price", value: "Free")
                            }
                        }

                        Divider()
                    }

                    // Action Buttons
                    VStack(spacing: 12) {
                        // Directions
                        Button {
                            openInMaps()
                        } label: {
                            Label("Get Directions", systemImage: "map")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(.blue)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Event URL
                        if let urlString = event.eventUrl, let url = URL(string: urlString) {
                            Link(destination: url) {
                                Label("View Event Website", systemImage: "globe")
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color(.systemGray5))
                                    .foregroundStyle(.primary)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }

                        // Share
                        ShareLink(item: shareText) {
                            Label("Share Event", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color(.systemGray5))
                                .foregroundStyle(.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Edit (if owner)
                        if authViewModel.currentUser?.id == event.createdBy {
                            Button {
                                showEditSheet = true
                            } label: {
                                Label("Edit Event", systemImage: "pencil")
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(.orange.opacity(0.15))
                                    .foregroundStyle(.orange)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }

                        // Delete (if owner)
                        if authViewModel.currentUser?.id == event.createdBy {
                            Button(role: .destructive) {
                                showDeleteConfirmation = true
                            } label: {
                                Label("Delete Event", systemImage: "trash")
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(.red.opacity(0.1))
                                    .foregroundStyle(.red)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .disabled(isDeleting)
                        }
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Event Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") {
                    dismiss()
                }
            }
        }
        .alert("Delete Event", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                deleteEvent()
            }
        } message: {
            Text("Are you sure you want to delete this event? This cannot be undone.")
        }
        .sheet(isPresented: $showEditSheet) {
            NavigationStack {
                EditEventView(event: event, eventsViewModel: eventsViewModel)
            }
        }
    }

    // Category header fallback when no banner image
    private var categoryHeader: some View {
        HStack {
            Label(event.eventCategory.displayName, systemImage: event.eventCategory.icon)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(event.eventCategory.color)
                .clipShape(Capsule())

            Spacer()

            if event.verified == true {
                Label("Verified", systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            }

            if event.isPremiumEvent == true {
                Image(systemName: "crown.fill")
                    .font(.caption)
                    .foregroundStyle(.yellow)
            }
        }
        .padding()
    }

    private var shareText: String {
        var text = "\(event.title)\n\(event.formattedDate) at \(event.formattedTime)\n\(event.address)"
        if let host = event.hostName {
            text += "\nHosted by \(host)"
        }
        if let fee = event.feeRequired, !fee.isEmpty {
            text += "\n\(fee)"
        }
        if let slug = event.slug {
            text += "\nhttps://todoevents.com/e/\(slug)"
        }
        return text
    }

    private func formatDateString(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: dateStr) {
            let display = DateFormatter()
            display.dateStyle = .medium
            return display.string(from: date)
        }
        return dateStr
    }

    private func openInMaps() {
        let coordinate = CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng)
        let placemark = MKPlacemark(coordinate: coordinate)
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = event.title
        mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }

    private func deleteEvent() {
        isDeleting = true
        Task {
            do {
                try await eventsViewModel.deleteEvent(event)
                dismiss()
            } catch {
                print("Failed to delete event: \(error)")
            }
            isDeleting = false
        }
    }
}

// MARK: - Detail Row

struct DetailRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.blue)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.body)
            }
        }
    }
}

#Preview {
    NavigationStack {
        EventDetailView(
            event: Event(
                id: 1,
                title: "Sample Event",
                description: "This is a sample event description.",
                shortDescription: nil,
                date: "2024-12-25",
                startTime: "14:00",
                endTime: "16:00",
                endDate: nil,
                category: "music",
                secondaryCategory: nil,
                address: "123 Main St",
                city: "New York",
                state: "NY",
                country: "USA",
                lat: 40.7128,
                lng: -74.0060,
                recurring: false,
                frequency: nil,
                feeRequired: nil,
                price: 25.0,
                currency: "USD",
                eventUrl: "https://example.com",
                hostName: "John Doe",
                organizerUrl: nil,
                verified: true,
                isPremiumEvent: false,
                bannerImage: nil,
                logoImage: nil,
                slug: nil,
                isPublished: true,
                createdBy: 1,
                createdAt: "2024-12-01",
                updatedAt: nil,
                startDatetime: nil,
                endDatetime: nil,
                interestCount: 10,
                viewCount: 100
            ),
            eventsViewModel: EventsViewModel()
        )
        .environmentObject(AuthViewModel())
    }
}
