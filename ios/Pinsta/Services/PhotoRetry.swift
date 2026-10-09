import Foundation
import SwiftData

/// A place never goes without a photo. Normally the post's image is saved with
/// the pin; if the post couldn't be read at that moment (Apify busy, network),
/// this tries again on launch and foreground. Every try is a paid read on the
/// server, so failures back off, the least-tried go first (one bad post can't
/// starve the rest), and a deleted or private post is given up on for good.
enum PhotoRetry {
    private static var running = false

    @MainActor
    static func run(in context: ModelContext) async {
        guard !running else { return }
        running = true
        defer { running = false }
        let d = FetchDescriptor<Place>(predicate: #Predicate { $0.imageData == nil && !$0.photoGaveUp })
        let now = Date.now
        // A Maps link has no post to read: only places imported from a list qualify,
        // and they ask Google for a photo by name and pin (/api/photo) instead.
        let due = ((try? context.fetch(d)) ?? [])
            .filter { (SourceURL.parse($0.instagramURL)?.kind != .google || $0.fromListTitle != nil) && ($0.photoNextTry ?? .distantPast) <= now }
            .sorted { $0.photoAttempts < $1.photoAttempts }
        for place in due.prefix(5) {
            let id = place.id, url = place.instagramURL
            var data: Data?
            var gone = false
            do {
                if SourceURL.parse(url)?.kind == .google {
                    switch try await PhotoLookup.near(name: place.name, latitude: place.latitude, longitude: place.longitude) {
                    case .some(let imageURL): data = await ImageLoader.data(from: imageURL)
                    case .none: gone = true  // Google has no photo of it
                    }
                } else {
                    let post = try await PostReader.read(url)
                    data = await ImageLoader.data(from: post.imageURL)
                }
            } catch let error as PostReader.APIError {
                gone = error.permanent
            } catch {}
            // A cancelled pass (the view went away) isn't the post's fault.
            guard !Task.isCancelled else { return }
            guard let place = Place.find(id, in: context) else { continue }
            if let data {
                place.imageData = data
            } else if gone {
                place.photoGaveUp = true
            } else {
                place.photoAttempts += 1
                place.photoNextTry = Backoff.next(after: place.photoAttempts)
                if place.photoAttempts >= Backoff.limit { place.photoGaveUp = true }
            }
            try? context.save()
        }
    }
}

/// When a failed background lookup may run again: 6 h, 12 h, 1 day … capped at
/// two weeks, and `limit` failures in a row means stop asking.
enum Backoff {
    static let limit = 6

    static func next(after attempts: Int, from now: Date = .now) -> Date {
        let hours = min(6 * pow(2, Double(max(attempts - 1, 0))), 14 * 24)
        return now.addingTimeInterval(hours * 3600)
    }
}

/// Google's photo of a place known by name and pin (`/api/photo`): for places imported
/// from a list, which have no post. nil = Google has none; throws when the call failed.
enum PhotoLookup {
    private struct Answer: Decodable { let imageUrl: String? }

    static func near(name: String, latitude: Double, longitude: Double) async throws -> String? {
        var request = URLRequest(url: PostReader.baseURL.appending(path: "api/photo"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["name": name, "lat": latitude, "lng": longitude])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(Answer.self, from: data).imageUrl
    }
}
