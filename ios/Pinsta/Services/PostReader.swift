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

    enum CodingKeys: String, CodingKey {
        case url, caption, locationName, ownerUsername, ownerFullName, hashtags
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
