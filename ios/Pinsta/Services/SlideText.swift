import Foundation
import Vision
import MapKit

/// "Six places to eat alone in Oslo": a carousel whose places are only written on its
/// pictures (Vink, 2026-10-14) — no tag, nothing in the caption. Apple's text recognition
/// (on the phone, free, the same as Live Text) reads the labels; each short line is
/// searched near the post's city and kept only when a place carries exactly that name.
/// Cover and outro text ("Spise ute alene i Oslo?", "Guide") finds nothing named like it.
enum SlideText {
    struct Found {
        let candidate: PlaceCandidate
        /// The slide the name was on: that place's photo.
        let image: Data?
    }

    /// The places named on the slides, in slide order. Empty when fewer than two: one
    /// place is the ordinary flow's job.
    /// `account`: the poster's name and handle — their logo on a slide ("Vink") is not a place.
    /// `caption`: a numbered list in it ("1. paon bali (@paon_bali_amsterdam)", Amsterdam Indonesian
    /// reel, 2026-10-15) names places the same way; those get the post's own photo.
    static func places(slides: [String], caption: String? = nil, city: String?, account: [String] = []) async -> [Found] {
        let listed = captionList(caption)
        guard slides.count >= 2 || listed.count >= 2 else { return [] }
        // Downloaded and read together; a slide that fails is just skipped.
        let read: [(Int, Data, [String])] = await withTaskGroup(of: (Int, Data, [String])?.self) { group in
            for (i, link) in slides.prefix(10).enumerated() {
                group.addTask {
                    guard let data = await ImageLoader.data(from: link) else { return nil }
                    return (i, data, lines(in: data))
                }
            }
            var out: [(Int, Data, [String])] = []
            for await r in group { if let r { out.append(r) } }
            return out.sorted { $0.0 < $1.0 }
        }
        // Each name keeps where it came from: its slide (0…), or its caption line (-1, -2…).
        var names: [(String, Data?, Int)] = listed.enumerated().map { ($0.element, nil, -1 - $0.offset) }
        for (i, data, lines) in read where slides.count >= 2 {
            let mine = account.map { fold($0).filter { $0.isLetter || $0.isNumber } }.filter { !$0.isEmpty }
            for l in lines where !names.contains(where: { fold($0.0) == fold(l) }) {
                let letters = fold(l).filter { $0.isLetter || $0.isNumber }
                if mine.contains(where: { $0 == letters || $0.hasPrefix(letters) }) { continue }
                names.append((l, data, i))
            }
        }
        guard names.count >= 2 else { return [] }

        let near = await city.asyncFlatMap { await PlaceSearch.locate($0) }
        // One after another: Apple throttles a burst (fourteen at once took 50 s; in turn, 0.2 s each).
        var found: [(Found, Int)] = []
        func keep(_ c: PlaceCandidate, _ data: Data?, _ from: Int) {
            guard !account.contains(where: { named(c.name, $0) }), !found.contains(where: { $0.0.candidate.id == c.id }) else { return }
            found.append((Found(candidate: c, image: data), from))
        }
        for (name, data, from) in names.prefix(14) {
            let hits = (try? await search(name, near: near)) ?? []
            if let c = hits.first(where: { named($0.name, name) && PlaceSearch.isNear($0, near) }) { keep(c, data, from) }
        }

        // Apple Maps lags on some places (Tranen, Oslo, 2026-10-14: the one of six it missed).
        // Once Apple has found the list's area, the slides (and caption lines) it found nothing on
        // are asked of Google there: a slide's lines in order until one is a place, at most
        // `googleAsks` queries a post (paid, counted on the server's daily cap).
        if !found.isEmpty, let area = near ?? centre(found.map(\.0)) {
            let missed = Dictionary(grouping: names.prefix(14).filter { n in !found.contains { $0.1 == n.2 } }, by: \.2)
            var asked = 0
            for from in missed.keys.sorted(by: { ($0 < 0 ? -100 - $0 : $0) < ($1 < 0 ? -100 - $1 : $1) }) {
                for (name, data, _) in missed[from] ?? [] where asked < googleAsks {
                    asked += 1
                    let hits = await GoogleFallback.search([name], near: area)
                    if let c = hits.first(where: { calls($0.name, name) && PlaceSearch.isNear($0, area) }) { keep(c, data, from); break }
                }
            }
            found.sort { ($0.1 < 0 ? -100 - $0.1 : $0.1) < ($1.1 < 0 ? -100 - $1.1 : $1.1) }
        }
        // The biggest group within 40 km of each other: six Oslo places, not a namesake in Steninge.
        let kept = biggestCluster(found.map(\.0))
        return kept.count >= 2 ? kept : []
    }

    /// The most Google queries one list post may make for names Apple Maps missed.
    static let googleAsks = 6

