import Foundation
import SwiftData
import CoreLocation

/// The one cloud dependency: reading the Instagram post. The Apify token can't
/// live in the app, so the Vercel function proxies it and copies the image
/// into Blob storage for us to download.
struct InstagramPost: Decodable {
    let url: String
    let caption: String?
    let locationName: String?
    let imageURL: String?
    let ownerUsername: String?
    let ownerFullName: String?
    let hashtags: [String]?
    /// "instagram" | "tiktok" | "google" — nil from older servers.
    var kind: String? = nil
    /// Google Maps links carry the pin; MapKit searches around it.
    var near: Near? = nil
    /// TikTok: the location tag's city, searched with the tag.
    var city: String? = nil
    /// A collab post's other authors: one of them is often the venue. Nil from older servers.
    var coauthors: [String]? = nil
    /// An Instagram profile's own category ("Restaurant", "Art Gallery"). Nil for posts.
    var category: String? = nil
    /// A carousel's pictures: `SlideText` reads place names off them. Nil from older servers.
    var slides: [String]? = nil

    struct Near: Decodable, Equatable { let lat: Double; let lng: Double }

    enum CodingKeys: String, CodingKey {
        case url, caption, locationName, ownerUsername, ownerFullName, hashtags, kind, near, city, coauthors, category, slides
        case imageURL = "imageUrl"
    }
}

enum PostReader {
    /// Launch with `-apiBase http://localhost:3010` to test server changes before they deploy (Debug builds only).
    static let baseURL: URL = {
        #if DEBUG
        if let local = UserDefaults.standard.string(forKey: "apiBase"), let url = URL(string: local) { return url }
        #endif
        return URL(string: "https://pinsta-two.vercel.app")!
    }()

    struct APIError: LocalizedError {
        let message: String
        /// The post is deleted or private: asking again would only cost another read.
        var permanent = false
        var errorDescription: String? { message }
    }

    private struct Envelope: Decodable {
        let post: InstagramPost?
        let error: String?
        /// Set by the server when the post is gone for good.
        var permanent: Bool? = nil
    }

