import SwiftUI
import MapKit

/// A tile for a place with no photo (Sarp, 2026-11-24): the streets around it, its type icon
/// where it is, and its name over a soft shade at the top (the bottom keeps the Apple Maps
/// mark a snapshot must show), so a grid of list imports reads
/// as places, not a row of same-coloured icons. The map is an Apple snapshot (free), made once
/// per place, size and appearance, kept in memory and in Caches.
struct MapTile: View {
    let place: Place
    @Environment(\.colorScheme) private var scheme
    @Environment(\.displayScale) private var scale
    @State private var image: UIImage?

    var body: some View {
        GeometryReader { g in
            ZStack {
                place.category.tint
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                        .frame(width: g.size.width, height: g.size.height)
                        .transition(.opacity)
                }
                // Below the middle: the top is the name.
                place.icon.resizable().scaledToFit()
                    .padding(7)
                    .frame(width: 38, height: 38)
                    .background(place.category.tint, in: Circle())
                    .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 2))
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
                    .position(x: g.size.width / 2, y: g.size.height * 0.6)
            }
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(place.name)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(2)
                    if let city = place.city {
                        Text(city).font(.system(size: 11)).opacity(0.85).lineLimit(1)
                    }
                }
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(LinearGradient(colors: [.black.opacity(0), .black.opacity(0.6)], startPoint: .bottom, endPoint: .top))
            }
            .task(id: "\(place.id)-\(Int(g.size.width))-\(scheme == .dark)") {
                image = await MapTileCache.snapshot(for: place, size: g.size, scale: scale, dark: scheme == .dark)
            }
        }
        .allowsHitTesting(false)
    }
}

enum MapTileCache {
    private static let memory: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 200
        return c
    }()

    private static let folder: URL? = {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("MapTiles", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    @MainActor
    static func snapshot(for place: Place, size: CGSize, scale: CGFloat, dark: Bool) async -> UIImage? {
        guard size.width > 10, size.height > 10 else { return nil }
        // The pin's spot is part of the key: a moved place gets a new map.
        let name = String(format: "%@-%.5f-%.5f-%d-%d", place.id.uuidString, place.latitude, place.longitude, Int(size.width), dark ? 1 : 0)
        if let hit = memory.object(forKey: name as NSString) { return hit }
        let file = folder?.appendingPathComponent(name + ".jpg")
        if let file, let data = try? Data(contentsOf: file), let img = UIImage(data: data) {
            memory.setObject(img, forKey: name as NSString)
            return img
        }
        let options = MKMapSnapshotter.Options()
        // About 700 m across: the streets around it, the place a little below the middle.
        let latDelta = 0.7 / 111.32 * Double(size.height / size.width)
        let center = CLLocationCoordinate2D(latitude: place.latitude + latDelta * 0.1, longitude: place.longitude)
        options.region = MKCoordinateRegion(center: center, latitudinalMeters: 700 * Double(size.height / size.width), longitudinalMeters: 700)
        options.size = size
        options.scale = scale
        options.traitCollection = UITraitCollection(userInterfaceStyle: dark ? .dark : .light)
        let config = MKStandardMapConfiguration(emphasisStyle: .muted)
        config.pointOfInterestFilter = .excludingAll
        options.preferredConfiguration = config
        guard let shot = try? await MKMapSnapshotter(options: options).start() else { return nil }
        let img = shot.image
        memory.setObject(img, forKey: name as NSString)
        if let file, let data = img.jpegData(compressionQuality: 0.8) { try? data.write(to: file) }
        return img
    }
}
