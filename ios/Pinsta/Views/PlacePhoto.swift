import SwiftUI
import ImageIO

/// A place's photo at the size it's shown. The stored photo is the full post
/// image (~1080 px); decoding it in every row, tile and card on the main thread,
/// on every redraw, made scrolling heavy. This decodes once, off the main thread,
/// at the pixels needed, and keeps the result for the next appearance.
struct PlacePhoto: View {
    let place: Place
    /// The longest side it's drawn at, in points.
    let points: CGFloat
    @Environment(\.displayScale) private var scale
    @State private var image: UIImage?

    var body: some View {
        Color.clear
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill().allowsHitTesting(false)
                }
            }
            .clipped()
            .task(id: place.id) {
                let px = Int(points * scale)
                if let hit = PhotoCache.image(place.id, px: px) { image = hit; return }
                guard let data = place.imageData else { return }
                image = await PhotoCache.make(data, id: place.id, px: px)
            }
    }
}

enum PhotoCache {
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 300
        return c
    }()

    private static func key(_ id: UUID, _ px: Int) -> NSString { "\(id.uuidString)-\(px)" as NSString }

    static func image(_ id: UUID, px: Int) -> UIImage? { cache.object(forKey: key(id, px)) }

    static func make(_ data: Data, id: UUID, px: Int) async -> UIImage? {
        let made = await Task.detached(priority: .userInitiated) { () -> UIImage? in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceShouldCacheImmediately: true,
                kCGImageSourceThumbnailMaxPixelSize: px,
            ]
            guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
            return UIImage(cgImage: cg)
        }.value
        if let made { cache.setObject(made, forKey: key(id, px)) }
        return made
    }
}
