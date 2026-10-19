import Foundation
import SwiftData
import Observation

/// A shared Google Maps list becomes Vicolo places. Since 2026-10-19 (Sarp) the server
/// matches it (`POST /api/import/jobs`, Google at each entry's pin, `lib/import-jobs.ts`), so
/// the import goes on with the phone in a pocket and a push says it's ready. Until then a pill
/// on the map shows the count; when ready, the review is as before: grouped by type, tick, and
/// Import saves on the phone (nothing is saved by itself). One import at a time.
///
/// The running job lives in the App Group defaults (`Job`), so the share extension can start
/// one (a list shared from Google Maps) and the app picks it up, and a closed app finds its
/// job again on the next launch. The review itself is fetched again from the server then.
@MainActor @Observable
final class ListImport {
    static let shared = ListImport()

    /// More picked than this and Import asks to untick some (nobody below it sees the limit).
    static let limit = 250

    enum Status: Equatable { case matched, missing, already }
    enum SaveState: Equatable { case idle, saved, failed }
    enum Phase: Equatable { case idle, starting, matching, ready, failed }

    struct Row: Identifiable {
        let id: Int
        let name: String
        let note: String?
        let address: String?
        let latitude: Double
        let longitude: Double
        var status: Status
        var match: PlaceCandidate?
        var category: PlaceCategory = .other
        var picked = true
        var save: SaveState = .idle

        var importable: Bool { status == .matched }
    }

    /// The job as the App Group keeps it: enough to find it again and to draw the pill.
    struct Job: Codable, Equatable {
        let id: String
        let link: String
        var title: String?
        var total: Int
        var done = 0
        var ready = false
        /// The review was opened once: the pill goes, the buddy menu row stays.
        var opened = false

        private static let key = "importJob"
        private static var defaults: UserDefaults? { UserDefaults(suiteName: Persistence.appGroup) }
        static var stored: Job? { defaults?.data(forKey: key).flatMap { try? JSONDecoder().decode(Job.self, from: $0) } }
        static func store(_ job: Job?) {
            if let job, let data = try? JSONEncoder().encode(job) { defaults?.set(data, forKey: key) } else { defaults?.removeObject(forKey: key) }
        }
    }

    private(set) var job: Job?
    private(set) var phase: Phase = .idle
    private(set) var owner: String?
    var rows: [Row] = []
    /// The whole list goes in as Been there (true) or Want to go (false); nil until picked,
    /// so the import asks (Sarp, 2026-10-11: sixty unsorted places would never get sorted).
    var visited: Bool?
    private(set) var error: String?
    /// Import was tapped.
    private(set) var importing = false

    private var poller: Task<Void, Never>?
    private var context: ModelContext?

    var link: String? { job?.link }
    var title: String? { job?.title }
    var reading: Bool { phase == .starting }
    var matching: Bool { phase == .matching }
    var picked: [Row] { rows.filter { $0.importable && $0.picked && $0.save != .saved } }
    var savedCount: Int { rows.filter { $0.save == .saved }.count }
    /// Imported everything that was picked.
    var finished: Bool { importing && picked.isEmpty }
    /// Something to come back to: the buddy menu shows it.
    var active: Bool { job != nil && !finished }
    /// The pill on the map: while the server matches, and once ready until the review is opened.
    var showsPill: Bool { guard let job else { return false }; return phase == .matching || (job.ready && !job.opened && !finished) }

    // MARK: Starting

    /// Reads and starts matching on the server; the push token (if the app has one) goes with it.
    func start(_ url: String, context: ModelContext) async {
        guard phase != .starting else { return }
        forget()
        self.context = context
        phase = .starting
        do {
            let answer = try await Self.startJob(url)
            adopt(Job(id: answer.id, link: url, title: answer.title, total: answer.total, done: answer.done))
            owner = answer.owner
        } catch {
            phase = .failed
            self.error = (error as? ReadError)?.message ?? "Couldn't reach Vicolo. Check the connection and try again."
        }
    }

    /// The share extension's half: start the job and leave it in the App Group for the app.
    nonisolated static func startFromShare(_ url: String) async throws -> Job {
        let answer = try await startJob(url)
        let job = Job(id: answer.id, link: url, title: answer.title, total: answer.total, done: answer.done)
        Job.store(job)
        return job
    }

    /// On launch and on every return to the foreground: a job started here before, or by the
    /// share extension, is followed again.
    func resume(context: ModelContext) {
        self.context = context
        guard let stored = Job.stored else { return }
        if stored.id == job?.id, poller != nil || phase == .ready { return }
        if stored.id != job?.id { rows = []; visited = nil; importing = false; owner = nil; error = nil }
        adopt(stored)
    }

    /// Opened the review: the pill has done its job.
    func markOpened() {
        guard var job, job.ready, !job.opened else { return }
        job.opened = true
        self.job = job
        Job.store(job)
    }

    /// Back to the empty screen; the server's copy is deleted there after two weeks.
    func forget() {
        poller?.cancel()
        poller = nil
        job = nil
        Job.store(nil)
        phase = .idle
        owner = nil; error = nil
        rows = []
        visited = nil
        importing = false
    }

    private func adopt(_ job: Job) {
        self.job = job
        Job.store(job)
        phase = .matching
        poller?.cancel()
        poller = Task { await poll(job.id) }
    }

