import Foundation
import SwiftUI
import MapKit

/// The eleven buckets the list filters by. Same set as the web app's
/// `lib/categories.ts` so imported rows map 1:1.
enum PlaceCategory: String, CaseIterable, Identifiable {
    case restaurant = "Restaurant"
    case cafe = "Cafe"
    case bar = "Bar"
    case vineyard = "Vineyard"
    case bakery = "Bakery"
    case hotel = "Hotel"
    case shop = "Shop"
    case attraction = "Attraction"
    case museum = "Museum"
    case nature = "Nature"
    case other = "Other"

    var id: String { rawValue }

    /// One glyph per bucket — map pins and photo-less tiles. Mirrors `CATEGORY_EMOJI` on the web.
    /// Soft fill behind the emoji (map pins, photo-less tiles). Same values as the web.
    var tint: Color {
        switch self {
        case .restaurant: return Color(hex: 0xFDE2D4)
        case .cafe: return Color(hex: 0xF3E3CF)
        case .bar: return Color(hex: 0xECDCF5)
        case .vineyard: return Color(hex: 0xE3DCF7)
        case .bakery: return Color(hex: 0xFBECCB)
        case .hotel: return Color(hex: 0xD8E8F7)
        case .shop: return Color(hex: 0xF9DCE6)
        case .attraction: return Color(hex: 0xFDE0DC)
        case .museum: return Color(hex: 0xE2E4EA)
        case .nature: return Color(hex: 0xD9EFDD)
        case .other: return Color(hex: 0xECECEC)
        }
    }

    /// Where a price means something. Only these spend a Google lookup (/api/price).
    var hasPrice: Bool { [.restaurant, .cafe, .bar, .bakery].contains(self) }

    var emoji: String {
        switch self {
        case .restaurant: return "🍽️"
        case .cafe: return "☕️"
        case .bar: return "🍷"
        case .vineyard: return "🍇"
        case .bakery: return "🥐"
        case .hotel: return "🛏️"
        case .shop: return "🛍️"
        case .attraction: return "📍"
        case .museum: return "🏛️"
        case .nature: return "🌲"
        case .other: return "📍"
        }
    }

    var plural: String {
        switch self {
        case .nature, .other: return rawValue
        case .bakery: return "Bakeries"
        default: return rawValue + "s"
        }
    }

    /// An explicit type in the name wins when MapKit classifies a mixed-use
    /// place by a different business on the same property (e.g. a vineyard hotel).
    /// Otherwise use MapKit, then the remaining name heuristics as a fallback.
    static func from(_ poi: MKPointOfInterestCategory?, name: String) -> PlaceCategory {
        let lower = name.lowercased()
        if lower.contains("vingård") || lower.contains("vineyard") || lower.contains("winery") || lower.contains("vinyard") { return .vineyard }
        if lower.contains("bakery") || lower.contains("bageri") || lower.contains("boulangerie") || lower.contains("pastisseria") { return .bakery }
        if let poi {
            switch poi {
            case .restaurant: return .restaurant
            case .cafe: return .cafe
            case .bakery: return .bakery
            case .winery: return .vineyard
            case .brewery, .nightlife: return .bar
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
        if lower.contains("hotel") || lower.contains("hostel") { return .hotel }
        if lower.contains("cafe") || lower.contains("café") || lower.contains("coffee") { return .cafe }
        if lower.contains("restaurant") || lower.contains("tapas") || lower.contains("bistro") { return .restaurant }
        return .other
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}
