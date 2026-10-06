import Foundation

/// Country names in English, whatever MapKit said. Saves since build 11 store
/// English (from the ISO code); older ones can hold the local name ("日本"),
/// which would split one country into two chips. Looked up once, lazily, over
/// the languages a place's local name is likely to be in.
enum CountryName {
    static func english(_ name: String?) -> String? {
        guard let name else { return nil }
        return table[name.lowercased()] ?? name
    }

    private static let table: [String: String] = {
        let en = Locale(identifier: "en")
        let languages = ["ja", "zh-Hans", "zh-Hant", "ko", "th", "vi", "ru", "uk", "el", "ar", "he", "hi", "tr",
                         "es", "ca", "it", "pt", "fr", "de", "nl", "sv", "da", "nb", "fi", "pl", "cs", "hu", "ro", "hr", "id"]
        var out: [String: String] = [:]
        for region in Locale.Region.isoRegions {
            let code = region.identifier
            guard code.count == 2, let english = en.localizedString(forRegionCode: code) else { continue }
            for lang in languages {
                if let local = Locale(identifier: lang).localizedString(forRegionCode: code) { out[local.lowercased()] = english }
            }
        }
        return out
    }()
}
