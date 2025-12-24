import SwiftUI
import MapKit

struct CreateEventView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) var dismiss
    
    // Form State
    @State private var title = ""
    @State private var description = ""
    @State private var date = Date()
    @State private var startTime = Date()
    @State private var endTime = Date()
    @State private var hasEndTime = false
    @State private var category: EventCategory = .community
    @State private var address = ""
    @State private var city = ""
    @State private var state = ""
    @State private var latitude: Double?
    @State private var longitude: Double?
    @State private var hostName = ""
    @State private var eventUrl = ""
    @State private var isFree = true
    @State private var price = ""
    @State private var isRecurring = false
    @State private var frequency = "weekly"
    
    // UI State
    @State private var isSubmitting = false
    @State private var error: String?
    @State private var showAddressSearch = false
    
    var body: some View {
        Form {
            // Basic Info
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
            
            // Date & Time
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
            
            // Location
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
            
            // Host & Links
            Section("Organizer (Optional)") {
                TextField("Host Name", text: $hostName)
                TextField("Event Website URL", text: $eventUrl)
                    .keyboardType(.URL)
                    .autocapitalization(.none)
            }
            
            // Pricing
            Section("Pricing") {
                Toggle("Free Event", isOn: $isFree)
                
                if !isFree {
                    HStack {
                        Text("$")
                        TextField("Price", text: $price)
                            .keyboardType(.decimalPad)
                    }
                }
            }
            
            // Error Display
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
        .navigationTitle("Create Event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") {
                    dismiss()
                }
            }
            
            ToolbarItem(placement: .topBarTrailing) {
                Button("Create") {
                    submitEvent()
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
    
    private func submitEvent() {
        guard isFormValid else {
            error = "Please fill in all required fields"
            return
        }
        
        guard authViewModel.isAuthenticated else {
            error = "Please sign in to create events"
            return
        }
        
        isSubmitting = true
        error = nil
        
        let eventCreate = EventCreate(
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
            feeRequired: isFree ? "no" : "yes",
            price: isFree ? nil : Double(price)
        )
        
        Task {
            do {
                _ = try await eventsViewModel.createEvent(eventCreate)
                dismiss()
            } catch {
                self.error = "Failed to create event. Please try again."
            }
            isSubmitting = false
        }
    }
}

// MARK: - Address Search View

struct AddressSearchView: View {
    @Environment(\.dismiss) var dismiss
    @Binding var address: String
    @Binding var city: String
    @Binding var state: String
    @Binding var latitude: Double?
    @Binding var longitude: Double?
    
    @State private var searchText = ""
    @State private var searchResults: [MKMapItem] = []
    @State private var isSearching = false
    
    var body: some View {
        NavigationStack {
            VStack {
                // Search Field
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search address...", text: $searchText)
                        .autocapitalization(.none)
                        .onSubmit {
                            performSearch()
                        }
                    
                    if !searchText.isEmpty {
                        Button {
                            searchText = ""
                            searchResults = []
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding()
                
                // Results
                if isSearching {
                    ProgressView()
                        .padding()
                } else {
                    List(searchResults, id: \.self) { item in
                        Button {
                            selectAddress(item)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(item.name ?? "Unknown")
                                    .font(.headline)
                                if let address = item.placemark.formattedAddress {
                                    Text(address)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
                
                Spacer()
            }
            .navigationTitle("Search Address")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func performSearch() {
        guard !searchText.isEmpty else { return }
        
        isSearching = true
        
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = searchText
        
        let search = MKLocalSearch(request: request)
        search.start { response, error in
            isSearching = false
            
            if let response = response {
                searchResults = response.mapItems
            }
        }
    }
    
    private func selectAddress(_ item: MKMapItem) {
        let placemark = item.placemark
        
        address = [
            placemark.subThoroughfare,
            placemark.thoroughfare
        ].compactMap { $0 }.joined(separator: " ")
        
        if address.isEmpty {
            address = item.name ?? ""
        }
        
        city = placemark.locality ?? ""
        state = placemark.administrativeArea ?? ""
        latitude = placemark.coordinate.latitude
        longitude = placemark.coordinate.longitude
        
        dismiss()
    }
}

// MARK: - Placemark Extension

extension CLPlacemark {
    var formattedAddress: String? {
        [subThoroughfare, thoroughfare, locality, administrativeArea]
            .compactMap { $0 }
            .joined(separator: ", ")
    }
}

#Preview {
    NavigationStack {
        CreateEventView(eventsViewModel: EventsViewModel())
            .environmentObject(AuthViewModel())
    }
}
