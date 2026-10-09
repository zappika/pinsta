import SwiftUI
import MapKit

/// Small per-device preferences, stored in UserDefaults. Port of the web's
/// lib/directions.ts and lib/theme.ts.
@Observable
final class Settings {
    static let shared = Settings()

    enum MapsApp: String, CaseIterable { case apple, google
        var label: String { self == .apple ? "Apple Maps" : "Google Maps" }
    }
    enum Appearance: String, CaseIterable { case system, light, dark
        var label: String { rawValue.capitalized }
        var scheme: ColorScheme? { self == .light ? .light : self == .dark ? .dark : nil }
    }

    var mapsApp: MapsApp? {
        didSet { UserDefaults.standard.set(mapsApp?.rawValue, forKey: "vicolo.maps") }
    }
    var appearance: Appearance {
        didSet { UserDefaults.standard.set(appearance.rawValue, forKey: "vicolo.theme") }
    }

    /// Set when Directions is tapped with no default yet: the chooser opens for this place.
    var choosingFor: Place?
    var choosingOpen = false
    /// The Settings sheet (buddy menu → Settings).
    var showingSheet = false
    /// The share tutorial on demand (buddy menu → How to save), over a full list too.
    var showingTutorial = false
    /// Buddy menu → Been there.
    var showingBeenThere = false
    var showingImport = false

    private init() {
        mapsApp = UserDefaults.standard.string(forKey: "vicolo.maps").flatMap(MapsApp.init(rawValue:))
        appearance = UserDefaults.standard.string(forKey: "vicolo.theme").flatMap(Appearance.init(rawValue:)) ?? .system
    }

    /// The card's Directions button: open straight away, or ask first.
    func directions(to place: Place) {
        if let app = mapsApp { open(place, in: app) } else { choosingFor = place; choosingOpen = true }
    }

    func pick(_ app: MapsApp) {
        mapsApp = app
        if let place = choosingFor { open(place, in: app) }
        choosingFor = nil
        choosingOpen = false
    }

    func open(_ place: Place, in app: MapsApp) {
        switch app {
        case .apple:
            let item = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)))
            item.name = place.name
            item.openInMaps()
        case .google:
            // The name alone may find the wrong venue. A saved Google ID is
            // exact; native MapKit saves have no ID, so use their coordinates.
            // Maps URLs open the Google Maps app when installed, or the browser.
            var url = URLComponents(string: "https://www.google.com/maps/search/")!
            url.queryItems = [
                URLQueryItem(name: "api", value: "1"),
                URLQueryItem(name: "query", value: place.googlePlaceID == nil
                    ? "\(place.latitude),\(place.longitude)" : place.name),
            ]
            if let id = place.googlePlaceID { url.queryItems?.append(URLQueryItem(name: "query_place_id", value: id)) }
            if let link = url.url { UIApplication.shared.open(link) }
        }
    }
}