    /// The middle of the places Apple found; nil when it found none (then Google isn't asked).
    private static func centre(_ found: [Found]) -> CLLocationCoordinate2D? {
        guard !found.isEmpty else { return nil }
        let n = Double(found.count)
        return CLLocationCoordinate2D(latitude: found.map(\.candidate.latitude).reduce(0, +) / n,
                                      longitude: found.map(\.candidate.longitude).reduce(0, +) / n)
    }

    /// Google's name for it says the label as whole words: "Tranen" → "Restaurant Tranen", but
    /// "Bar" is not "Barcelona Bar Guide" (four letters at least), and `named` still holds.
    private static func calls(_ place: String, _ label: String) -> Bool {
        if named(place, label) { return true }
        let p = words(place), l = words(label)
        guard l.joined().count >= 4, l.count <= p.count else { return false }
        return (0...(p.count - l.count)).contains { Array(p[$0..<($0 + l.count)]) == l }
    }

    private static func words(_ s: String) -> [String] {
        fold(s).split { !($0.isLetter || $0.isNumber) }.map(String.init)
    }

    /// The items of a list in the caption: two or more lines starting "1." / "2)" / "-" / "•",
    /// each cut at an "(@handle)", " - " or " – " and kept when it reads like a name.
    static func captionList(_ caption: String?) -> [String] {
        guard let caption else { return [] }
        let marker = #/^\s*(?:\d{1,2}\s*[.)]|[-•▪·]|\d\x{FE0F}?\x{20E3})\s*(.+)$/#
        let items = caption.split(whereSeparator: \.isNewline).compactMap { line -> String? in
            guard let m = String(line).firstMatch(of: marker) else { return nil }
            var s = String(m.1)
            for cut in ["(@", " @", " - ", " – ", " — ", ":"] { if let r = s.range(of: cut) { s = String(s[..<r.lowerBound]) } }
            s = s.trimmingCharacters(in: CharacterSet.alphanumerics.inverted.subtracting(CharacterSet(charactersIn: "&'’")))
            guard (3...40).contains(s.count), s.split(separator: " ").count <= 5, s.rangeOfCharacter(from: .letters) != nil,
                  !s.contains("#"), !s.lowercased().contains("http") else { return nil }
            return s
        }
        return items.count >= 2 ? items : []
    }

    /// Short label-like lines: 3–40 characters, four words at most, not a sentence,
    /// a handle, a hashtag, a link or a number.
    static func lines(in data: Data) -> [String] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        guard (try? VNImageRequestHandler(data: data).perform([request])) != nil else { return [] }
        return (request.results ?? []).compactMap { obs -> String? in
            guard let top = obs.topCandidates(1).first, top.confidence >= 0.5 else { return nil }
            let s = top.string.trimmingCharacters(in: CharacterSet.alphanumerics.inverted.subtracting(CharacterSet(charactersIn: "&'’")))
            guard (3...40).contains(s.count), s.split(separator: " ").count <= 4,
                  s.rangeOfCharacter(from: .letters) != nil,
                  !s.contains("@"), !s.contains("#"), !s.lowercased().contains("http"),
                  !top.string.hasSuffix("?"), !top.string.hasSuffix("!"), !top.string.hasSuffix(".") else { return nil }
            return s
        }
    }

    private static func search(_ name: String, near: CLLocationCoordinate2D?) async throws -> [PlaceCandidate] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = name
        request.resultTypes = .pointOfInterest
        request.region = near.map { MKCoordinateRegion(center: $0, latitudinalMeters: 25_000, longitudinalMeters: 25_000) }
            ?? MKCoordinateRegion(center: .init(latitude: 0, longitude: 0), span: .init(latitudeDelta: 180, longitudeDelta: 360))
        return try await MKLocalSearch(request: request).start().mapItems.prefix(5).map(PlaceCandidate.init)
    }

    /// The place is called that: same letters, or the label is the start of a longer
    /// name ("Hyde" → "Hyde Oslo"). "Tranen" is not "Åpent Bakeri".
    private static func named(_ place: String, _ label: String) -> Bool {
        let p = fold(place).filter { $0.isLetter || $0.isNumber }
        let l = fold(label).filter { $0.isLetter || $0.isNumber }
        return p == l || (l.count >= 4 && p.hasPrefix(l))
    }

    private static func fold(_ s: String) -> String {
        s.precomposedStringWithCompatibilityMapping.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
    }

    private static func biggestCluster(_ found: [Found]) -> [Found] {
        func close(_ a: Found, _ b: Found) -> Bool {
            CLLocation(latitude: a.candidate.latitude, longitude: a.candidate.longitude)
                .distance(from: CLLocation(latitude: b.candidate.latitude, longitude: b.candidate.longitude)) < 40_000
        }
        let groups = found.map { f in found.filter { close(f, $0) } }
        return groups.max { $0.count < $1.count } ?? []
    }
}

private extension Optional {
    func asyncFlatMap<T>(_ f: (Wrapped) async -> T?) async -> T? {
        guard let self else { return nil }
        return await f(self)
    }
}
