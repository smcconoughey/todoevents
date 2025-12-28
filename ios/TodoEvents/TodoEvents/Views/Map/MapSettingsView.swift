import SwiftUI

/// Settings view for map filtering options
struct MapSettingsView: View {
    @ObservedObject var eventsViewModel: EventsViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                // Date Filters Section
                Section {
                    Toggle("Hide Past Events", isOn: $eventsViewModel.hidePastEvents)
                    
                    Picker("Date Range", selection: $eventsViewModel.dateFilter) {
                        Text("All Dates").tag(DateFilter.all)
                        Text("Today").tag(DateFilter.today)
                        Text("This Week").tag(DateFilter.thisWeek)
                        Text("This Month").tag(DateFilter.thisMonth)
                        Text("Next 3 Months").tag(DateFilter.next3Months)
                    }
                } header: {
                    Label("Date Filters", systemImage: "calendar")
                }
                
                // Distance Filter Section
                Section {
                    Picker("Max Distance", selection: $eventsViewModel.distanceFilter) {
                        Text("Any Distance").tag(DistanceFilter.any)
                        Text("5 miles").tag(DistanceFilter.miles5)
                        Text("10 miles").tag(DistanceFilter.miles10)
                        Text("25 miles").tag(DistanceFilter.miles25)
                        Text("50 miles").tag(DistanceFilter.miles50)
                        Text("100 miles").tag(DistanceFilter.miles100)
                    }
                    
                    if eventsViewModel.userLocation == nil {
                        HStack {
                            Image(systemName: "location.slash")
                                .foregroundStyle(.orange)
                            Text("Enable location for distance filter")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Label("Distance", systemImage: "location.circle")
                }
                
                // Category Filters Section
                Section {
                    ForEach(EventCategory.allCases.filter { $0 != .all }, id: \.self) { category in
                        Button {
                            eventsViewModel.toggleCategory(category)
                        } label: {
                            HStack {
                                Image(systemName: category.icon)
                                    .foregroundStyle(category.color)
                                    .frame(width: 24)
                                
                                Text(category.displayName)
                                    .foregroundStyle(.primary)
                                
                                Spacer()
                                
                                if eventsViewModel.selectedCategories.contains(category) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.blue)
                                } else {
                                    Image(systemName: "circle")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    
                    HStack {
                        Button("Select All") {
                            eventsViewModel.selectAllCategories()
                        }
                        .font(.subheadline)
                        
                        Spacer()
                        
                        Button("Clear All") {
                            eventsViewModel.clearAllCategories()
                        }
                        .font(.subheadline)
                    }
                    .padding(.top, 8)
                } header: {
                    Label("Categories (\(eventsViewModel.selectedCategories.count))", systemImage: "tag")
                }
                
                // Stats Section
                Section {
                    HStack {
                        Text("Visible Events")
                        Spacer()
                        Text("\(eventsViewModel.filteredEvents.count)")
                            .foregroundStyle(.secondary)
                    }
                    
                    HStack {
                        Text("Total Events")
                        Spacer()
                        Text("\(eventsViewModel.events.count)")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Label("Statistics", systemImage: "chart.bar")
                }
            }
            .navigationTitle("Map Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
                
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reset") {
                        eventsViewModel.resetFilters()
                    }
                }
            }
        }
    }
}

// MARK: - Filter Enums

enum DateFilter: String, CaseIterable {
    case all = "all"
    case today = "today"
    case thisWeek = "thisWeek"
    case thisMonth = "thisMonth"
    case next3Months = "next3Months"
}

enum DistanceFilter: Double, CaseIterable {
    case any = 0
    case miles5 = 5
    case miles10 = 10
    case miles25 = 25
    case miles50 = 50
    case miles100 = 100
}

#Preview {
    MapSettingsView(eventsViewModel: EventsViewModel())
}
