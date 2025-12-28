import Foundation
import CoreLocation
import MapKit
import SwiftUI

/// View model for map-specific state and location management
@MainActor
final class MapViewModel: NSObject, ObservableObject {
    // MARK: - Published Properties
    
    @Published var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(
            latitude: Config.defaultLatitude,
            longitude: Config.defaultLongitude
        ),
        span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
    )
    @Published var userLocation: CLLocationCoordinate2D?
    @Published var locationAuthorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var isTrackingUser = false
    @Published var pendingCenterOnUser = false  // Flag to center when location arrives
    
    private let locationManager = CLLocationManager()
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10 // Update more frequently
    }
    
    // MARK: - Location Permissions
    
    func requestLocationPermission() {
        let status = locationManager.authorizationStatus
        locationAuthorizationStatus = status
        
        switch status {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            startTrackingLocation()
        default:
            break
        }
    }
    
    func startTrackingLocation() {
        // Update current status
        locationAuthorizationStatus = locationManager.authorizationStatus
        
        guard locationAuthorizationStatus == .authorizedWhenInUse ||
              locationAuthorizationStatus == .authorizedAlways else {
            locationManager.requestWhenInUseAuthorization()
            return
        }
        
        locationManager.startUpdatingLocation()
        isTrackingUser = true
    }
    
    func stopTrackingLocation() {
        locationManager.stopUpdatingLocation()
        isTrackingUser = false
    }
    
    // MARK: - Map Actions
    
    /// Center on user location - if not available yet, will center when location arrives
    func centerOnUser() {
        if let userLocation = userLocation {
            // We have location, center now
            withAnimation(.easeOut(duration: 0.3)) {
                region = MKCoordinateRegion(
                    center: userLocation,
                    span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
                )
            }
        } else {
            // Request location and set flag to center when it arrives
            pendingCenterOnUser = true
            startTrackingLocation()
            locationManager.requestLocation() // Request single location update
        }
    }
    
    func centerOnEvent(_ event: Event) {
        withAnimation(.easeOut(duration: 0.3)) {
            region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: event.lat, longitude: event.lng),
                span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
            )
        }
    }
    
    func zoomToFitEvents(_ events: [Event]) {
        guard !events.isEmpty else { return }
        
        let coordinates = events.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
        
        var minLat = coordinates[0].latitude
        var maxLat = coordinates[0].latitude
        var minLng = coordinates[0].longitude
        var maxLng = coordinates[0].longitude
        
        for coord in coordinates {
            minLat = min(minLat, coord.latitude)
            maxLat = max(maxLat, coord.latitude)
            minLng = min(minLng, coord.longitude)
            maxLng = max(maxLng, coord.longitude)
        }
        
        let center = CLLocationCoordinate2D(
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2
        )
        
        let span = MKCoordinateSpan(
            latitudeDelta: (maxLat - minLat) * 1.5,
            longitudeDelta: (maxLng - minLng) * 1.5
        )
        
        withAnimation(.easeOut(duration: 0.3)) {
            region = MKCoordinateRegion(center: center, span: span)
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension MapViewModel: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        Task { @MainActor in
            self.userLocation = location.coordinate
            
            // If we were waiting to center on user, do it now
            if self.pendingCenterOnUser {
                self.pendingCenterOnUser = false
                self.centerOnUser()
            }
        }
    }
    
    nonisolated func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        Task { @MainActor in
            self.locationAuthorizationStatus = status
            
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                self.startTrackingLocation()
                
                // If we have a pending center request, trigger location update
                if self.pendingCenterOnUser {
                    manager.requestLocation()
                }
            }
        }
    }
    
    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location manager error: \(error.localizedDescription)")
        Task { @MainActor in
            self.pendingCenterOnUser = false
        }
    }
}
