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
