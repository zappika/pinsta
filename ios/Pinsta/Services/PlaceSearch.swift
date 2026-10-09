import Foundation
import MapKit

/// A candidate from MapKit search — the native replacement for Google Places.
struct PlaceCandidate: Identifiable, Hashable {
    let id: String
    let name: String
    let latitude: Double
    let longitude: Double
    let address: String?
    let city: String?
    /// State / county / län — what a traveler names when the town is too small to.
    let region: String?
    let country: String?
    let category: PlaceCategory
    /// The venue's own website, when Apple has one.
    var website: String? = nil
}

enum PlaceSearch {
    /// Worldwide point-of-interest search. No key, no quota, on Apple's servers.
    static func search(_ query: String, limit: Int = 5, near: CLLocationCoordinate2D? = nil) async throws -> [PlaceCandidate] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = .pointOfInterest
        // Around a Google Maps pin when there is one; otherwise the whole world
        // (without a region MapKit biases to the device's location).
        request.region = near.map { MKCoordinateRegion(center: $0, latitudinalMeters: 3000, longitudinalMeters: 3000) }
            ?? MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
                span: MKCoordinateSpan(latitudeDelta: 180, longitudeDelta: 360)
            )
        let response = try await MKLocalSearch(request: request).start()
        return response.mapItems.prefix(limit).map(PlaceCandidate.init)
    }
}

// MARK: - From a post to candidates

extension PlaceSearch {
    /// Turn an Instagram location tag into candidates. The tag alone often
    /// isn't enough ("Boreal" is tagged, MapKit knows "Restaurant Boreal"), so
    /// several cheap queries run together and merge, names containing the tag
    /// first: the tag as written; the account's display name when it overlaps
    /// the tag; tag + a category word from the caption; tag + a hashtag that
    /// names a city we already have.
    static func resolveTag(
        _ tag: String,
        ownerFullName: String?,
        caption: String?,
        hashtags: [String],
        cityHints: [String],
        extraQueries: [String] = []
    ) async -> [PlaceCandidate] {
        let tag = tag.trimmingCharacters(in: .whitespacesAndNewlines)
        let tagWords = words(tag)
        var queries: [String] = [tag]

        if let full = ownerFullName?.trimmingCharacters(in: .whitespacesAndNewlines),
           full.lowercased() != tag.lowercased(), overlaps(words(full), tagWords) {
            queries.append(full)
        }
        let text = "\(caption ?? "") \(hashtags.joined(separator: " ")) \(ownerFullName ?? "")".lowercased()
        if let kind = categoryWords.first(where: { text.contains($0) }), !tag.lowercased().contains(kind) {
            queries.append("\(tag) \(kind)")
        }
        let hints = Set(cityHints.map { $0.lowercased().replacingOccurrences(of: " ", with: "") })
        if let city = hashtags.map({ $0.lowercased() }).first(where: { hints.contains($0) }) {
            queries.append("\(tag) \(city)")
        }
        // More queries to merge in (TikTok gives the tagged place's city).
        for q in extraQueries.map({ $0.trimmingCharacters(in: .whitespaces) }) where !q.isEmpty && !queries.contains(q) {
            queries.append(q)
        }

        let merged = await runAll(queries)
        func score(_ c: PlaceCandidate) -> Int {
            let n = c.name.lowercased()
            if n == tag.lowercased() { return 0 }
            if n.contains(tag.lowercased()) { return 1 }
            if overlaps(words(c.name), tagWords) { return 2 }
            return 3
        }
        return merged.sorted { score($0) < score($1) }
    }

