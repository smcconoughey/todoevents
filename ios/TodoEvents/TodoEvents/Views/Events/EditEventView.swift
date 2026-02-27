import SwiftUI
import MapKit

struct EditEventView: View {
    let event: Event
    @ObservedObject var eventsViewModel: EventsViewModel
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss

    // Form State
    @State private var title: String
    @State private var description: String
    @State private var date: Date
    @State private var startTime: Date
    @State private var endTime: Date
    @State private var hasEndTime: Bool
    @State private var category: EventCategory
    @State private var address: String
    @State private var city: String
    @State private var state: String
    @State private var latitude: Double?
    @State private var longitude: Double?
    @State private var hostName: String
    @State private var eventUrl: String
    @State private var isFree: Bool
    @State private var price: String
    @State private var isRecurring: Bool
    @State private var frequency: String
    @State private var feeRequired: String

    // UI State
    @State private var isSubmitting = false
    @State private var error: String?
    @State private var showAddressSearch = false

    init(event: Event, eventsViewModel: EventsViewModel) {
        self.event = event
        self.eventsViewModel = eventsViewModel

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let parsedDate = dateFormatter.date(from: event.date) ?? Date()

        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        let parsedStartTime = timeFormatter.date(from: event.startTime) ?? Date()
        let parsedEndTime = event.endTime.flatMap { timeFormatter.date(from: $0) } ?? Date()

        _title = State(initialValue: event.title)
        _description = State(initialValue: event.description)
        _date = State(initialValue: parsedDate)
        _startTime = State(initialValue: parsedStartTime)
        _endTime = State(initialValue: parsedEndTime)
        _hasEndTime = State(initialValue: event.endTime != nil)
        _category = State(initialValue: event.eventCategory == .all ? .community : event.eventCategory)
        _address = State(initialValue: event.address)
        _city = State(initialValue: event.city ?? "")
        _state = State(initialValue: event.state ?? "")
        _latitude = State(initialValue: event.lat)
        _longitude = State(initialValue: event.lng)
        _hostName = State(initialValue: event.hostName ?? "")
        _eventUrl = State(initialValue: event.eventUrl ?? "")
        _isFree = State(initialValue: (event.price ?? 0) == 0)
        _price = State(initialValue: event.price.map { String(format: "%.2f", $0) } ?? "")
        _isRecurring = State(initialValue: event.recurring)
        _frequency = State(initialValue: event.frequency ?? "weekly")
        _feeRequired = State(initialValue: event.feeRequired ?? "")
    }

    var body: some View {
        Form {
            Section("Event Details") {
                TextField("Event Title", text: $title)

                Picker("Category", selection: $category) {
                    ForEach(EventCategory.allCases.filter { $0 != .all }, id: \.self) { cat in
                        Label(cat.displayName, systemImage: cat.icon)
                            .tag(cat)
                    }
                }

                ZStack(alignment: .topLeading) {
                    if description.isEmpty {
                        Text("Description")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                    }
                    TextEditor(text: $description)
                        .frame(minHeight: 100)
                }
            }

            Section("Date & Time") {
                DatePicker("Date", selection: $date, displayedComponents: .date)
                DatePicker("Start Time", selection: $startTime, displayedComponents: .hourAndMinute)

                Toggle("Has End Time", isOn: $hasEndTime)

                if hasEndTime {
                    DatePicker("End Time", selection: $endTime, displayedComponents: .hourAndMinute)
                }

                Toggle("Recurring Event", isOn: $isRecurring)

                if isRecurring {
                    Picker("Frequency", selection: $frequency) {
                        Text("Daily").tag("daily")
                        Text("Weekly").tag("weekly")
                        Text("Monthly").tag("monthly")
                    }
                }
            }

            Section("Location") {
                Button {
                    showAddressSearch = true
                } label: {
                    HStack {
                        Text(address.isEmpty ? "Search Address" : address)
                            .foregroundStyle(address.isEmpty ? .secondary : .primary)
                        Spacer()
                        Image(systemName: "magnifyingglass")
                    }
                }

                if latitude != nil && longitude != nil {
                    HStack {
                        Image(systemName: "mappin.circle.fill")
                            .foregroundStyle(.green)
                        Text("Location set")
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Section("Organizer (Optional)") {
                TextField("Host Name", text: $hostName)
                TextField("Event Website URL", text: $eventUrl)
                    .keyboardType(.URL)
                    .autocapitalization(.none)
            }

            Section("Pricing") {
                Toggle("Free Event", isOn: $isFree)

                if !isFree {
                    HStack {
                        Text("$")
                        TextField("Price", text: $price)
                            .keyboardType(.decimalPad)
                    }
                    TextField("Fee Details (e.g. '$10 general admission')", text: $feeRequired)
                }
            }

            if let error = error {
                Section {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
        }
        .navigationTitle("Edit Event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") {
                    dismiss()
                }
            }

            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") {
                    submitUpdate()
                }
                .fontWeight(.semibold)
                .disabled(isSubmitting || !isFormValid)
            }
        }
        .sheet(isPresented: $showAddressSearch) {
            AddressSearchView(
                address: $address,
                city: $city,
                state: $state,
                latitude: $latitude,
                longitude: $longitude
            )
        }
    }

    private var isFormValid: Bool {
        !title.isEmpty &&
        !description.isEmpty &&
        !address.isEmpty &&
        latitude != nil &&
        longitude != nil
    }

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }

    private func submitUpdate() {
        guard isFormValid else {
            error = "Please fill in all required fields"
            return
        }

        isSubmitting = true
        error = nil

        let eventData = EventCreate(
            title: title,
            description: description,
            date: dateFormatter.string(from: date),
            startTime: timeFormatter.string(from: startTime),
            endTime: hasEndTime ? timeFormatter.string(from: endTime) : nil,
            category: category.rawValue,
            address: address,
            lat: latitude!,
            lng: longitude!,
            city: city.isEmpty ? nil : city,
            state: state.isEmpty ? nil : state,
            country: "USA",
            eventUrl: eventUrl.isEmpty ? nil : eventUrl,
            hostName: hostName.isEmpty ? nil : hostName,
            recurring: isRecurring,
            feeRequired: isFree ? "no" : (feeRequired.isEmpty ? "yes" : feeRequired),
            price: isFree ? nil : Double(price)
        )

        Task {
            do {
                _ = try await eventsViewModel.updateEvent(event, with: eventData)
                dismiss()
            } catch {
                self.error = "Failed to update event. Please try again."
            }
            isSubmitting = false
        }
    }
}
