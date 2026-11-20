import Foundation
import UIKit

/// One time you were there (Sarp, 2026-11-20: many visits, like Swarm check-ins, so the habit can move
/// from Swarm to Vicolo). Kept on the place as a list (`Place.visits`), so an existing store needs no
/// migration. The photo is a file in the App Group (`VisitPhotos`), not in the database.
struct Visit: Codable, Hashable, Identifiable {
    var id = UUID()
    var at: Date
    /// 1 😞 2 🙂 3 😃; nil = not said.
    var rating: Int?
    var note: String?
    /// File names in `VisitPhotos`, taken or picked at this visit.
    var photos: [String] = []
}

extension Place {
    /// Been there before visits existed (`visitedAt` only) counts as one.
    var visitCount: Int { visits.isEmpty ? (visitedAt == nil ? 0 : 1) : visits.count }

    var lastVisit: Date? { visits.last?.at ?? visitedAt }

    /// Your photos at this place, newest first.
    var visitPhotos: [String] { visits.reversed().flatMap { $0.photos.reversed() } }

    /// I'm here: one more visit. The first one also makes it Been there; an old Been there
    /// without visits becomes the first visit, so the count stays right.
    @discardableResult
    func checkIn(at date: Date = .now) -> Visit {
        if visits.isEmpty, let before = visitedAt {
            visits.append(Visit(at: before, rating: rating))
        }
        if visitedAt == nil { visitedAt = date }
        let visit = Visit(at: date)
        visits.append(visit)
        return visit
    }

    /// Back to Want to go: no visits, no date. The face stays, as before (a slip loses nothing).
    func unvisit() {
        for name in visits.flatMap(\.photos) { VisitPhotos.remove(name) }
        visits = []
        visitedAt = nil
    }

    func update(_ visit: Visit) {
        guard let i = visits.firstIndex(where: { $0.id == visit.id }) else { return }
        visits[i] = visit
        // The face on the card is the latest one given.
        if let r = visit.rating { rating = r }
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
