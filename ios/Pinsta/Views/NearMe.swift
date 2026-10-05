import CoreLocation
import Network

/// "Near me": one location fix, asked for on launch (the opening screen) or
/// when the option is picked. Port of the web's lib/geo.ts (50 km).
@MainActor
final class NearMe: NSObject, CLLocationManagerDelegate {
    static let km: Double = 50
    static let tag = "__near__"

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
    /// the list has grown to `askAfter` places. A new user's first launches never
    /// open on a permission question; picking Near me always may ask.
    static let askAfter = 3

    enum OnOpen { case locate, wait, refused }

    func onOpen(placeCount: Int) -> OnOpen {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: return .locate
        case .notDetermined: return placeCount >= Self.askAfter ? .locate : .wait
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