    /// No location tag: the account that posted is the lead. A venue's own
    /// account is named like the venue — a blogger's is not, so these are
    /// suggestions to tap, never to auto-save.
    /// `town`: the post is tagged with a town, not a place — search the account there.
    static func resolveAccount(ownerFullName: String?, ownerUsername: String?, town: String? = nil) async -> [PlaceCandidate] {
        var queries: [String] = []
        if let full = ownerFullName?.trimmingCharacters(in: .whitespacesAndNewlines), full.count > 2 { queries.append(full) }
        if let handle = ownerUsername?.replacingOccurrences(of: "[._-]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces), handle.count > 2 { queries.append(handle) }
        let split = handleWithCity(ownerUsername)
        if let split { queries.append(split) }
        if let town { queries += queries.filter { $0 != split }.map { "\($0) \(town)" } }
        guard !queries.isEmpty else { return [] }
        let merged = await runAll(queries)
        // Only places sharing a real word with the account: "jecca" must not suggest "JEC Arquitectura".
        let nameWords = words(ownerFullName ?? "") + words(ownerUsername ?? "") + words(split ?? "")
        return merged.filter { overlaps(words($0.name), nameWords) }
    }

    private static let regionNames: Set<String> = {
        var names: Set<String> = ["usa", "uk", "uae", "england", "scotland", "italia", "españa", "deutschland", "sverige", "danmark", "türkiye"]
        let en = Locale(identifier: "en")
        for region in Locale.Region.isoRegions {
            if let name = en.localizedString(forRegionCode: region.identifier) { names.insert(name.lowercased()) }
        }
        return names
    }()

    /// A location tag that names a town, not a place: "Ostuni, Puglia, Italy", "Paris, France".
    /// Three or more parts, or two ending in a country. Returns the town; nil for a place tag
    /// ("Septime, Paris" keeps its name). Same rule as `areaOfTag` in lib/google-places.ts.
    static func areaOfTag(_ tag: String?) -> String? {
        let parts = (tag ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if parts.count >= 3 || (parts.count == 2 && regionNames.contains(parts[1].lowercased())) { return parts[0] }
        return nil
    }

    // Cities restaurants glue onto their handle: "barabbacph", "joe_nyc", "cafe.sthlm".
    // Only codes that don't end ordinary words ("ber" would split "amber"). Same list in lib/google-places.ts.
    private static let handleCities: [(String, String)] = [
        ("cph", "Copenhagen"), ("copenhagen", "Copenhagen"), ("kbh", "Copenhagen"),
        ("nyc", "New York"), ("ldn", "London"), ("london", "London"), ("bcn", "Barcelona"), ("barcelona", "Barcelona"),
        ("sthlm", "Stockholm"), ("stockholm", "Stockholm"), ("gbg", "Gothenburg"), ("malmo", "Malmö"),
        ("cdmx", "Mexico City"), ("paris", "Paris"), ("berlin", "Berlin"), ("istanbul", "Istanbul"), ("lisbon", "Lisbon"),
        ("lisboa", "Lisbon"), ("madrid", "Madrid"), ("milano", "Milano"), ("roma", "Rome"), ("tokyo", "Tokyo"), ("hki", "Helsinki"),
    ]

    /// "barabbacph" → "barabba Copenhagen"; nil when the handle carries no city.
    static func handleWithCity(_ username: String?) -> String? {
        let parts = (username ?? "").lowercased().split { "._-".contains($0) }.map(String.init)
        for i in stride(from: parts.count - 1, through: 0, by: -1) {
            let p = parts[i]
            if i > 0, let city = handleCities.first(where: { $0.0 == p })?.1 {
                return (Array(parts[..<i]) + Array(parts[(i + 1)...]) + [city]).joined(separator: " ")
            }
            for (code, city) in handleCities where p.count >= code.count + 3 && p.hasSuffix(code) {
                return (Array(parts[..<i]) + [String(p.dropLast(code.count))] + Array(parts[(i + 1)...]) + [city]).joined(separator: " ")
            }
        }
        return nil
    }

    /// A Google Maps link names one place: search its name around its pin, nearest first.
    static func resolveLink(name: String, near: CLLocationCoordinate2D?) async -> [PlaceCandidate] {
        let found = (try? await search(name, limit: 5, near: near)) ?? []
        guard let near else { return found }
        let here = CLLocation(latitude: near.latitude, longitude: near.longitude)
        let sorted = found.sorted {
            CLLocation(latitude: $0.latitude, longitude: $0.longitude).distance(from: here)
                < CLLocation(latitude: $1.latitude, longitude: $1.longitude).distance(from: here)
        }
        // The nearest sits right on the pin (≈100 m): that's the place, no need to ask.
        if let first = sorted.first, CLLocation(latitude: first.latitude, longitude: first.longitude).distance(from: here) < 120 {
            return [first]
        }
        return Array(sorted.prefix(3))
    }

    /// Port of the web's `captionPlaceQuery`: "dinner at Cal Pep in Barcelona"
    /// → "Cal Pep Barcelona". Pattern matching only; suggestions, never auto-saved.
    static func captionPlaceQuery(_ caption: String?) -> String? {
        guard let caption else { return nil }
        let cap = #"[\p{Lu}\d][\p{L}\d'’&.-]*"#
        let pattern = #"(?:^|\s)(?:at|@|en|à|på|bei)\s+("# + cap + #"(?:\s+(?:de|del|la|le|du|of|the|&|"# + cap + #"))*)(?:\s+in\s+("# + cap + #"(?:\s+"# + cap + #")*))?"#
        guard let re = try? NSRegularExpression(pattern: pattern),
              let m = re.firstMatch(in: caption, range: NSRange(caption.startIndex..., in: caption)),
              let placeRange = Range(m.range(at: 1), in: caption) else { return nil }
        let trim: (Substring) -> String = { $0.trimmingCharacters(in: CharacterSet(charactersIn: ".,! ")) }
        let place = trim(caption[placeRange])
        guard place.count >= 3, !["the", "my", "our", "this"].contains(place.lowercased()) else { return nil }
        if let cityRange = Range(m.range(at: 2), in: caption) { return "\(place) \(trim(caption[cityRange]))" }
        return place
    }

    /// All queries in parallel, merged in order, de-duplicated by id.
    private static func runAll(_ queries: [String]) async -> [PlaceCandidate] {
        let unique = Array(NSOrderedSet(array: queries)) as? [String] ?? queries
        let results: [[PlaceCandidate]] = await withTaskGroup(of: (Int, [PlaceCandidate]).self) { group in
            for (i, q) in unique.enumerated() {
                group.addTask { (i, (try? await search(q, limit: 6)) ?? []) }
            }
            var out = Array(repeating: [PlaceCandidate](), count: unique.count)
            for await (i, list) in group { out[i] = list }
            return out
        }
        var seen = Set<String>(), merged: [PlaceCandidate] = []
        for c in results.flatMap({ $0 }) where seen.insert(c.id).inserted { merged.append(c) }
        return merged
    }

    private static let categoryWords = [
        "restaurant", "ristorante", "restaurang", "bistro", "brasserie", "trattoria", "osteria", "taverna",
        "bar", "cocktail", "wine bar", "vinbar", "pub",
        "cafe", "café", "coffee", "kaffe", "kahvila",
        "bakery", "bageri", "boulangerie", "pastry", "konditori",
        "hotel", "hostel", "guesthouse", "b&b",
        "vineyard", "vingård", "winery",
        "museum", "gallery", "galleri",
        "shop", "store", "boutique", "butik",
        "beach", "park", "spa",
    ]

    private static func words(_ s: String) -> [String] {
        s.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count > 2 }
    }
    private static func overlaps(_ a: [String], _ b: [String]) -> Bool { a.contains { b.contains($0) } }
}

extension PlaceCandidate {
    init(_ item: MKMapItem) {
        let placemark = item.placemark
        let coordinate = placemark.coordinate
        let name = item.name ?? "Unnamed place"
        self.init(
            id: "\(name)|\(coordinate.latitude),\(coordinate.longitude)",
            name: name,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: placemark.title,
            city: placemark.locality ?? placemark.subAdministrativeArea ?? placemark.administrativeArea,
            region: placemark.administrativeArea,
            // English from the ISO code: MapKit gives the local name ("日本"), and the
            // country chips and the web say "Japan".
            country: placemark.isoCountryCode.flatMap { Locale(identifier: "en").localizedString(forRegionCode: $0) } ?? placemark.country,
            category: PlaceCategory.from(item.pointOfInterestCategory, name: name),
            website: item.url?.absoluteString
        )
    }
}