    // MARK: Following the server

    /// Every few seconds while the app is open; iOS pauses it in the background and the
    /// server goes on meanwhile. The poll also restarts a server job that stalled.
    private func poll(_ id: String) async {
        var misses = 0
        while !Task.isCancelled, job?.id == id {
            do {
                let state = try await Self.fetch(id)
                misses = 0
                guard job?.id == id else { return }
                job?.title = state.title ?? job?.title
                job?.total = state.total
                job?.done = state.done
                owner = state.owner
                if state.status == "ready", let items = state.items {
                    job?.ready = true
                    if let job { Job.store(job) }
                    fill(items)
                    phase = .ready
                    poller = nil
                    return
                }
                if state.status == "failed" {
                    phase = .failed
                    error = "Couldn't finish reading that list. Try again."
                    poller = nil
                    return
                }
                if let job { Job.store(job) }
            } catch Gone.gone {
                // Deleted on the server (two weeks old): nothing to come back to.
                forget()
                return
            } catch {
                misses += 1
            }
            try? await Task.sleep(for: .seconds(misses > 0 ? min(30, 3 * misses) : 3))
        }
    }

    private func fill(_ items: [Item]) {
        let saved = (try? context?.fetch(FetchDescriptor<Place>())) ?? []
        rows = items.enumerated().map { i, e in
            let match = e.match.map { m in
                PlaceCandidate(
                    id: "google:\(m.placeId)", name: m.name, latitude: m.lat, longitude: m.lng,
                    address: m.address, city: m.city, region: m.region, country: m.country,
                    category: PlaceCategory(rawValue: m.category) ?? .other,
                    subtype: m.primaryType
                )
            }
            var row = Row(id: i, name: e.name, note: e.note, address: e.address, latitude: e.lat, longitude: e.lng,
                          status: match == nil ? .missing : .matched, match: match, category: match?.category ?? .other)
            // Already a card: the list's own name and pin, the old link, or Google's name for it.
            let already = saved.contains { p in
                p.allPostURLs.contains(Self.link(row))
                    || SamePlace.matches(p, name: e.name, latitude: e.lat, longitude: e.lng)
                    || match.map { SamePlace.matches(p, name: $0.name, latitude: $0.latitude, longitude: $0.longitude) } == true
            }
            if already { row.status = .already; row.picked = false }
            if row.status == .missing { row.picked = false }
            return row
        }
    }

    /// The card's "post" is the list entry itself (name and Google's pin): reading the list
    /// again finds it and adds nothing.
    static func link(_ row: Row) -> String {
        var link = URLComponents(string: "https://www.google.com/maps/search/")!
        link.queryItems = [.init(name: "api", value: "1"), .init(name: "query", value: "\(row.name) \(row.latitude),\(row.longitude)")]
        return link.url?.absoluteString ?? "https://www.google.com/maps"
    }

    // MARK: Importing

    func startImport() {
        guard !importing else { return }
        importing = true
        for i in rows.indices where rows[i].importable && rows[i].picked && rows[i].save != .saved {
            save(i)
        }
        // Everything picked is in: nothing left to come back to.
        if finished { Job.store(nil) }
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
        // A row moved to another category keeps no type of the old one.
        if rows[i].category == c.category { place.subtypeRaw = c.subtype }
        place.fromListTitle = title ?? "Google Maps list"
        place.fromListOwner = owner
        if visited == true { place.visitedAt = Date() }
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

    // MARK: The server

    struct ReadError: Error { let message: String }
    private enum Gone: Error { case gone }
    private struct Match: Decodable {
        let placeId: String; let name: String; let lat: Double; let lng: Double
        let address: String?; let city: String?; let region: String?; let country: String?
        let category: String; let primaryType: String?
    }
    private struct Item: Decodable { let name: String; let note: String?; let address: String?; let lat: Double; let lng: Double; let match: Match? }
    private struct State: Decodable {
        let id: String; let status: String; let title: String?; let owner: String?
        let total: Int; let done: Int; let items: [Item]?
    }
    private struct Failure: Decodable { let error: String? }

    /// The APNs token `Push` keeps in the App Group (the extension can't register, but reads it).
    nonisolated static var pushToken: String? { UserDefaults(suiteName: Persistence.appGroup)?.string(forKey: "pushToken") }

    nonisolated private static func startJob(_ url: String) async throws -> State {
        var request = URLRequest(url: PostReader.baseURL.appending(path: "api/import/jobs"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        var body: [String: Any] = ["url": url]
        if let token = pushToken { body["token"] = token }
        #if DEBUG
        body["sandbox"] = true
        #endif
        if SaveReport.sharing { body["install"] = SaveReport.install }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw ReadError(message: (try? JSONDecoder().decode(Failure.self, from: data))?.error ?? "Couldn't read that list.")
        }
        return try JSONDecoder().decode(State.self, from: data)
    }

    nonisolated private static func fetch(_ id: String) async throws -> State {
        var request = URLRequest(url: PostReader.baseURL.appending(path: "api/import/jobs/\(id)"))
        request.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode
        if status == 404 { throw Gone.gone }
        guard status == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(State.self, from: data)
    }
}
