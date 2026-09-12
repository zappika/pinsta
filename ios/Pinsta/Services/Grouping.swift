import Foundation

/// Which name goes in the "Where" menu for each place — a port of the web's
/// `lib/grouping.ts`, same rules, same trade-offs:
///
///   1. A town with 2+ saved places is a destination in its own right.
///   2. A town with 1 place folds into its region — but only if that region
///      then bundles 2+ such places. A region row holding one place is
///      pointless, so the town keeps its own name instead.
///
/// The first Malmö place is "Malmö"; Ästad and Ystad together become "Skåne";
/// Ästad alone stays "Ästad". Decided purely from what's saved — no lookups.
enum Grouping {
    static let ownRowAt = 2

    static func destinationLabels(_ places: [Place]) -> [UUID: String] {
        var byCity: [String: Int] = [:]
        for p in places { byCity[p.city ?? "", default: 0] += 1 }

        func regionOf(_ p: Place) -> String { cleanRegion(p.region) ?? p.country ?? "Elsewhere" }

        var singletonsByRegion: [String: Int] = [:]
        for p in places where (byCity[p.city ?? ""] ?? 0) < ownRowAt {
            singletonsByRegion[regionOf(p), default: 0] += 1
        }

        var labels: [UUID: String] = [:]
        for p in places {
            let city = p.city ?? ""
            if (byCity[city] ?? 0) >= ownRowAt {
                labels[p.id] = city.isEmpty ? regionOf(p) : city
                continue
            }
            let r = regionOf(p)
            labels[p.id] = (singletonsByRegion[r] ?? 0) >= ownRowAt ? r : (city.isEmpty ? r : city)
        }
        return labels
    }

    /// "Hallands län" → "Halland", "Skåne County" → "Skåne", "Province of X" → "X".
    static func cleanRegion(_ region: String?) -> String? {
        guard var r = region?.trimmingCharacters(in: .whitespaces), !r.isEmpty else { return nil }
        r = r.replacingOccurrences(of: "^(province|region|state|county|department)\\s+of\\s+", with: "", options: [.regularExpression, .caseInsensitive])
        let swedish = r.range(of: "\\s+län$", options: [.regularExpression, .caseInsensitive]) != nil
        r = r.replacingOccurrences(of: "\\s+(län|county|region|province|prefecture|governorate|district|oblast)$", with: "", options: [.regularExpression, .caseInsensitive])
        // Swedish län take the genitive: "Hallands län", "Stockholms län".
        if swedish, r.range(of: "[a-zåäö]s$", options: [.regularExpression, .caseInsensitive]) != nil,
           r.range(of: "(s|x|z)s$", options: [.regularExpression, .caseInsensitive]) == nil {
            r.removeLast()
        }
        return r.isEmpty ? nil : r
    }
}
