import Foundation

/// How the app is used, for the backoffice (Sarp, 2026-10-16: "I catch myself using the other
/// views a lot less than the map"). Per day, running totals: `open`, `pick.<view>` (a tap on the
/// view pill), `sec.<screen>` (seconds on screen). Sent to `POST /api/uses` with the same random
/// install id as `SaveReport`: no names, no list, no places.
///
/// Totals live in the App Group defaults until the server has them; a day is resent while it
/// grows (the server keeps the larger count) and dropped once it's over and sent.
enum Uses {
    private static let key = "uses"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: Persistence.appGroup) }

    static func count(_ event: String, by n: Int = 1) {
        guard n > 0 else { return }
        var all = load()
        all[today, default: [:]][event, default: 0] += n
        // A month at most, if the server is never reached.
        store(all.filter { $0.key >= day(daysAgo: 30) })
    }

    /// On launch and when the app goes to the background.
    static func flush() async {
        for (day, counts) in load().sorted(by: { $0.key < $1.key }) {
            var request = URLRequest(url: PostReader.baseURL.appending(path: "api/uses"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let build = (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String).flatMap(Int.init)
            let body: [String: Any] = ["install": SaveReport.install, "day": day, "counts": counts, "build": build as Any]
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            request.timeoutInterval = 10
            guard let (_, response) = try? await URLSession.shared.data(for: request),
                  let status = (response as? HTTPURLResponse)?.statusCode, status == 200 || status == 400 else { return }
            // Today keeps counting; a past day is done once sent (or refused for good).
            if day < today { store(load().filter { $0.key != day }) }
        }
    }

    private static var today: String { day(daysAgo: 0) }

    private static func day(daysAgo: Int) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date().addingTimeInterval(-Double(daysAgo) * 86_400))
    }

    private static func load() -> [String: [String: Int]] {
        defaults?.dictionary(forKey: key) as? [String: [String: Int]] ?? [:]
    }

    private static func store(_ all: [String: [String: Int]]) {
        defaults?.set(all, forKey: key)
    }
}

/// Seconds on each screen while the app is in front: the running screen's time is added
/// whenever the screen changes or the app leaves.
@MainActor
final class ScreenClock {
    private var screen: String?
    private var since: Date?

    func set(_ screen: String, running: Bool) {
        if let shown = self.screen, let since {
            // Under a second is a pass-through (the opening frames), not time spent.
            let seconds = Int(Date().timeIntervalSince(since).rounded())
            if seconds >= 1 { Uses.count("sec.\(shown)", by: min(seconds, 3600)) }
        }
        self.screen = screen
        since = running ? Date() : nil
    }
}
