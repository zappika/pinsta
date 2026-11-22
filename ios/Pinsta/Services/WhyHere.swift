import Foundation

/// The card's "why it's here" line, word for word the web's `lib/why-here.ts`:
/// where a place came from, said the way you'd remember it (Sarp, 2026-10-06).
///   Saved from @burro_cafe on Instagram · 14 Sep
///   Saved from a Google Maps link · 2 Oct 2025
///   From Emilie’s “Paris” list · 12 Sep
///   Saved when you were here · 22 Nov   (Check in, or a name typed on the spot)
enum WhyHere {
    static func line(for place: Place, now: Date = .now) -> String {
        "\(origin(place)) · \(when(place.createdAt, now: now))"
    }

    private static func origin(_ p: Place) -> String {
        // A list import (build 31 on): whose list, and its name. "Google Maps list" is what
        // ListImport stores when the list had no title.
        if let title = p.fromListTitle, p.fromListOwner != nil || title != "Google Maps list" {
            let who = p.fromListOwner?.split(separator: " ").first.map { "\($0)’s" } ?? "a"
            return title == "Google Maps list" ? "From \(who) Google Maps list" : "From \(who) “\(title)” list"
        }
        let by = p.ownerUsername.map { "@" + $0.trimmingCharacters(in: CharacterSet(charactersIn: "@")) }
        switch SourceURL.parse(p.instagramURL)?.kind {
        case .tiktok:
            return by.map { "Saved from \($0) on TikTok" } ?? "Saved from a TikTok"
        case .google:
            // A list import carries its list; a maps/search link without one was saved by typing its name.
            if p.instagramURL.contains("/maps/search/?api=1") { return p.fromListTitle != nil ? "From a Google Maps list" : p.savedNearby ? "Saved when you were here" : "Saved by name" }
            return "Saved from a Google Maps link"
        default:
            return by.map { "Saved from \($0) on Instagram" } ?? "Saved from an Instagram post"
        }
    }

    /// What the post said, as the card quotes it under where it came from (web: `captionSnippet`, same
    /// rules): the first sentence or line that says something, and the next ones while they fit, with
    /// hashtags, @mentions, links and emoji taken out; about 90 characters, cut at a word. nil when
    /// nothing readable is left.
    static func captionSnippet(_ caption: String?, max limit: Int = 90) -> String? {
        guard let caption, !caption.isEmpty else { return nil }
        func sub(_ s: String, _ pattern: String, _ with: String = "") -> String {
            s.replacingOccurrences(of: pattern, with: with, options: .regularExpression)
        }
        func clean(_ t: String) -> String {
            var s = sub(t, #"https?://\S+"#)
            s = sub(s, #"[#@][\p{L}\p{N}_.]+"#)
            s = sub(s, #"[\p{Extended_Pictographic}\x{1F1E6}-\x{1F1FF}\x{FE0F}\x{200D}\x{20E3}]"#)
            s = sub(s, #"\s+"#, " ")
            s = sub(s, #"^[\s\-–—•·|:,.]+|[\s\-–—•·|:,]+$"#)
            return s.trimmingCharacters(in: .whitespaces)
        }
        // An emoji often ends a sentence on Instagram ("Slow mornings ☕️ Our rooms…"): it splits too.
        let marked = sub(caption, #"\n+|(?<=[.!?])\s+|\s*\p{Extended_Pictographic}[\p{Extended_Pictographic}\x{FE0F}\x{200D}\s]*"#, "\u{1}")
        let pieces = marked.components(separatedBy: "\u{1}").map(clean)
        // An address line ("The Blue Moon, 55 Rue de la Roquette, 75011 Paris": a comma and a postcode) isn't what the post said.
        func said(_ t: String) -> Bool {
            (t.split(separator: " ").count >= 3 || t.count >= 8) && !(t.contains(",") && t.range(of: #"\b\d{4,5}\b"#, options: .regularExpression) != nil)
        }
        guard let first = pieces.firstIndex(where: said) else { return nil }
        var text = pieces[first]
        for t in pieces[(first + 1)...] where said(t) {
            let joined = text.last.map { ".!?…".contains($0) } == true ? "\(text) \(t)" : "\(text). \(t)"
            if joined.count > limit { break }
            text = joined
        }
        if text.count <= limit { return text }
        let cut = String(text.prefix(limit - 1))
        let space = cut.lastIndex(of: " ").map { cut.distance(from: cut.startIndex, to: $0) } ?? 0
        return sub(String(cut.prefix(Swift.max(space, limit / 2))), #"[\s,;:–—-]+$"#) + "…"
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
