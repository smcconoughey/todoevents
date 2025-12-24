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
    
    private let locationManager = CLLocationManager()
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }
    
    // MARK: - Location Permissions
    
    func requestLocationPermission() {
        locationManager.requestWhenInUseAuthorization()
    }
    
    func startTrackingLocation() {
        guard locationAuthorizationStatus == .authorizedWhenInUse ||
              locationAuthorizationStatus == .authorizedAlways else {
            requestLocationPermission()
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
    
    func centerOnUser() {
        guard let userLocation = userLocation else { return }
        
        withAnimation {
            region = MKCoordinateRegion(
                center: userLocation,
                span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
            )
        }
    }
    
    func centerOnEvent(_ event: Event) {
        withAnimation {
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
        
        withAnimation {
            region = MKCoordinateRegion(center: center, span: span)
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension MapViewModel: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        userLocation = location.coordinate
        
        // Center on user on first location update
        if isTrackingUser && region.center.latitude == Config.defaultLatitude {
            centerOnUser()
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        locationAuthorizationStatus = status
        
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            startTrackingLocation()
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location manager error: \(error)")
    }
}
