import CoreLocation

/// "Near me": one location fix, asked for only when the option is picked.
/// Port of the web's lib/geo.ts (50 km).
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
