import Foundation
import SwiftUI
import MapKit

/// The twelve buckets the list filters by. Same set as the web app's
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
    case culture = "Culture"
    case nature = "Nature"
    case other = "Other"

    var id: String { rawValue }

    /// Soft fill behind the type icon (map pins, photo-less tiles). Same values as the web.
    var tint: Color { Color(hex: tintHex) }

    /// The tint, deeper, for a map dot with no icon: the pastels vanished on the grey map (web: deepen).
    var deepTint: Color { Color(hex: Self.deepen(tintHex)) }

    private var tintHex: UInt32 {
        switch self {
        case .restaurant: return 0xFDE2D4
        case .cafe: return 0xF3E3CF
        case .bar: return 0xECDCF5
        case .vineyard: return 0xE3DCF7
        case .bakery: return 0xFBECCB
        case .hotel: return 0xD8E8F7
        case .shop: return 0xF9DCE6
        case .attraction: return 0xFDE0DC
        case .museum: return 0xE2E4EA
        case .culture: return 0xF6DCEA
        case .nature: return 0xD9EFDD
        case .other: return 0xECECEC
        }
    }

    /// Same hue, saturation held between 0.42 and 0.62, lightness 0.62 (web: deepen in PlacesMap.tsx).
    static func deepen(_ hex: UInt32) -> UInt32 {
        var r = Double((hex >> 16) & 0xFF) / 255, g = Double((hex >> 8) & 0xFF) / 255, b = Double(hex & 0xFF) / 255
        let mx = max(r, g, b), mn = min(r, g, b), d = mx - mn
        var h = 0.0
        if d > 0 { h = mx == r ? ((g - b) / d).truncatingRemainder(dividingBy: 6) : mx == g ? (b - r) / d + 2 : (r - g) / d + 4 }
        h *= 60
        let s = d > 0 ? min(0.62, max(0.42, d / (1 - abs(mx + mn - 1)))) : 0
        let l = 0.62
        let c = (1 - abs(2 * l - 1)) * s, x = c * (1 - abs((h / 60).truncatingRemainder(dividingBy: 2) - 1)), m0 = l - c / 2
        (r, g, b) = h < 60 ? (c, x, 0) : h < 120 ? (x, c, 0) : h < 180 ? (0, c, x) : h < 240 ? (0, x, c) : h < 300 ? (x, 0, c) : (c, 0, x)
        let to = { (v: Double) in UInt32((v + m0) * 255 + 0.5) }
        return to(r) << 16 | to(g) << 8 | to(b)
    }

    /// Where a price means something. Only these spend a Google lookup (/api/price).
    var hasPrice: Bool { [.restaurant, .cafe, .bar, .bakery].contains(self) }

    /// Sarp's 3D icon for the bucket (2026-10-06): map pins, photo-less list rows
    /// and tiles. The Type* assets; the web's `iconFor` serves the same set.
    var icon: Image { Image("Type\(rawValue)") }

    var plural: String {
        switch self {
        case .nature, .culture, .other: return rawValue
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
            case .theater, .movieTheater, .musicVenue: return .culture
            case .amusementPark, .aquarium, .zoo: return .attraction
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
