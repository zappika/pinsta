import CoreLocation
import Network

/// "Near me": one location fix, asked for on launch (the opening screen) or
/// when the option is picked. Port of the web's lib/geo.ts (50 km).
@MainActor
final class NearMe: NSObject, CLLocationManagerDelegate {
    static let km: Double = 50
    static let tag = "__near__"

    private let manager = CLLocationManager()
    private var waiting: CheckedContinuation<CLLocation?, Never>?

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

    /// nil when location is off or refused.
    func locate() async -> CLLocation? {
        switch manager.authorizationStatus {
        case .denied, .restricted: return nil
        default: break
        }
        return await withCheckedContinuation { c in
            waiting?.resume(returning: nil)
            waiting = c
            if manager.authorizationStatus == .notDetermined {
                manager.requestWhenInUseAuthorization()
            } else {
                manager.requestLocation()
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        Task { @MainActor in
            guard waiting != nil else { return }
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
        waiting?.resume(returning: l)
        waiting = nil
    }
}
