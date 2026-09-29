import Foundation

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

    struct Near: Decodable, Equatable { let lat: Double; let lng: Double }

    enum CodingKeys: String, CodingKey {
        case url, caption, locationName, ownerUsername, ownerFullName, hashtags, kind, near
        case imageURL = "imageUrl"
    }
}

enum PostReader {
    static let baseURL = URL(string: "https://pinsta-two.vercel.app")!

    struct APIError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    private struct Envelope: Decodable {
        let post: InstagramPost?
        let error: String?
    }

    static func read(_ instagramURL: String) async throws -> InstagramPost {
        var request = URLRequest(url: baseURL.appending(path: "api/extract"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60
        // `native: true` → server skips its Google Places lookup; MapKit does that here.
        request.httpBody = try JSONEncoder().encode(["instagramUrl": instagramURL, "native": "true"])
        let (data, response) = try await URLSession.shared.data(for: request)
        let envelope = try JSONDecoder().decode(Envelope.self, from: data)
        guard (response as? HTTPURLResponse)?.statusCode == 200, let post = envelope.post else {
            throw APIError(message: envelope.error ?? "Could not read post")
        }
        return post
    }
}

/// The links Vicolo accepts — a port of the web's `lib/sources.ts`: an
/// Instagram post, a TikTok video, or a Google Maps place. Short links
/// (vm.tiktok.com, maps.app.goo.gl) pass as-is; the server resolves them and
/// returns the canonical URL, which is what gets saved.
enum SourceURL {
    enum Kind: String { case instagram, tiktok, google }

    static func parse(_ input: String) -> (kind: Kind, url: String)? {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let ig = InstagramURL.normalize(raw) { return (.instagram, ig) }
        guard let url = URL(string: raw), let rawHost = url.host()?.lowercased() else { return nil }
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
