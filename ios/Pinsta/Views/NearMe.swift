import CoreLocation
import Network

/// Where you are: one location fix on launch, for the town the map opens on and its
/// frame (no "Near me" row since 2026-10-09). Port of the web's lib/geo.ts (50 km).
@MainActor
final class NearMe: NSObject, CLLocationManagerDelegate {
    static let km: Double = 50

    /// Places wider than this are "worlds apart": Everywhere frames one country, not all of
    /// them (Lisbon to Oslo ~2,800 km fits; Japan and Spain don't). Same as SPREAD_KM in lib/geo.ts.
    static let spreadKm: Double = 4000

    /// How far apart the places are: the diagonal of the box around them (spreadKm in lib/geo.ts).
    static func spread(_ points: [CLLocationCoordinate2D]) -> Double {
        guard points.count >= 2 else { return 0 }
        let lats = points.map(\.latitude), lngs = points.map(\.longitude)
        return CLLocation(latitude: lats.min()!, longitude: lngs.min()!)
            .distance(from: CLLocation(latitude: lats.max()!, longitude: lngs.max()!)) / 1000
    }

    private let manager = CLLocationManager()
    /// Everyone asking while a fix is on its way gets that fix. (A second ask used
    /// to answer the first with nil, which sent the opening screen to the list.)
    private var waiting: [CheckedContinuation<CLLocation?, Never>] = []

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// Whether there is a connection at all. Offline, MapKit draws an empty grid,
    /// so the opening screen goes to the list instead.
    nonisolated static func online() async -> Bool {
        await withCheckedContinuation { c in
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { path in
                // The first update is the current state; stop before a second one.
                monitor.pathUpdateHandler = nil
                monitor.cancel()
                c.resume(returning: path.status == .satisfied)
            }
            monitor.start(queue: DispatchQueue(label: "vicolo.online"))
        }
    }

    /// The opening screen may use location: already allowed, or not yet asked and
    /// the list has grown to `askAfter` places (Sarp, 2026-10-15: from the second save).
    /// A new user's first launches never open on a permission question, and the system's
    /// question never comes unannounced: `.ask` shows `LocationPrimer` first.
    static let askAfter = 2

    enum OnOpen { case locate, ask, wait, refused }

    func onOpen(placeCount: Int) -> OnOpen {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: return .locate
        case .notDetermined: return placeCount >= Self.askAfter ? .ask : .wait
        default: return .refused
        }
    }

    /// nil when location is off or refused.
    func locate() async -> CLLocation? {
        switch manager.authorizationStatus {
        case .denied, .restricted: return nil
        default: break
        }
        return await withCheckedContinuation { c in
            waiting.append(c)
            guard waiting.count == 1 else { return }
            if manager.authorizationStatus == .notDetermined {
                manager.requestWhenInUseAuthorization()
            } else {
                manager.requestLocation()
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        Task { @MainActor in
            guard !waiting.isEmpty else { return }
            switch m.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways: m.requestLocation()
            case .denied, .restricted: finish(nil)
            default: break
            }
        }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let last = locations.last
        Task { @MainActor in finish(last) }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in finish(nil) }
    }

    private func finish(_ l: CLLocation?) {
        let all = waiting
        waiting = []
        for c in all { c.resume(returning: l) }
    }
}
