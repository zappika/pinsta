import Foundation
import SwiftData

/// A saved place, sourced from an Instagram post. Local-first: this is the
/// source of truth on device. Mirrors the web `places` row so the one-shot
/// import is a straight copy.
@Model
final class Place {
    @Attribute(.unique) var id: UUID
    var instagramURL: String
    var name: String
    var latitude: Double
    var longitude: Double
    var address: String?
    var city: String?
    var region: String?
    var country: String?
    var categoryRaw: String
    var caption: String?
    var ownerUsername: String?
    var igLocationName: String?
    @Attribute(.externalStorage) var imageData: Data?
    var createdAt: Date

    /// Google place id when the row came from the web import; nil for native saves.
    var googlePlaceID: String?

    /// More posts of this place, saved later (web: the `posts` column). The first stays in instagramURL.
    var extraPostURLs: [String] = []

    /// The venue's website from MapKit (`MKMapItem.url`), saves from build 11 on. Often its Instagram.
    var website: String?

    /// 1–4 ($ to $) from Google via /api/price; nil when unknown.
    var priceLevel: Int?
    /// The price lookup ran (with or without an answer), so it isn't asked again.
    var priceChecked: Bool = false
    /// Failed price lookups so far, and when the next one may run (`Backoff`).
    var priceAttempts: Int = 0
    var priceNextTry: Date?

    /// Photo retries (`PhotoRetry`): failures so far, when to try next, and
    /// whether the post is gone for good (deleted or private), so it's never paid for again.
    var photoAttempts: Int = 0
    var photoNextTry: Date?
    var photoGaveUp: Bool = false

    /// Been there: when it was marked (kept, not shown). nil = Want to go, every place's start.
    /// Back to Want to go clears it and keeps `rating` (web: `visited_at`, 2026-10-06).
    var visitedAt: Date?
    /// How it was after Been there: 1 😞 2 🙂 3 😃; nil = not said.
    var rating: Int?

    /// "$" for the card, or nil.
    var priceLabel: String? {
        guard let priceLevel, (1...4).contains(priceLevel) else { return nil }
        return String(repeating: "$", count: priceLevel)
    }

    /// Every link that points at this place, first post first.
    var allPostURLs: [String] { [instagramURL] + extraPostURLs }

    init(
        id: UUID = UUID(),
        instagramURL: String,
        name: String,
        latitude: Double,
        longitude: Double,
        address: String?,
        city: String?,
        region: String? = nil,
        country: String?,
        category: PlaceCategory,
        caption: String? = nil,
        ownerUsername: String? = nil,
        igLocationName: String? = nil,
        imageData: Data? = nil,
        createdAt: Date = .now,
        googlePlaceID: String? = nil
    ) {
        self.id = id
        self.instagramURL = instagramURL
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
        self.address = address
        self.city = city
        self.region = region
        self.country = country
        self.categoryRaw = category.rawValue
        self.caption = caption
        self.ownerUsername = ownerUsername
        self.igLocationName = igLocationName
        self.imageData = imageData
        self.createdAt = createdAt
        self.googlePlaceID = googlePlaceID
    }

    var category: PlaceCategory {
        get { PlaceCategory(rawValue: categoryRaw) ?? .other }
        set { categoryRaw = newValue.rawValue }
    }
}

extension Place {
    /// The place with this id if it still exists. After an await, the one in hand
    /// may have been removed (Undo, "Wrong place?"), and writing to it can trap.
    static func find(_ id: UUID, in context: ModelContext) -> Place? {
        var d = FetchDescriptor<Place>(predicate: #Predicate { $0.id == id })
        d.fetchLimit = 1
        return try? context.fetch(d).first
    }
}
