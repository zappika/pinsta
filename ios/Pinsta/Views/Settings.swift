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

    private init() {
        mapsApp = UserDefaults.standard.string(forKey: "vicolo.maps").flatMap(MapsApp.init(rawValue:))
        appearance = UserDefaults.standard.string(forKey: "vicolo.theme").flatMap(Appearance.init(rawValue:)) ?? .system
    }

    /// The card's Directions button: open straight away, or ask first.
    func directions(to place: Place) {
        if let app = mapsApp { open(place, in: app) } else { choosingFor = place; choosingOpen = true }
    }

    /// From the buddy menu: ask again, with no place to open afterwards.
    func chooseAgain() { choosingFor = nil; choosingOpen = true }

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
            let q = place.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? place.name
            let native = URL(string: "comgooglemaps://?q=\(q)&center=\(place.latitude),\(place.longitude)")!
            let web = URL(string: "https://www.google.com/maps/search/?api=1&query=\(q)&query_place_id=\(place.googlePlaceID ?? "")")!
            UIApplication.shared.open(UIApplication.shared.canOpenURL(native) ? native : web)
        }
    }
}
