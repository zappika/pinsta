import Foundation
import SwiftData
import CoreLocation
import MapKit
import Observation

/// A shared Google Maps list becomes Vicolo places (Sarp, 2026-10-09; the web's /import,
/// all Apple): the server only reads the list (`/api/list`, free); every entry is matched
/// here with MapKit, one after another, while the person reviews. Import can be tapped any
/// time: picked places that are matched save at once, the rest as they match. Matching and
/// saving go on after the screen is closed. One import at a time; it lives as long as the app.
@MainActor @Observable
final class ListImport {
    static let shared = ListImport()

    /// More picked than this and Import asks to untick some (nobody below it sees the limit).
    static let limit = 250

    enum Status: Equatable { case finding, matched, missing, already }
    enum SaveState: Equatable { case idle, saved, failed }

    struct Row: Identifiable {
        let id: Int
        let name: String
        let note: String?
        let address: String?
        let latitude: Double
        let longitude: Double
        var status: Status = .finding
        var match: PlaceCandidate?
        var category: PlaceCategory = .other
        var picked = true
        var save: SaveState = .idle

        var importable: Bool { status == .finding || status == .matched }
    }

    private(set) var link: String?
    private(set) var title: String?
    private(set) var owner: String?
    var rows: [Row] = []
    private(set) var reading = false
    private(set) var error: String?
    /// Import was tapped: picked rows save as soon as they're matched.
    private(set) var importing = false

    private var matcher: Task<Void, Never>?
    private var context: ModelContext?

    var picked: [Row] { rows.filter { $0.importable && $0.picked && $0.save != .saved } }
    var savedCount: Int { rows.filter { $0.save == .saved }.count }
    var findingCount: Int { rows.filter { $0.status == .finding }.count }
    /// Picked but not matched yet: they save when they are.
    var waitingCount: Int { importing ? rows.filter { $0.status == .finding && $0.picked }.count : 0 }
    var busy: Bool { reading || findingCount > 0 || (importing && waitingCount > 0) }

    // MARK: Reading

    func read(_ url: String, context: ModelContext) async {
        guard !reading else { return }
        reset()
        self.context = context
        reading = true
        defer { reading = false }
        do {
            let list = try await Self.fetch(url)
            link = url
            title = list.title
            owner = list.owner
            let saved = (try? context.fetch(FetchDescriptor<Place>())) ?? []
            rows = list.entries.enumerated().map { i, e in
                var row = Row(id: i, name: e.name, note: e.note, address: e.address, latitude: e.lat, longitude: e.lng)
                // Already a card: the entry's own name and pin are enough to tell, no search.
                if saved.contains(where: { $0.allPostURLs.contains(Self.link(row)) || SamePlace.matches($0, name: e.name, latitude: e.lat, longitude: e.lng) }) {
                    row.status = .already
                    row.picked = false
                }
                return row
            }
            matcher = Task { await matchAll() }
        } catch {
            self.error = (error as? ReadError)?.message ?? "Couldn't reach Vicolo. Check the connection and try again."
        }
    }

    func reset() {
        matcher?.cancel()
        matcher = nil
        link = nil; title = nil; owner = nil; error = nil
        rows = []
        importing = false
    }

    // MARK: Matching

    /// One entry at a time. MapKit allows ~50 searches a minute and then refuses at once
    /// (measured 2026-10-09); a refusal waits and tries the same entry again.
    private func matchAll() async {
        for i in rows.indices where rows[i].status == .finding {
            guard !Task.isCancelled else { return }
            // Unticked before its turn: not worth a search.
            if !rows[i].picked { continue }
            await match(i)
        }
        // The ones skipped while unticked, in case they were ticked again.
        for i in rows.indices where rows[i].status == .finding {
            guard !Task.isCancelled else { return }
            await match(i)
        }
    }

