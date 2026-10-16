import Foundation

/// How each save sheet ended, sent to `POST /api/saves` for the backoffice Saves page (Sarp, 2026-10-16):
/// testers rarely report a miss, so the app does. Anonymous: a random install id, the build, the link,
/// what the search offered and how it ended. Never the list, never a name.
///
/// Reports wait in the App Group defaults until the server has them: the share extension can be
/// killed the moment its card closes, so whatever didn't go out is sent on the app's next launch.
enum SaveReport {
    enum Outcome: String, Codable { case auto, picked, searched, many, already, changed, gave_up }

    struct Detail: Codable {
        var readError: String?
        var source: String?
        var offered: Int?
        var rank: Int?
        var google: Bool?
        var listed: Int?
        var saved: Int?
        var step: String?
        var place: String?
        var seconds: Int?
        var via: String?
    }

    private struct Entry: Codable {
        let id: String
        let install: String
        let build: Int?
        let url: String?
        let outcome: Outcome
        let detail: Detail
    }

    private static let pendingKey = "pendingSaveReports"
    private static let maxPending = 100
    private static var defaults: UserDefaults? { UserDefaults(suiteName: Persistence.appGroup) }

    /// One random id per install, shared by the app and the extension. Says "the same phone", not who.
    static var install: String {
        if let id = defaults?.string(forKey: "installID") { return id }
        let id = UUID().uuidString
        defaults?.set(id, forKey: "installID")
        return id
    }

    static func send(_ outcome: Outcome, url: String?, detail: Detail) {
        let entry = Entry(
            id: UUID().uuidString, install: install,
            build: (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String).flatMap(Int.init),
            url: url, outcome: outcome, detail: detail
        )
        var pending = load()
        pending.append(entry)
        store(Array(pending.suffix(maxPending)))
        Task { await flush() }
    }

    /// Sends whatever waits; on launch and after each report. A report the server took or
    /// refused (400: it never will) leaves the queue; one that didn't get through stays.
    static func flush() async {
        for entry in load() {
            var request = URLRequest(url: PostReader.baseURL.appending(path: "api/saves"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONEncoder().encode(entry)
            request.timeoutInterval = 10
            guard let (_, response) = try? await URLSession.shared.data(for: request),
                  let status = (response as? HTTPURLResponse)?.statusCode, status == 200 || status == 400 else { return }
            // Re-read: the app and the extension may both be flushing (the server stores an id once).
            store(load().filter { $0.id != entry.id })
        }
    }

    private static func load() -> [Entry] {
        guard let data = defaults?.data(forKey: pendingKey) else { return [] }
        return (try? JSONDecoder().decode([Entry].self, from: data)) ?? []
    }

    private static func store(_ entries: [Entry]) {
        defaults?.set(try? JSONEncoder().encode(entries), forKey: pendingKey)
    }
}
