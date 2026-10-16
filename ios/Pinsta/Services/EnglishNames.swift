import CoreLocation
import Foundation
import SwiftData

/// Apple Maps names a town in Japan "世田谷区" whatever the phone's language: unreadable
/// in the list and never grouped with "Tokyo" (Sarp, 2026-10-16). A town or region in
/// another script is asked again in English, at its pin. The web gets English from Google.
enum EnglishNames {
    private static let otherScript = try! NSRegularExpression(
        pattern: #"[\p{Han}\p{Hiragana}\p{Katakana}\p{Hangul}\p{Cyrillic}\p{Greek}\p{Arabic}\p{Hebrew}\p{Thai}\p{Devanagari}\p{Georgian}\p{Armenian}]"#
    )

    static func needsFix(_ s: String?) -> Bool {
        guard let s else { return false }
        return otherScript.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    /// Right after a save.
    static func check(_ place: Place, in context: ModelContext) async {
        guard needsFix(place.city) || needsFix(place.region) else { return }
        let location = CLLocation(latitude: place.latitude, longitude: place.longitude)
        guard let mark = try? await CLGeocoder().reverseGeocodeLocation(location, preferredLocale: Locale(identifier: "en")).first
        else { return }
        if needsFix(place.city), let town = mark.locality ?? mark.subAdministrativeArea ?? mark.administrativeArea, !needsFix(town) {
            place.city = town
        }
        if needsFix(place.region), let region = mark.administrativeArea, !needsFix(region) { place.region = region }
        try? context.save()
    }

    /// On launch: places saved before this, or by the share extension. One at a time —
    /// the geocoder throttles a burst.
    static func run(in context: ModelContext) async {
        let places = ((try? context.fetch(FetchDescriptor<Place>())) ?? []).filter { needsFix($0.city) || needsFix($0.region) }
        for place in places {
            await check(place, in: context)
            try? await Task.sleep(for: .seconds(1.5))
        }
    }
}