    private func match(_ i: Int) async {
        let row = rows[i]
        let pin = CLLocationCoordinate2D(latitude: row.latitude, longitude: row.longitude)
        while !Task.isCancelled {
            do {
                let here = CLLocation(latitude: row.latitude, longitude: row.longitude)
                // The list's pin is Google's own: the right place is the nearest, a few metres off.
                // Further than 150 m means MapKit found something else: no match, not a guess.
                var near = Self.nearest(try await PlaceSearch.search(row.name, limit: 5, near: pin), to: here, within: 150)
                // Second pass (BCN Nearby, 2026-10-09: 9 of 27 missed): towns and beaches aren't
                // points of interest, and big sites sit far from Google's pin. Any kind of result,
                // up to 2 km, but only one sharing a real word with the list's name.
                if near == nil {
                    let words = Self.words(row.name)
                    let wider = try? await Self.anything(row.name, near: pin)
                    near = Self.nearest((wider ?? []).filter { !Self.words($0.name).isDisjoint(with: words) }, to: here, within: 2000)
                }
                guard i < rows.count, rows[i].id == row.id else { return }
                // A match can still be a card under MapKit's name rather than the list's.
                let saved = (try? context?.fetch(FetchDescriptor<Place>())) ?? []
                if let near, saved.contains(where: { SamePlace.matches($0, name: near.name, latitude: near.latitude, longitude: near.longitude) }) {
                    rows[i].match = near
                    rows[i].status = .already
                    rows[i].picked = false
                } else if let near {
                    rows[i].match = near
                    rows[i].category = near.category
                    rows[i].status = .matched
                    if importing && rows[i].picked { save(i) }
                } else {
                    rows[i].status = .missing
                }
                return
            } catch let error as MKError where error.code == .loadingThrottled {
                try? await Task.sleep(for: .seconds(8))
            } catch {
                // No result is an error too in MapKit: nothing near the pin.
                guard i < rows.count, rows[i].id == row.id else { return }
                rows[i].status = .missing
                return
            }
        }
    }

    /// The card's "post" is the list entry itself (name and Google's pin): reading the list
    /// again finds it and adds nothing.
    static func link(_ row: Row) -> String {
        var link = URLComponents(string: "https://www.google.com/maps/search/")!
        link.queryItems = [.init(name: "api", value: "1"), .init(name: "query", value: "\(row.name) \(row.latitude),\(row.longitude)")]
        return link.url?.absoluteString ?? "https://www.google.com/maps"
    }

    private static func nearest(_ found: [PlaceCandidate], to here: CLLocation, within metres: Double) -> PlaceCandidate? {
        found
            .map { ($0, CLLocation(latitude: $0.latitude, longitude: $0.longitude).distance(from: here)) }
            .filter { $0.1 <= metres }
            .min { $0.1 < $1.1 }?.0
    }

    private static func anything(_ name: String, near pin: CLLocationCoordinate2D) async throws -> [PlaceCandidate] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = name
        request.resultTypes = [.pointOfInterest, .address]
        request.region = MKCoordinateRegion(center: pin, latitudinalMeters: 10_000, longitudinalMeters: 10_000)
        return try await MKLocalSearch(request: request).start().mapItems.prefix(8).map(PlaceCandidate.init)
    }

    private static func words(_ s: String) -> Set<String> {
        Set(s.lowercased().folding(options: .diacriticInsensitive, locale: nil)
            .split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count > 2 })
    }

    // MARK: Importing

    func startImport() {
        guard !importing || waitingCount == 0 else { return }
        importing = true
        for i in rows.indices where rows[i].status == .matched && rows[i].picked && rows[i].save != .saved {
            save(i)
        }
    }

    private func save(_ i: Int) {
        guard let context, let c = rows[i].match else { return }
        let all = (try? context.fetch(FetchDescriptor<Place>())) ?? []
        if all.contains(where: { SamePlace.matches($0, name: c.name, latitude: c.latitude, longitude: c.longitude) }) {
            rows[i].status = .already
            return
        }
        let place = Place(
            instagramURL: Self.link(rows[i]),
            name: c.name, latitude: c.latitude, longitude: c.longitude,
            address: c.address, city: c.city, region: c.region, country: c.country,
            category: rows[i].category
        )
        place.website = c.website
        place.fromListTitle = title ?? "Google Maps list"
        place.fromListOwner = owner
        context.insert(place)
        do {
            try context.save()
            rows[i].save = .saved
        } catch {
            rows[i].save = .failed
            return
        }
        Task {
            await PriceLookup.check(place, in: context)
            await PhotoRetry.run(in: context)
        }
    }

    // MARK: The list

    private struct ReadError: Error { let message: String }
    private struct Entry: Decodable { let name: String; let note: String?; let address: String?; let lat: Double; let lng: Double }
    private struct List: Decodable { let title: String?; let owner: String?; let entries: [Entry] }
    private struct Failure: Decodable { let error: String? }

    private static func fetch(_ url: String) async throws -> List {
        var request = URLRequest(url: PostReader.baseURL.appending(path: "api/list"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["url": url])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw ReadError(message: (try? JSONDecoder().decode(Failure.self, from: data))?.error ?? "Couldn't read that list.")
        }
        return try JSONDecoder().decode(List.self, from: data)
    }
}
