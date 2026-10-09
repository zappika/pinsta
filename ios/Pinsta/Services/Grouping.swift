import Foundation

/// Which name goes in the "Where" menu for each place — a port of the web's
/// `lib/grouping.ts`, same rules, same trade-offs:
///
///   0. First: a place inside a big city (`Metros`) is that city, even
///      alone. "Beyoğlu" and "Nordhavn" become "Istanbul" and "Copenhagen".
///   1. A town with 2+ saved places is a destination in its own right.
///   2. A town with 1 place folds into its region — but only if that region
///      then bundles 2+ such places. A region row holding one place is
///      pointless, so the town keeps its own name instead.
///
/// The first Malmö place is "Malmö"; Ästad and Ystad together become "Skåne";
/// Ästad alone stays "Ästad". Decided purely from what's saved — no lookups.
enum Grouping {
    static let ownRowAt = 2

    static func destinationLabels(_ all: [Place]) -> [UUID: String] {
        var labels: [UUID: String] = [:]
        var places: [Place] = []
        for p in all {
            // A city first, then a travel area ("Costa Brava"), even alone and even for a busy village.
            if let metro = Metros.at(lat: p.latitude, lng: p.longitude) ?? Metros.area(lat: p.latitude, lng: p.longitude) {
                labels[p.id] = metro
            } else { places.append(p) }
        }

        var byCity: [String: Int] = [:]
        for p in places { byCity[p.city ?? "", default: 0] += 1 }

        func regionOf(_ p: Place) -> String { regionName(p.region, country: p.country) ?? p.country ?? "Elsewhere" }

        var singletonsByRegion: [String: Int] = [:]
        for p in places where (byCity[p.city ?? ""] ?? 0) < ownRowAt {
            singletonsByRegion[regionOf(p), default: 0] += 1
        }

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

    /// MapKit names a Spanish province where the region is wanted, and Sweden by its län
    /// letter ("M"): both read as the region people say. Same tables as lib/grouping.ts.
    private static let spain: [String: String] = {
        let regions: [String: [String]] = [
            "Catalonia": ["Barcelona", "Girona", "Gerona", "Lleida", "Lérida", "Tarragona", "Catalunya", "Cataluña"],
            "Andalusia": ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla", "Seville", "Andalucía"],
            "Basque Country": ["Álava", "Araba", "Bizkaia", "Vizcaya", "Gipuzkoa", "Guipúzcoa", "País Vasco", "Euskadi"],
            "Valencia": ["Alicante", "Alacant", "Castellón", "Castelló", "Valencia", "València", "Comunitat Valenciana"],
            "Galicia": ["A Coruña", "La Coruña", "Lugo", "Ourense", "Pontevedra"],
            "Aragon": ["Huesca", "Teruel", "Zaragoza", "Aragón"],
            "Castile and León": ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"],
            "Castilla-La Mancha": ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"],
            "Extremadura": ["Badajoz", "Cáceres"],
            "Balearic Islands": ["Illes Balears", "Islas Baleares", "Baleares", "Mallorca"],
            "Canary Islands": ["Las Palmas", "Santa Cruz de Tenerife", "Canarias"],
        ]
        var map: [String: String] = [:]
        for (region, names) in regions { for n in names { map[n.lowercased()] = region } }
        return map
    }()
    private static let sweden: [String: String] = [
        "AB": "Stockholm", "C": "Uppsala", "D": "Södermanland", "E": "Östergötland", "F": "Jönköping", "G": "Kronoberg", "H": "Kalmar",
        "I": "Gotland", "K": "Blekinge", "M": "Skåne", "N": "Halland", "O": "Västra Götaland", "S": "Värmland", "T": "Örebro",
        "U": "Västmanland", "W": "Dalarna", "X": "Gävleborg", "Y": "Västernorrland", "Z": "Jämtland", "AC": "Västerbotten", "BD": "Norrbotten",
    ]

    static func regionName(_ region: String?, country: String?) -> String? {
        guard let r = region?.trimmingCharacters(in: .whitespaces), !r.isEmpty else { return nil }
        let c = (country ?? "").lowercased()
        if c == "spain" || c == "españa" { return spain[r.lowercased()] ?? cleanRegion(r) }
        if c == "sweden" || c == "sverige", let name = sweden[r] { return name }
        return cleanRegion(r)
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
