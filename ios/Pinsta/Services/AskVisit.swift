import Foundation

/// "Been to any of these?" (Sarp, 2026-10-26): asked later, never at the save. A place saved where you
/// stood (`savedNearby`) is asked on the first open on a later day; one saved from a post or a share a
/// week on. Twice at most, a week apart, then never. Never list imports or places already marked.
/// Only places saved from the day it came (2026-10-26) on; one sheet a day at most (`gapHours`):
/// a refresh showed four more (Sarp, 2026-10-26). Same rule as lib/ask-visit.ts. Change one, change the other.
enum AskVisit {
    static let afterDays = 7
    static let atMost = 2
    /// Rows in one sheet: nearby saves first, then the newest.
    static let rows = 4
    /// A save this close to where you stood counts as saved there.
    static let savedHereMeters: Double = 150

    static let since = Date(timeIntervalSince1970: 1_792_972_800) // 2026-10-26 00:00 UTC
    static let gapHours: Double = 24
    private static let shownKey = "visitAskShown"

    /// The last sheet was under `gapHours` ago.
    static func askedRecently(now: Date = .now) -> Bool {
        guard let last = UserDefaults.standard.object(forKey: shownKey) as? Date else { return false }
        return now.timeIntervalSince(last) < gapHours * 3600
    }

    static func markAsked(now: Date = .now) { UserDefaults.standard.set(now, forKey: shownKey) }

    static func due(_ places: [Place], now: Date = .now) -> [Place] {
        let week = TimeInterval(afterDays * 86_400)
        let cal = Calendar.current
        return places
            .filter { p in
                guard p.visitedAt == nil, p.fromListTitle == nil, p.fromListOwner == nil, p.askCount < atMost else { return false }
                guard p.createdAt >= since else { return false }
                if let asked = p.askedAt, now.timeIntervalSince(asked) < week { return false }
                return p.savedNearby
                    ? cal.startOfDay(for: p.createdAt) < cal.startOfDay(for: now)
                    : now.timeIntervalSince(p.createdAt) >= week
            }
            .sorted { ($0.savedNearby ? 1 : 0, $0.createdAt) > ($1.savedNearby ? 1 : 0, $1.createdAt) }
            .prefix(rows)
            .map { $0 }
    }
}
