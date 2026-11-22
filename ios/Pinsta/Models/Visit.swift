import Foundation

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
    /// A Been there with no day (tapped on the card, or a Yes to "Been to any of these?") that became
    /// a visit when a later Check in made the list (Sarp, 2026-11-22: only Check in says when). `at` is
    /// then the day it was marked, never shown. Optional so visits stored before it still decode.
    var undated: Bool?

    var dated: Bool { undated != true }
}

extension Place {
    /// Been there before visits existed (`visitedAt` only) counts as one.
    var visitCount: Int { visits.isEmpty ? (visitedAt == nil ? 0 : 1) : visits.count }

    /// The latest visit with a real day. A Been there without one has none: the card says no "last …".
    var lastVisit: Date? { visits.last(where: \.dated)?.at }

    /// Your photos at this place, newest first.
    var visitPhotos: [String] { visits.reversed().flatMap { $0.photos.reversed() } }

    /// Check in: one more visit. The first one also makes it Been there; an old Been there
    /// without visits becomes the first visit, so the count stays right.
    @discardableResult
    func checkIn(at date: Date = .now) -> Visit {
        if visits.isEmpty, let before = visitedAt {
            visits.append(Visit(at: before, rating: rating, undated: true))
        }
        if visitedAt == nil { visitedAt = date }
        let visit = Visit(at: date)
        visits.append(visit)
        return visit
    }

    func update(_ visit: Visit) {
        guard let i = visits.firstIndex(where: { $0.id == visit.id }) else { return }
        visits[i] = visit
        // The face on the card is the latest one given.
        if let r = visit.rating { rating = r }
    }
}
