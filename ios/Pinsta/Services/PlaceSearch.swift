import Foundation
import MapKit

/// A candidate from MapKit search — the native replacement for Google Places.
struct PlaceCandidate: Identifiable, Hashable {
    let id: String
    let name: String
    let latitude: Double
    let longitude: Double
    let address: String?
    let city: String?
    let country: String?
    let category: PlaceCategory

    var whereLabel: String { city ?? country ?? "" }
}

enum PlaceSearch {
    /// Worldwide point-of-interest search. No key, no quota, on Apple's servers.
    static func search(_ query: String, limit: Int = 5) async throws -> [PlaceCandidate] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = .pointOfInterest
        // Cover the whole world; without this MapKit biases to the device's region.
        request.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
            span: MKCoordinateSpan(latitudeDelta: 180, longitudeDelta: 360)
        )
        let response = try await MKLocalSearch(request: request).start()
        return response.mapItems.prefix(limit).map(PlaceCandidate.init)
    }
}

extension PlaceCandidate {
    init(_ item: MKMapItem) {
        let placemark = item.placemark
        let coordinate = placemark.coordinate
        let name = item.name ?? "Unnamed place"
        self.init(
            id: "\(name)|\(coordinate.latitude),\(coordinate.longitude)",
            name: name,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: placemark.title,
            city: placemark.locality ?? placemark.subAdministrativeArea ?? placemark.administrativeArea,
            country: placemark.country,
            category: PlaceCategory.from(item.pointOfInterestCategory, name: name)
        )
    }
}
