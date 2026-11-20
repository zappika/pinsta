import AppIntents
import Foundation

/// I'm here from outside the app: the Control Center / Lock Screen button (`PinstaWidgets`), the
/// Action button and Shortcuts. Compiled into the app and the widget extension; it runs in the app,
/// which it opens, and leaves a request the list picks up (`CheckInRequest`).
struct CheckInIntent: AppIntent {
    static let title: LocalizedStringResource = "Check in"
    static let description = IntentDescription("Check in at the place you're at.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        CheckInRequest.ask()
        return .result()
    }
}

/// A check-in asked for from outside the list: a flag for a cold start (the list isn't there yet),
/// and a notification for a running app.
enum CheckInRequest {
    static let notification = Notification.Name("vicolo.checkIn")
    private static let key = "checkInRequested"

    static func ask() {
        UserDefaults.standard.set(Date.now.timeIntervalSince1970, forKey: key)
        NotificationCenter.default.post(name: notification, object: nil)
    }

    /// True once per request, and only for a fresh one (a minute): an old flag mustn't pop up later.
    static func take() -> Bool {
        let at = UserDefaults.standard.double(forKey: key)
        guard at > 0 else { return false }
        UserDefaults.standard.removeObject(forKey: key)
        return Date.now.timeIntervalSince1970 - at < 60
    }
}

#if !WIDGET
/// "Hey Siri, check in with Vicolo", and the Action button's Shortcut list.
struct VicoloShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: CheckInIntent(), phrases: ["Check in with \(.applicationName)", "Check in on \(.applicationName)"],
                    shortTitle: "Check in", systemImageName: "hand.wave")
    }
}

/// "You made it" shows a saved place once a day at most: standing there for an hour mustn't nag.
enum Arrived {
    /// Within this of a saved place (plus the fix's own error, up to 50 m) counts as there.
    static let meters: Double = 100
    private static let key = "arrivedShown"

    private static var today: String { Date.now.formatted(.iso8601.year().month().day()) }

    static func shownToday(_ p: Place) -> Bool {
        (UserDefaults.standard.dictionary(forKey: key) as? [String: String])?[p.id.uuidString] == today
    }

    static func mark(_ p: Place) {
        var shown = (UserDefaults.standard.dictionary(forKey: key) as? [String: String]) ?? [:]
        shown = shown.filter { $0.value == today }
        shown[p.id.uuidString] = today
        UserDefaults.standard.set(shown, forKey: key)
    }
}
#endif
