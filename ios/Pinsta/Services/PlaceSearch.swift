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
    /// A station or a car park: a real place, almost never what a post means.
    var isTransit = false
    /// Google's primaryType or Apple's category as a type id, when finer than `category` (`Subtypes`).
    var subtype: String? = nil
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
        ownerUsername: String? = nil,
        coauthors: [String] = [],
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
        // The handle too: "restaurangvra" says restaurant when nothing else does.
        let text = "\(caption ?? "") \(hashtags.joined(separator: " ")) \(ownerFullName ?? "") \(ownerUsername ?? "")".lowercased()
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

        // A city in a handle says where the tag is: "Criollo" from @criollo_oax, "JAJA" from @jaja.berlin (2026-10-16).
        let place = postCity(ownerUsername: ownerUsername, coauthors: coauthors, town: nil, hashtags: hashtags)
        if let place, !queries.contains("\(tag) \(place)") { queries.append("\(tag) \(place)") }

        let merged = await runAll(queries)
        func score(_ c: PlaceCandidate) -> Int {
            let n = c.name.lowercased()
            if n == tag.lowercased() { return 0 }
            if n.contains(tag.lowercased()) { return 1 }
            if overlaps(words(c.name), tagWords) { return 2 }
            return 3
        }
        // A result in a town named like the tag matched the town, not the venue ("VRÅ" → Vrå, Denmark).
        let venues = merged.filter { isVenue($0, asked: tag) && fold($0.city ?? "") != fold(tag) }.sorted { score($0) < score($1) }
        // Something in the handle's city: only those. Nothing there: a blog can tag a place elsewhere, keep all.
        guard let place, let near = await locate(place) else { return venues }
        let local = venues.filter { isNear($0, near) }
        return local.isEmpty ? venues : local
    }

    /// No location tag: the account that posted is the lead. A venue's own
    /// account is named like the venue — a blogger's is not, so these are
    /// suggestions to tap, never to auto-save.
    /// `town`: the post is tagged with a town, not a place — search the account there.
    /// `near`: the post is tagged with a street — search around it, drop what's far.
    static func resolveAccount(ownerFullName: String?, ownerUsername: String?, town: String? = nil, near: CLLocationCoordinate2D? = nil) async -> [PlaceCandidate] {
        var queries: [String] = []
        if let full = ownerFullName?.trimmingCharacters(in: .whitespacesAndNewlines), full.count > 2 { queries.append(full) }
        if let handle = ownerUsername?.replacingOccurrences(of: "[._-]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces), handle.count > 2 { queries.append(handle) }
        let split = handleWithCity(ownerUsername)
        if let split { queries.append(split) }
        if let kindSplit = handleWithKind(ownerUsername) { queries.append(kindSplit) }
        if let town { queries += queries.filter { $0 != split }.map { "\($0) \(town)" } }
        guard !queries.isEmpty else { return [] }
        // A city glued to the handle pins the search there ("batasthlm": Bata the shoe shop in Spain is not it).
        let handleCity = cityOfHandle(ownerUsername)
        var near = near
        if near == nil, let handleCity { near = await locate(handleCity) }
        let merged = await runAll(queries, near: near)
        // Only places sharing a real word with the account: "jecca" must not suggest "JEC Arquitectura".
        // A handle glues the words together ("richterholtermann"): a long name word inside it counts too.
        // The handle's city is where, not who: "Stockholm University" doesn't match @batasthlm.
        let cityWords = words(handleCity ?? "")
        let nameWords = (words(ownerFullName ?? "") + words(ownerUsername ?? "") + words(split ?? "") + words(handleWithKind(ownerUsername) ?? ""))
            .filter { !cityWords.contains($0) && !categoryWords.contains($0) }
        let glued = (ownerUsername ?? "").lowercased().filter { $0.isLetter || $0.isNumber }
        // The city glued to the handle ("batasthlm" → Stockholm) and a name exactly the account's rank first.
        // The handle without its city counts too: @elenamontreal is "Elena", not "Pizzéria Elena" (2026-10-16).
        let exact = Set([ownerFullName, ownerUsername, splitHandleCity(ownerUsername)?.name].compactMap { $0 }.map(letters))
        func rank(_ c: PlaceCandidate) -> Int {
            (handleCity != nil && fold(c.city ?? "") == fold(handleCity ?? "") ? 0 : 2) + (exact.contains(letters(c.name)) ? 0 : 1)
        }
        return merged.filter { c in
            isVenue(c) && isNear(c, near)
                && (overlaps(words(c.name), nameWords) || words(c.name).contains { $0.count >= 4 && glued.contains($0) })
        }
        .enumerated().sorted { (rank($0.element), $0.offset) < (rank($1.element), $1.offset) }.map(\.element)
    }

    /// Two names share a real word, accents aside.
    static func sharesWord(_ a: String, _ b: String) -> Bool { overlaps(words(a), words(b)) }

    private static func letters(_ s: String) -> String {
        fold(s).filter { $0.isLetter || $0.isNumber }
    }

    /// For comparing names: case, accents and maths letters away. "VRÅ" = "vra" (@restaurangvra), 𝐁𝐀𝐓𝐀 = bata.
    private static func fold(_ s: String) -> String {
        s.precomposedStringWithCompatibilityMapping.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
    }

    /// A profile is one venue: candidates named like the account, and of its kind when MapKit's
    /// category agrees ("Restaurant" ↔ Restaurant). Same rule as `profileMatches` on the web.
    static func profileMatches(_ cs: [PlaceCandidate], fullName: String?, username: String?, category: String?) -> [PlaceCandidate] {
        let names = words(fullName ?? "") + words(username ?? "")
        let glued = letters(username ?? "")
        let named = cs.filter { c in overlaps(words(c.name), names) || words(c.name).contains { $0.count >= 3 && glued.contains($0) } }
        let kind = (category ?? "").lowercased()
        let sameKind = named.filter { $0.category != .other && kind.contains($0.category.rawValue.lowercased()) }
        // The account names a kind we know and nothing is of it: Apple doesn't have the venue yet
        // (BATA, 2026-10-14). Better nothing than the Bata shoe shop.
        let knownKind = PlaceCategory.allCases.contains { $0 != .other && kind.contains($0.rawValue.lowercased()) }
        return knownKind ? sameKind : named
    }

    /// Untagged, or tagged with a street or a town: the venue is read off the post. Clues in
    /// order of trust: the caption's 📍 line, "at X in Y", a collab headline and its co-authors,
    /// then the posting account. All searched near the street when there is one; streets, towns
    /// and far-off namesakes dropped. `pinned`: the 📍 line answered — trusted like a tag.
    /// Same order as `resolveUntagged` in lib/google-places.ts.
    static func resolveUntagged(
        caption: String?, ownerFullName: String?, ownerUsername: String?, coauthors: [String],
        town: String?, near: CLLocationCoordinate2D?, hint: String? = nil
    ) async -> (candidates: [PlaceCandidate], pinned: Bool, near: CLLocationCoordinate2D?) {
        // The post's city keeps every search there: without it "Thomas Straker" found Thomas Strake in Hanau
        // for a New York collab, and Apple's far-off junk kept Google from being asked (2026-10-16).
        var near = near
        if near == nil, let city = postCity(ownerUsername: ownerUsername, coauthors: coauthors, town: town) { near = await locate(city) }
        func find(_ q: String?) async -> [PlaceCandidate] {
            guard let q else { return [] }
            return ((try? await search(q, limit: 6, near: near)) ?? []).filter { isVenue($0, asked: q) && isNear($0, near) }
        }
        let fromPin = await find(pinnedPlaceQuery(caption))
        if !fromPin.isEmpty { return (Array(fromPin.prefix(3)), true, near) }
        // "at Selma, …": a guess at a name, so the result has to carry it (not LittleBig in Bratislava).
        let atQuery = captionPlaceQuery(caption)
        let fromCaption = await find(atQuery).filter { overlaps(nameWords($0.name, $0), nameWords(atQuery ?? "", $0)) }
        var fromCollab: [PlaceCandidate] = []
        for name in collabNames(caption) {
            // A collab name is a guess at a venue: the result has to carry one of its words.
            fromCollab += (await find(name)).filter { overlaps(words($0.name), words(name)) }.prefix(2)
        }
        // Co-authors before the poster: on a collab the venue is rarely the one who posted.
        var fromAccounts: [PlaceCandidate] = []
        for handle in coauthors where handle != ownerUsername {
            fromAccounts += await resolveAccount(ownerFullName: nil, ownerUsername: handle, town: town, near: near).prefix(3)
        }
        let fromOwner = Array(await resolveAccount(ownerFullName: ownerFullName, ownerUsername: ownerUsername, town: town, near: near).prefix(3))
        // The poster found itself: a mentioned account's places far from it are a namesake. @lilliestuart
        // (a person) found "Stuart Studio" in Lille on Pophams' London post (2026-10-16).
        if let anchor = fromOwner.first {
            let at = CLLocation(latitude: anchor.latitude, longitude: anchor.longitude)
            fromAccounts = fromAccounts.filter { CLLocation(latitude: $0.latitude, longitude: $0.longitude).distance(from: at) <= 100_000 }
        }
        fromAccounts += fromOwner
        var seen = Set<String>()
        let merged = (Array(fromCaption.prefix(3)) + fromCollab + fromAccounts).filter { seen.insert($0.id).inserted }
        // On a collab, the venue carries the tag's or a collab name's words (VRÅ, not the Clarion Hotel it's in).
        // An account the post names (a co-author, an @mention) is the strongest lead: @arraval → Arraval first (2026-10-16).
        let handles = coauthors.filter { $0 != ownerUsername }
            .flatMap { words(splitHandleCity($0)?.name ?? $0.replacingOccurrences(of: "[._-]+", with: " ", options: .regularExpression)) }
        let hints = (words(hint ?? "") + collabNames(caption).flatMap(words) + handles)
            .filter { !handleCityNames.contains($0) && !categoryWords.contains($0) }
        let ranked = merged.enumerated().sorted { a, b in
            let ha = !hints.isEmpty && overlaps(words(a.element.name), hints) ? 0 : 1
            let hb = !hints.isEmpty && overlaps(words(b.element.name), hints) ? 0 : 1
            return (ha, a.offset) < (hb, b.offset)
        }.map(\.element)
        return (Array(ranked.prefix(4)), false, near)
    }

    /// Somewhere to go: not a station or a car park unless its name was asked for ("vR" offered
    /// Stockholm Central), and not a town named like itself ("Vrå"). Same rule as `isVenue` on the web.
    static func isVenue(_ c: PlaceCandidate, asked: String? = nil) -> Bool {
        // Searched "VRÅ", got Vrå the Danish town, its station and its school: a result in a town named like the search.
        if let asked, let city = c.city, fold(city) == fold(asked.trimmingCharacters(in: .whitespaces)) { return false }
        // The name has to be asked for, not the city it's in: "Barcelona-El Prat Airport" for an account in Barcelona (Arraval, 2026-10-16).
        if c.isTransit || transitName.firstMatch(in: c.name, range: NSRange(c.name.startIndex..., in: c.name)) != nil {
            return asked.map { overlaps(nameWords(c.name, c), nameWords($0, c)) } ?? false
        }
        // A town or a street: named like its town ("Vrå"), or like a street ("Vattugatan").
        if c.category == .other, c.name.lowercased() == c.city?.lowercased() || streetOfTag(c.name) != nil { return false }
        return true
    }

    // Transport that comes back untyped, known by its name ("Ferry de Barcelona"). Same list in lib/google-places.ts.
    private static let transitName = try! NSRegularExpression(
        pattern: #"(^|[^\p{L}])(airport|aeropuerto|aeroport|aéroport|aeroporto|flughafen|lufthavn|flygplats|lentoasema|havalimanı|ferry|ferries|ferri|terminal|estación|estació|gare|bahnhof|station)([^\p{L}]|$)"#,
        options: .caseInsensitive
    )

    /// A name's words that say who, not where: no city a handle can name, nor the result's own town or region.
    private static func nameWords(_ s: String, _ c: PlaceCandidate? = nil) -> [String] {
        let whereWords = Set(words(c?.city ?? "") + words(c?.region ?? ""))
        return words(s).filter { !handleCityNames.contains($0) && !whereWords.contains($0) }
    }

    /// Where a post is, when it says: a city in a co-author's or the poster's handle ("strakers_nyc",
    /// "selma__paris"), else a town tag, else a hashtag naming a city (#tokyo: 楽園 is in Tokyo, not Fukuoka).
    /// Same rule as `postCity` in lib/google-places.ts.
    static func postCity(ownerUsername: String?, coauthors: [String], town: String?, hashtags: [String] = []) -> String? {
        for u in coauthors + [ownerUsername].compactMap({ $0 }) { if let city = cityOfHandle(u) { return city } }
        if let town { return town }
        // #tokyo, or a city at the start of a longer tag: #BerlinGuide, #BerlinSpots (gatrooms, 2026-10-16).
        for h in hashtags {
            let key = fold(h).filter { ("a"..."z").contains($0) }
            if let city = handleCitiesGlued.first(where: { $0.0 == key })?.1
                ?? handleCitiesGlued.first(where: { $0.0.count >= 5 && key.hasPrefix($0.0) })?.1 { return city }
        }
        return nil
    }

    /// Within 30 km of a street tag's pin, or anywhere without one ("Bata, Ragusa" for a Stockholm post).
    static func isNear(_ c: PlaceCandidate, _ near: CLLocationCoordinate2D?) -> Bool {
        guard let near else { return true }
        return CLLocation(latitude: c.latitude, longitude: c.longitude)
            .distance(from: CLLocation(latitude: near.latitude, longitude: near.longitude)) <= 30_000
    }

    /// Where a street tag is: MapKit's address search, then the street alone
    /// (Apple doesn't know "Hornsgatan, Södermalm", only "Hornsgatan").
    static func locate(_ query: String) async -> CLLocationCoordinate2D? {
        for q in [query, streetOfTag(query)].compactMap({ $0 }) {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = q
            request.resultTypes = .address
            if let pin = try? await MKLocalSearch(request: request).start().mapItems.first?.placemark.coordinate { return pin }
        }
        return nil
    }

    /// A location tag that names a street, not a place: "Vattugatan", "Hornsgatan, Södermalm",
    /// "Carrer de Girona 145". It says where to look, never what (Mert, 2026-10-14).
    /// Same rule as `streetOfTag` in lib/google-places.ts.
    static func streetOfTag(_ tag: String?) -> String? {
        guard let first = tag?.split(separator: ",").first?.trimmingCharacters(in: .whitespaces), !first.isEmpty else { return nil }
        let ws = first.lowercased().split(separator: " ").map(String.init)
        let last = ws.last.map { $0.hasSuffix(".") ? String($0.dropLast()) : $0 } ?? ""
        if ws.contains(where: { w in streetEndings.contains { w.count > $0.count + 2 && w.hasSuffix($0) } }) { return first }
        if ws.count > 1, streetWords.contains(last) { return first }
        if ws.count > 1, streetPrefixes.contains(ws[0]) { return first }
        return nil
    }
    private static let streetEndings = ["gatan", "vägen", "gränd", "gade", "straße", "strasse", "straat", "gasse", "caddesi", "sokak", "sokağı"]
    private static let streetWords = ["street", "st", "road", "rd", "avenue", "ave", "boulevard", "blvd", "lane", "caddesi", "sokak", "sokağı", "cd", "sk"]
    private static let streetPrefixes = ["carrer", "calle", "avenida", "avinguda", "rua", "passeig", "paseo"]

    /// The caption's "📍 Prodigi" line, plus the address on the line below it.
    /// Same rule as `pinnedPlaceQuery` in lib/google-places.ts.
    static func pinnedPlaceQuery(_ caption: String?) -> String? {
        let lines = (caption ?? "").components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
        let lead = try! NSRegularExpression(pattern: #"^(?:📍|📌|(?:location|address|adress|adresse|dirección)(?:\s+of\s+the\s+\p{L}+)?\s*:)\x{FE0F}?"#, options: .caseInsensitive)
        func leads(_ l: String) -> Bool { lead.firstMatch(in: l, range: NSRange(l.startIndex..., in: l)) != nil }
        func clean(_ l: String) -> String {
            lead.stringByReplacingMatches(in: l, range: NSRange(l.startIndex..., in: l), withTemplate: "")
                .replacingOccurrences(of: "[@#]", with: " ", options: .regularExpression)
                .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
        }
        guard let i = lines.firstIndex(where: leads) else { return nil }
        var q = clean(lines[i])
        let below = i + 1 < lines.count ? lines[i + 1] : ""
        let next = clean(below)
        // The address on the line below: has a number or a comma, and isn't hashtags.
        if !next.isEmpty, !below.hasPrefix("#"), !leads(below),
           next.rangeOfCharacter(from: .decimalDigits) != nil || next.contains(",") || q.count < 3 {
            q = "\(q) \(next)".trimmingCharacters(in: .whitespaces)
        }
        return q.count >= 3 ? String(q.prefix(120)) : nil
    }

    /// A collab headline: "BROTH BOY x VRÅ" → both names, the capitalised words touching the x.
    /// Same rule as `collabNames` in lib/google-places.ts.
    static func collabNames(_ caption: String?) -> [String] {
        let first = (caption ?? "").components(separatedBy: "\n").first ?? ""
        let cleaned = first.replacingOccurrences(of: #"[^\p{L}\p{N}\s×&'’.-]"#, with: " ", options: .regularExpression)
        let parts = cleaned.components(separatedBy: try! NSRegularExpression(pattern: #"\s+[x×]\s+"#, options: .caseInsensitive))
        guard parts.count == 2 else { return [] }
        func name(_ ws: [String]) -> [String] {
            var run: [String] = []
            for w in ws { guard w.first?.isUppercase == true, run.count < 3 else { break }; run.append(w) }
            return run
        }
        let split: (String) -> [String] = { $0.split(whereSeparator: \.isWhitespace).map(String.init) }
        let left = name(split(parts[0]).reversed()).reversed().joined(separator: " ")
        let right = name(split(parts[1])).joined(separator: " ")
        return [left, right].filter { $0.count >= 3 }
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

    // Cities restaurants put in their handle: "barabbacph", "joe_nyc", "cafe.sthlm", "criollo_oax".
    // The cities a Monocle reader travels to (Sarp, 2026-10-16). Same lists in lib/google-places.ts.
    // Glued: also found stuck to the end of the name ("barabbacph"): full names and codes that end no ordinary word.
    private static let handleCitiesGlued: [(String, String)] = [
        ("oslo", "Oslo"), ("osl", "Oslo"), ("copenhagen", "Copenhagen"), ("cph", "Copenhagen"), ("kbh", "Copenhagen"), ("kobenhavn", "Copenhagen"),
        ("stockholm", "Stockholm"), ("sthlm", "Stockholm"), ("gothenburg", "Gothenburg"), ("goteborg", "Gothenburg"), ("gbg", "Gothenburg"), ("malmo", "Malmö"),
        ("helsinki", "Helsinki"), ("hki", "Helsinki"), ("reykjavik", "Reykjavík"), ("london", "London"), ("ldn", "London"), ("dublin", "Dublin"),
        ("edinburgh", "Edinburgh"), ("paris", "Paris"), ("lyon", "Lyon"), ("marseille", "Marseille"), ("bordeaux", "Bordeaux"), ("amsterdam", "Amsterdam"),
        ("brussels", "Brussels"), ("bruxelles", "Brussels"), ("antwerp", "Antwerp"), ("berlin", "Berlin"), ("hamburg", "Hamburg"), ("munich", "Munich"),
        ("munchen", "Munich"), ("vienna", "Vienna"), ("wien", "Vienna"), ("zurich", "Zürich"), ("zuerich", "Zürich"), ("geneva", "Geneva"),
        ("prague", "Prague"), ("praha", "Prague"), ("budapest", "Budapest"), ("copenhague", "Copenhagen"), ("warsaw", "Warsaw"), ("krakow", "Kraków"),
        ("barcelona", "Barcelona"), ("bcn", "Barcelona"), ("madrid", "Madrid"), ("sevilla", "Seville"), ("seville", "Seville"), ("valencia", "Valencia"),
        ("donostia", "San Sebastián"), ("sansebastian", "San Sebastián"), ("mallorca", "Mallorca"), ("ibiza", "Ibiza"), ("lisbon", "Lisbon"), ("lisboa", "Lisbon"),
        ("porto", "Porto"), ("milano", "Milan"), ("milan", "Milan"), ("roma", "Rome"), ("rome", "Rome"), ("napoli", "Naples"),
        ("firenze", "Florence"), ("florence", "Florence"), ("venezia", "Venice"), ("venice", "Venice"), ("torino", "Turin"), ("bologna", "Bologna"),
        ("athens", "Athens"), ("athina", "Athens"), ("istanbul", "Istanbul"), ("tbilisi", "Tbilisi"), ("beirut", "Beirut"), ("telaviv", "Tel Aviv"),
        ("marrakech", "Marrakech"), ("marrakesh", "Marrakech"), ("capetown", "Cape Town"), ("dubai", "Dubai"), ("tokyo", "Tokyo"), ("kyoto", "Kyoto"),
        ("osaka", "Osaka"), ("seoul", "Seoul"), ("taipei", "Taipei"), ("hongkong", "Hong Kong"), ("singapore", "Singapore"), ("bangkok", "Bangkok"),
        ("bkk", "Bangkok"), ("melbourne", "Melbourne"), ("sydney", "Sydney"), ("nyc", "New York"), ("newyork", "New York"), ("newyorkcity", "New York"), ("brooklyn", "Brooklyn"), ("losangeles", "Los Angeles"),
        ("sanfrancisco", "San Francisco"), ("chicago", "Chicago"), ("miami", "Miami"), ("portland", "Portland"), ("toronto", "Toronto"), ("montreal", "Montréal"),
        ("vancouver", "Vancouver"), ("cdmx", "Mexico City"), ("mexicocity", "Mexico City"), ("neworleans", "New Orleans"), ("austin", "Austin"), ("oaxaca", "Oaxaca"), ("oax", "Oaxaca"), ("buenosaires", "Buenos Aires"), ("saopaulo", "São Paulo"),
        ("lima", "Lima"), ("bogota", "Bogotá"), ("medellin", "Medellín"), ("havana", "Havana"),
    ]
    // Last: short codes, counted only as the handle's last part of their own ("cafe_lx", not "felix").
    private static let handleCitiesLast: [String: String] = Dictionary(uniqueKeysWithValues: [
        ("lx", "Lisbon"), ("lis", "Lisbon"), ("par", "Paris"), ("ber", "Berlin"), ("ams", "Amsterdam"), ("mil", "Milan"),
        ("mi", "Milan"), ("rom", "Rome"), ("ath", "Athens"), ("ist", "Istanbul"), ("tyo", "Tokyo"), ("zrh", "Zürich"),
        ("vie", "Vienna"), ("muc", "Munich"), ("prg", "Prague"), ("bxl", "Brussels"), ("edi", "Edinburgh"), ("dub", "Dublin"),
        ("tlv", "Tel Aviv"), ("hk", "Hong Kong"), ("sg", "Singapore"), ("syd", "Sydney"), ("mel", "Melbourne"), ("la", "Los Angeles"), ("ny", "New York"),
        ("nola", "New Orleans"), ("sf", "San Francisco"), ("mtl", "Montréal"), ("atx", "Austin"), ("bsas", "Buenos Aires"), ("cpt", "Cape Town"),
    ])
    /// "Tokyo", "BERLIN": a line that is only a city's name names no place (a slide's cover, gatrooms 2026-10-16).
    static func isCityName(_ s: String) -> Bool {
        let key = fold(s).filter { $0.isLetter }
        return handleCitiesGlued.contains { $0.0 == key || fold($0.1).filter(\.isLetter) == key }
    }

    /// Every city a handle can name, for telling a city word from a name word.
    private static let handleCityNames: Set<String> = Set((handleCitiesGlued.map(\.1) + handleCitiesLast.values).flatMap { fold($0).split(separator: " ").map(String.init) })

    /// "restaurangvra" → "restaurang vra": a category word glued on. Same rule as `handleWithKind` on the web.
    static func handleWithKind(_ username: String?) -> String? {
        let h = (username ?? "").lowercased().filter { !"._-".contains($0) }
        for w in categoryWords.filter({ $0.allSatisfy { ("a"..."z").contains($0) } }).sorted(by: { $0.count > $1.count }) {
            if h.count >= w.count + 3, h.hasPrefix(w) { return "\(w) \(h.dropFirst(w.count))" }
            if h.count >= w.count + 3, h.hasSuffix(w) { return "\(h.dropLast(w.count)) \(w)" }
        }
        return nil
    }

    /// "barabbacph" → "barabba Copenhagen"; nil when the handle carries no city.
    static func handleWithCity(_ username: String?) -> String? {
        splitHandleCity(username).map { [$0.name, $0.city].filter { !$0.isEmpty }.joined(separator: " ") }
    }

    /// "strakers_nyc" → "New York"; nil when the handle carries no city.
    static func cityOfHandle(_ username: String?) -> String? { splitHandleCity(username)?.city }

    private static func splitHandleCity(_ username: String?) -> (name: String, city: String)? {
        let parts = (username ?? "").lowercased().split { "._-".contains($0) }.map(String.init)
        if parts.count > 1, let city = handleCitiesLast[parts[parts.count - 1]] { return (parts.dropLast().joined(separator: " "), city) }
        for i in stride(from: parts.count - 1, through: 0, by: -1) {
            let p = parts[i]
            if i > 0, let city = handleCitiesGlued.first(where: { $0.0 == p })?.1 {
                return ((Array(parts[..<i]) + Array(parts[(i + 1)...])).joined(separator: " "), city)
            }
            for (code, city) in handleCitiesGlued where p.count >= code.count + 3 && p.hasSuffix(code) {
                return ((Array(parts[..<i]) + [String(p.dropLast(code.count))] + Array(parts[(i + 1)...])).joined(separator: " "), city)
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
    private static func runAll(_ queries: [String], near: CLLocationCoordinate2D? = nil) async -> [PlaceCandidate] {
        let unique = Array(NSOrderedSet(array: queries)) as? [String] ?? queries
        let results: [[PlaceCandidate]] = await withTaskGroup(of: (Int, [PlaceCandidate]).self) { group in
            for (i, q) in unique.enumerated() {
                group.addTask { (i, (try? await search(q, limit: 6, near: near)) ?? []) }
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
        fold(s).split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count > 2 }
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
            website: item.url?.absoluteString,
            isTransit: [.publicTransport, .parking, .gasStation, .evCharger].contains(item.pointOfInterestCategory),
            subtype: Subtypes.fromApple(item.pointOfInterestCategory)
        )
    }
}

private extension String {
    func components(separatedBy re: NSRegularExpression) -> [String] {
        var out: [String] = [], start = startIndex
        for m in re.matches(in: self, range: NSRange(startIndex..., in: self)) {
            guard let r = Range(m.range, in: self) else { continue }
            out.append(String(self[start..<r.lowerBound])); start = r.upperBound
        }
        out.append(String(self[start...]))
        return out
    }
}
