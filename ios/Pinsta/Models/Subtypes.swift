import Foundation
import MapKit

/// Finer types in the What menu (Sarp, 2026-10-15), as `lib/subtypes.ts` on the web:
/// when 2+ places in a category share a type ("wine_bar" among Bars), that type gets its
/// own indented row under the category. One place never does, nor a type that is the whole
/// category, nor the category's plain type. Labels copy what Google or Apple says, never our
/// own words (Sarp: no cuisine rows from food words). `Place.subtypeRaw` holds the type id:
/// Google's `primaryType` when the Google fallback found the place, else Apple's category
/// in the same shape ("MKPOICategoryNationalPark" → "national_park").
enum Subtypes {
    /// Types that only restate the bucket; never a row of their own.
    private static let plain: Set<String> = [
        "restaurant", "food", "bar", "cafe", "hotel", "lodging", "museum", "bakery", "store",
        "point_of_interest", "establishment", "tourist_attraction", "nightlife", "park",
    ]
    private static let maxPerCategory = 3

    /// Apple's category as a type id, or nil when it says no more than our bucket.
    static func fromApple(_ poi: MKPointOfInterestCategory?) -> String? {
        guard let raw = poi?.rawValue, raw.hasPrefix("MKPOICategory") else { return nil }
        let name = raw.dropFirst("MKPOICategory".count)
        var id = ""
        for ch in name {
            if ch.isUppercase, !id.isEmpty { id += "_" }
            id += ch.lowercased()
        }
        return plain.contains(id) || id.isEmpty ? nil : id
    }

    /// The subtype rows under `category`, biggest first.
    static func of(_ places: [Place], in category: PlaceCategory) -> [(type: String, label: String, count: Int)] {
        let inCategory = places.filter { $0.category == category }
        var counts: [String: Int] = [:]
        for p in inCategory { if let t = p.subtypeRaw, !plain.contains(t) { counts[t, default: 0] += 1 } }
        return counts
            .filter { $0.value >= 2 && $0.value < inCategory.count }
            .sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            .prefix(maxPerCategory)
            .map { (type: $0.key, label: label($0.key), count: $0.value) }
    }

    /// Google's English name for a type id ("wine_bar" → "Wine bar").
    static func label(_ type: String) -> String {
        let words = type.replacingOccurrences(of: "_", with: " ")
        return words.prefix(1).uppercased() + words.dropFirst()
    }
}
