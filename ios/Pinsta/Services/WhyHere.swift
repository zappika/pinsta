import Foundation

/// The card's "why it's here" line, word for word the web's `lib/why-here.ts`:
/// where a place came from, said the way you'd remember it (Sarp, 2026-10-06).
///   Saved from @burro_cafe on Instagram · 14 Sep
///   Saved from a Google Maps link · 2 Oct 2025
/// The web's "From Emilie's "Paris" list" needs the Google import, which iOS
/// doesn't have yet.
enum WhyHere {
    static func line(for place: Place, now: Date = .now) -> String {
        "\(origin(place)) · \(when(place.createdAt, now: now))"
    }

    private static func origin(_ p: Place) -> String {
        let by = p.ownerUsername.map { "@" + $0.trimmingCharacters(in: CharacterSet(charactersIn: "@")) }
        switch SourceURL.parse(p.instagramURL)?.kind {
        case .tiktok:
            return by.map { "Saved from \($0) on TikTok" } ?? "Saved from a TikTok"
        case .google:
            return p.instagramURL.contains("/maps/search/?api=1") ? "From a Google Maps list" : "Saved from a Google Maps link"
        default:
            return by.map { "Saved from \($0) on Instagram" } ?? "Saved from an Instagram post"
        }
    }

    /// "3 Oct", with the year once it isn't this year's.
    private static func when(_ d: Date, now: Date) -> String {
        let cal = Calendar.current
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        let day = "\(cal.component(.day, from: d)) \(months[cal.component(.month, from: d) - 1])"
        let year = cal.component(.year, from: d)
        return year == cal.component(.year, from: now) ? day : "\(day) \(year)"
    }

    /// The venue's website as the card shows it: its Instagram as "@handle",
    /// anything else as the bare address (web: `websiteLabel`).
    static func websiteLabel(_ link: String?) -> String? {
        guard let link, let url = URL(string: link), let rawHost = url.host() else { return nil }
        let host = rawHost.hasPrefix("www.") ? String(rawHost.dropFirst(4)) : rawHost
        guard host == "instagram.com" else { return host }
        let first = url.pathComponents.dropFirst().first
        if let first, !["p", "reel", "explore"].contains(first) { return "@\(first)" }
        return "Instagram"
    }
}
