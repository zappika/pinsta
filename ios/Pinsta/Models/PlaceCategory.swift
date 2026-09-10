import Foundation
import MapKit

/// The ten buckets the list filters by. Same set as the web app's
/// `lib/categories.ts` so imported rows map 1:1.
enum PlaceCategory: String, CaseIterable, Identifiable {
    case restaurant = "Restaurant"
    case cafe = "Cafe"
    case bar = "Bar"
    case bakery = "Bakery"
    case hotel = "Hotel"
    case shop = "Shop"
    case attraction = "Attraction"
    case museum = "Museum"
    case nature = "Nature"
    case other = "Other"

    var id: String { rawValue }

    var plural: String {
        switch self {
        case .nature, .other: return rawValue
        case .bakery: return "Bakeries"
        default: return rawValue + "s"
        }
    }

    /// Map MapKit's point-of-interest category onto our buckets.
    /// Falls back to a name heuristic because MapKit has no "bar" category.
    static func from(_ poi: MKPointOfInterestCategory?, name: String) -> PlaceCategory {
        let lower = name.lowercased()
        if let poi {
            switch poi {
            case .restaurant: return .restaurant
            case .cafe: return .cafe
            case .bakery: return .bakery
            case .brewery, .winery, .nightlife: return .bar
            case .hotel: return .hotel
            case .store, .foodMarket: return .shop
            case .museum: return .museum
            case .park, .nationalPark, .beach: return .nature
            case .theater, .amusementPark, .aquarium, .zoo: return .attraction
            default:
                // Newer categories (castle, landmark, distillery…) arrive as raw strings.
                let raw = poi.rawValue.lowercased()
                if raw.contains("distillery") { return .bar }
                if raw.contains("landmark") || raw.contains("castle") || raw.contains("fortress")
                    || raw.contains("monument") || raw.contains("planetarium") { return .attraction }
                if raw.contains("garden") || raw.contains("trail") || raw.contains("hiking") { return .nature }
                if raw.contains("bakery") { return .bakery }
            }
        }
        if lower.contains("bar ") || lower.hasSuffix(" bar") || lower.contains("cocktail") || lower.contains("pub") { return .bar }
        if lower.contains("bakery") || lower.contains("bageri") || lower.contains("boulangerie") || lower.contains("pastisseria") { return .bakery }
        if lower.contains("hotel") || lower.contains("hostel") { return .hotel }
        if lower.contains("cafe") || lower.contains("café") || lower.contains("coffee") { return .cafe }
        if lower.contains("restaurant") || lower.contains("tapas") || lower.contains("bistro") { return .restaurant }
        return .other
    }
}
