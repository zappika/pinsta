import Foundation
import SwiftData

/// A place never goes without a photo. Normally the post's image is saved with
/// the pin; if the post couldn't be read at that moment (Apify busy, network),
/// this tries again each time the app comes to the foreground until it works.
/// A genuinely private or deleted post stays as it is — there is no photo to have.
enum PhotoRetry {
    private static var running = false

    @MainActor
    static func run(in context: ModelContext) async {
        guard !running else { return }
        running = true
        defer { running = false }
        let d = FetchDescriptor<Place>(predicate: #Predicate { $0.imageData == nil })
        // Maps links have no server photo in native mode. Exclude them before
        // taking five, or they can permanently crowd out retryable posts.
        let missing = ((try? context.fetch(d)) ?? []).filter { SourceURL.parse($0.instagramURL)?.kind != .google }.prefix(5)
        for place in missing {
            guard let post = try? await PostReader.read(place.instagramURL),
                  let data = await ImageLoader.data(from: post.imageURL) else { continue }
            place.imageData = data
            try? context.save()
        }
    }
}
