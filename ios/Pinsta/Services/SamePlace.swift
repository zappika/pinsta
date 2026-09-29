import Foundation
import CoreLocation

/// Port of the web's lib/same-place.ts: is a new save the same place as one
/// already in the list? Same Google id, or within ~60 m with a shared
/// non-generic word in the name ("Bar Brutal" / "Can Cisa/Bar Brutal").
enum SamePlace {
    private static let generic: Set<String> = ["bar", "cafe", "café", "restaurant", "the", "and", "hotel", "coffee", "shop"]

    static func matches(_ p: Place, name: String, latitude: Double, longitude: Double) -> Bool {
        let d = CLLocation(latitude: p.latitude, longitude: p.longitude).distance(from: CLLocation(latitude: latitude, longitude: longitude))
        guard d <= 60 else { return false }
        let a = words(p.name)
        return words(name).contains { a.contains($0) }
    }

    private static func words(_ s: String) -> [String] {
        s.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count > 2 && !generic.contains($0) }
    }
}