    static func read(_ instagramURL: String) async throws -> InstagramPost {
        var request = URLRequest(url: baseURL.appending(path: "api/extract"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60
        // `native: true` → server skips its Google Places lookup; MapKit does that here.
        request.httpBody = try JSONEncoder().encode(["instagramUrl": instagramURL, "native": "true"])
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        // A timeout or challenge page isn't JSON; say something readable, not a decoder error.
        guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else {
            throw APIError(message: "Vicolo's server didn't answer properly. Try again in a minute.")
        }
        guard status == 200, let post = envelope.post else {
            let message = envelope.error ?? "Could not read post"
            throw APIError(message: message, permanent: envelope.permanent == true || isGone(message))
        }
        return post
    }

    /// The reader's wording for a post that no longer exists or isn't public.
    private static func isGone(_ message: String) -> Bool {
        let m = message.lowercased()
        return m.contains("does not exist") || m.contains("not found") || m.contains("not public")
    }
}

/// Price level ($ to $$). MapKit has none, so the server asks Google once
/// per place (`/api/price`, web `findPriceLevel`): the name, searched around
/// the pin. Only food and drink places ask; the rest are marked checked.
enum PriceLookup {
    private struct Answer: Decodable { let priceLevel: Int? }
    private static var running = false
    /// Places being asked about right now: a save and the launch pass can overlap.
    @MainActor private static var asking: Set<UUID> = []

    /// Ask for one place. An answer (even "no price") or a bad request marks it
    /// checked; anything else backs off and tries again later.
    @MainActor
    static func check(_ place: Place, in context: ModelContext) async {
        guard !place.priceChecked else { return }
        guard place.category.hasPrice else {
            place.priceChecked = true
            try? context.save()
            return
        }
        let id = place.id
        guard asking.insert(id).inserted else { return }
        defer { asking.remove(id) }
        var request = URLRequest(url: PostReader.baseURL.appending(path: "api/price"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 20
        let body: [String: Any] = ["name": place.name, "lat": place.latitude, "lng": place.longitude]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let reply = try? await URLSession.shared.data(for: request)
        // Removed (or undone) while we waited: nothing to write to.
        guard !Task.isCancelled, let place = Place.find(id, in: context) else { return }
        let status = (reply?.1 as? HTTPURLResponse)?.statusCode
        if status == 200, let data = reply?.0, let answer = try? JSONDecoder().decode(Answer.self, from: data) {
            place.priceLevel = answer.priceLevel
            place.priceChecked = true
        } else if status == 400 {
            place.priceChecked = true
        } else {
            place.priceAttempts += 1
            place.priceNextTry = Backoff.next(after: place.priceAttempts)
            if place.priceAttempts >= Backoff.limit { place.priceChecked = true }
        }
        try? context.save()
    }

    /// On launch and foreground: places the share extension saved (it may close
    /// before its own lookup ends) and places from before prices existed. Ones
    /// that failed wait their turn, and the least-tried go first, so a few bad
    /// ones can't keep the rest waiting.
    @MainActor
    static func run(in context: ModelContext) async {
        guard !running else { return }
        running = true
        defer { running = false }
        let d = FetchDescriptor<Place>(predicate: #Predicate { !$0.priceChecked })
        let now = Date.now
        let due = ((try? context.fetch(d)) ?? [])
            .filter { ($0.priceNextTry ?? .distantPast) <= now }
            .sorted { $0.priceAttempts < $1.priceAttempts }
        for place in due.prefix(20) {
            guard !Task.isCancelled else { return }
            await check(place, in: context)
        }
    }
}

/// The links Vicolo accepts — a port of the web's `lib/sources.ts`: an
/// Instagram post, a TikTok video, or a Google Maps place. Short links
/// (vm.tiktok.com, maps.app.goo.gl) pass as-is; the server resolves them and
/// returns the canonical URL, which is what gets saved.
enum SourceURL {
    enum Kind: String { case instagram, tiktok, google, profile }

    static func parse(_ input: String) -> (kind: Kind, url: String)? {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,!?;:"))
        if let ig = InstagramURL.normalize(raw) { return (.instagram, ig) }
        if let profile = InstagramURL.profile(raw) { return (.profile, profile) }
        guard let url = URL(string: raw), let rawHost = url.host()?.lowercased() else {
            // Apps may share "caption https://short.link/..." as plain text.
            // Find a supported URL anywhere in it before showing an empty field.
            let pattern = /https?:\/\/[^\s<>]+/
            for match in raw.matches(of: pattern) {
                let link = String(match.output).trimmingCharacters(in: CharacterSet(charactersIn: ".,!?;:"))
                if link == raw { continue }
                if let source = parse(link) { return source }
            }
            return nil
        }
        let host = rawHost.replacingOccurrences(of: "^(www|m)\\.", with: "", options: .regularExpression)
        let path = url.path()
        if host == "tiktok.com" {
            guard let m = path.firstMatch(of: /^\/@([\w.-]+)\/(?:video|photo)\/(\d+)/) else { return nil }
            return (.tiktok, "https://www.tiktok.com/@\(m.1)/video/\(m.2)")
        }
        if host == "vm.tiktok.com" || host == "vt.tiktok.com" {
            return path.count > 1 ? (.tiktok, "https://\(host)\(path)") : nil
        }
        if host == "maps.app.goo.gl" || (host == "goo.gl" && path.hasPrefix("/maps")) { return (.google, raw) }
        if host.firstMatch(of: /^(maps\.)?google\.[a-z.]+$/) != nil, host.hasPrefix("maps.") || path.hasPrefix("/maps") {
            return (.google, raw)
        }
        return nil
    }
}

enum InstagramURL {
    private static let notHandles: Set<String> = ["p", "reel", "reels", "tv", "explore", "accounts", "stories", "direct", "about", "legal", "developer", "web"]

    /// A profile link (instagram.com/restaurangvra/?hl=en) or a bare "@restaurangvra" →
    /// https://www.instagram.com/restaurangvra/. Same rule as `normalizeInstagramProfile` on the web.
    static func profile(_ input: String) -> String? {
        let s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let m = s.wholeMatch(of: /@([\w.]{3,30})/) { return "https://www.instagram.com/\(m.1.lowercased())/" }
        guard let url = URL(string: s), let host = url.host()?.lowercased()
            .replacingOccurrences(of: "^(www|m)\\.", with: "", options: .regularExpression), host == "instagram.com" else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count == 1, let handle = parts.first?.lowercased(), !notHandles.contains(handle),
              handle.wholeMatch(of: /[\w.]{2,30}/) != nil else { return nil }
        return "https://www.instagram.com/\(handle)/"
    }

    /// Accept post / reel / tv links, strip tracking params, return a canonical URL.
    static func normalize(_ input: String) -> String? {
        guard let url = URL(string: input.trimmingCharacters(in: .whitespacesAndNewlines)),
              let host = url.host()?.replacingOccurrences(of: "www.", with: ""),
              host == "instagram.com" || host == "instagr.am" else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }
        // Optional username prefix: /user/p/CODE or /p/CODE
        guard let kindIndex = parts.firstIndex(where: { ["p", "reel", "reels", "tv"].contains($0) }),
              kindIndex + 1 < parts.count else { return nil }
        let kind = parts[kindIndex] == "reels" ? "reel" : parts[kindIndex]
        let code = parts[kindIndex + 1]
        return "https://www.instagram.com/\(kind)/\(code)/"
    }
}

/// Google, when Apple Maps doesn't know the place (BATA, 2026-10-14): `POST /api/search`
/// with the same clues. Capped per day on the server; any failure is just "nothing".
enum GoogleFallback {
    private struct Answer: Decodable { let candidates: [Found] }
    private struct Found: Decodable {
        let placeId: String; let name: String; let formattedAddress: String?
        let lat: Double; let lng: Double
        let category: String; let primaryType: String?; let country: String?; let city: String?; let region: String?
    }

    static func search(_ queries: [String], near: CLLocationCoordinate2D? = nil) async -> [PlaceCandidate] {
        let queries = Array(NSOrderedSet(array: queries.map { $0.trimmingCharacters(in: .whitespaces) }.filter { $0.count >= 3 })) as? [String] ?? []
        guard !queries.isEmpty else { return [] }
        var request = URLRequest(url: PostReader.baseURL.appending(path: "api/search"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = ["queries": Array(queries.prefix(3))]
        if let near { body["near"] = ["lat": near.latitude, "lng": near.longitude] }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 15
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let answer = try? JSONDecoder().decode(Answer.self, from: data) else { return [] }
        return answer.candidates.map {
            PlaceCandidate(
                id: "google:\($0.placeId)", name: $0.name, latitude: $0.lat, longitude: $0.lng,
                address: $0.formattedAddress, city: $0.city, region: $0.region, country: $0.country,
                category: PlaceCategory(rawValue: $0.category) ?? .other,
                subtype: $0.primaryType
            )
        }
    }
}
