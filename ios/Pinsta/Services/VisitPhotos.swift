import Foundation
import UIKit

/// The visit methods that touch photo files, and the files themselves. Kept out of Models so the search
/// replay (scripts/review) compiles Models for macOS without UIKit or Persistence.
extension Place {
    /// Back to Want to go: no visits, no date. The face stays, as before (a slip loses nothing).
    func unvisit() {
        for name in visits.flatMap(\.photos) { VisitPhotos.remove(name) }
        visits = []
        visitedAt = nil
    }

    /// One check-in undone (a wrong row, a double tap), its photos with it. The last one gone, the place
    /// is Want to go again; otherwise Been there dates from the first visit left.
    func removeVisit(_ id: UUID) {
        guard let i = visits.firstIndex(where: { $0.id == id }) else { return }
        for name in visits[i].photos { VisitPhotos.remove(name) }
        visits.remove(at: i)
        visitedAt = visits.first?.at
    }

    /// Your photo is the place's photo only when it has none of its own: a post's photo stays (the
    /// reason you saved it); a place checked into, typed or imported gets yours (Sarp's "hybrid").
    func addVisitPhoto(_ data: Data, to visitID: UUID) {
        guard let i = visits.firstIndex(where: { $0.id == visitID }), let name = VisitPhotos.save(data) else { return }
        visits[i].photos.append(name)
        if imageData == nil { imageData = VisitPhotos.data(name) }
    }
}

/// Your photos, as JPEG files in the App Group, shrunk to 1600 px: a phone photo is 5–10 MB.
enum VisitPhotos {
    static var folder: URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Persistence.appGroup)
                ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("VisitPhotos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func url(_ name: String) -> URL? { folder?.appendingPathComponent(name) }

    static func data(_ name: String) -> Data? { url(name).flatMap { try? Data(contentsOf: $0) } }

    /// The file name, or nil when it couldn't be read or written.
    static func save(_ data: Data) -> String? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, 1600 / max(longest, 1))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = small.jpegData(compressionQuality: 0.8) else { return nil }
        let name = "\(UUID().uuidString).jpg"
        guard let url = url(name), (try? jpeg.write(to: url)) != nil else { return nil }
        return name
    }

    static func remove(_ name: String) {
        if let url = url(name) { try? FileManager.default.removeItem(at: url) }
    }
}
