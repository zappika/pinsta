import CoreLocation

/// The places around you, fetched before Check in is opened, so its list is there at once (Sarp,
/// 2026-11-24: "it takes so long when I'm trying to check in"). Opening used to wait for a street-level
/// fix and then for Apple's search, one after the other.
///
/// Places don't move; you do. So the cache is keyed by *where*, not mostly by when: one search covers
/// `fetchMeters` around a fix, and stays good while you're within `moveMeters` of that fix (every place
/// within `showMeters` of you is then inside what was fetched). `maxAge` only bounds a stale answer
/// (a place opened, a search that came back thin while the network was bad).
///
/// Fetched when the app already learns where you are: on open (the opening town), back from the
/// background, and when the + menu opens (Check in is one tap away). Apple's search is free but
/// throttled (~50 a minute per app); this asks at most once per `moveMeters` walked or `maxAge`.
@MainActor
enum Around {
    static let fetchMeters: Double = 200
    static let showMeters: Double = 150
    static let moveMeters: Double = fetchMeters - showMeters
    static let maxAge: TimeInterval = 60 * 60
    /// A fix rougher than this (a cell tower) says nothing about the street.
    static let roughest: Double = 100

    private struct Snapshot {
        let at: CLLocation
        let when: Date
        let places: [PlaceCandidate]
        func covers(_ fix: CLLocation) -> Bool {
            Date.now.timeIntervalSince(when) < Around.maxAge && fix.distance(from: at) <= Around.moveMeters
        }
    }

    private static var last: Snapshot?
    /// A search on its way, and the fix it was asked for: a second ask nearby waits for it.
    private static var running: (at: CLLocation, task: Task<Snapshot, Never>)?

    /// The places around `fix`, closest first, if a search already covers it. Instant.
    static func cached(for fix: CLLocation) -> [PlaceCandidate]? {
        guard let last, last.covers(fix) else { return nil }
        return nearest(last.places, to: fix)
    }

    /// Start a search around `fix` unless one already covers it. Fire and forget.
    static func prefetch(_ fix: CLLocation) {
        guard fix.horizontalAccuracy >= 0, fix.horizontalAccuracy <= roughest else { return }
        _ = task(for: fix)
    }

    /// The places around `fix`, closest first: from the cache, a search already on its way, or a new one.
    static func places(at fix: CLLocation, limit: Int = 8) async -> [PlaceCandidate] {
        if let hit = cached(for: fix) { return Array(hit.prefix(limit)) }
        let snap = await task(for: fix).value
        return Array(nearest(snap.places, to: fix).prefix(limit))
    }

    private static func task(for fix: CLLocation) -> Task<Snapshot, Never> {
        if let last, last.covers(fix) { return Task { last } }
        if let running, fix.distance(from: running.at) <= moveMeters { return running.task }
        let t = Task { @MainActor () -> Snapshot in
            let found = await PlaceSearch.around(fix.coordinate, meters: fetchMeters, limit: 40)
            let snap = Snapshot(at: fix, when: .now, places: found)
            // An empty answer is more often a bad connection than an empty street: don't keep it.
            if !found.isEmpty { last = snap }
            if running?.at === fix { running = nil }
            return snap
        }
        running = (fix, t)
        return t
    }

    private static func nearest(_ places: [PlaceCandidate], to fix: CLLocation) -> [PlaceCandidate] {
        places
            .map { ($0, fix.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude))) }
            .filter { $0.1 <= showMeters }
            .sorted { $0.1 < $1.1 }
            .map(\.0)
    }
}
