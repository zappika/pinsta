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
        var d = FetchDescriptor<Place>(predicate: #Predicate { $0.imageData == nil })
        d.fetchLimit = 5 // Apify's free plan allows 5 concurrent runs; stay well under, one at a time.
        guard let missing = try? context.fetch(d), !missing.isEmpty else { return }
        for place in missing {
            guard let post = try? await PostReader.read(place.instagramURL),
                  let data = await ImageLoader.data(from: post.imageURL) else { continue }
            place.imageData = data
            try? context.save()
        }
    }
}
