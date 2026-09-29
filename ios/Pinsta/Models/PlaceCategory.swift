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

    /// The same hue at full strength, for small marks (the dot beside a type).
    var dot: Color {
        switch self {
        case .restaurant: return Color(hex: 0xE8845C)
        case .cafe: return Color(hex: 0xB98A57)
        case .bar: return Color(hex: 0xA56BC9)
        case .vineyard: return Color(hex: 0x7D66C9)
        case .bakery: return Color(hex: 0xD9A635)
        case .hotel: return Color(hex: 0x5B93C9)
        case .shop: return Color(hex: 0xD9708F)
        case .attraction: return Color(hex: 0xE0705E)
        case .museum: return Color(hex: 0x7C8394)
        case .nature: return Color(hex: 0x5AA66B)
        case .other: return Color(hex: 0xA3A3A3)
        }
    }

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

    /// Map MapKit's point-of-interest category onto our buckets.
    /// Falls back to a name heuristic because MapKit has no "bar" category.
    static func from(_ poi: MKPointOfInterestCategory?, name: String) -> PlaceCategory {
        let lower = name.lowercased()
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
        if lower.contains("vingård") || lower.contains("vineyard") || lower.contains("winery") || lower.contains("vinyard") { return .vineyard }
        if lower.contains("bar ") || lower.hasSuffix(" bar") || lower.contains("cocktail") || lower.contains("pub") { return .bar }
        if lower.contains("bakery") || lower.contains("bageri") || lower.contains("boulangerie") || lower.contains("pastisseria") { return .bakery }
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
