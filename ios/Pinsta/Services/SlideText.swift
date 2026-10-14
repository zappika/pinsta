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
    static func places(slides: [String], city: String?, account: [String] = []) async -> [Found] {
        guard slides.count >= 2 else { return [] }
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
        var names: [(String, Data)] = []
        for (_, data, lines) in read {
            let mine = account.map { fold($0).filter { $0.isLetter || $0.isNumber } }.filter { !$0.isEmpty }
            for l in lines where !names.contains(where: { fold($0.0) == fold(l) }) {
                let letters = fold(l).filter { $0.isLetter || $0.isNumber }
                if mine.contains(where: { $0 == letters || $0.hasPrefix(letters) }) { continue }
                names.append((l, data))
            }
        }
        guard names.count >= 2 else { return [] }

        let near = await city.asyncFlatMap { await PlaceSearch.locate($0) }
        // One after another: Apple throttles a burst (fourteen at once took 50 s; in turn, 0.2 s each).
        var found: [Found] = []
        for (name, data) in names.prefix(14) {
            let hits = (try? await search(name, near: near)) ?? []
            if let c = hits.first(where: { named($0.name, name) && PlaceSearch.isNear($0, near) }),
               !account.contains(where: { named(c.name, $0) }),
               !found.contains(where: { $0.candidate.id == c.id }) {
                found.append(Found(candidate: c, image: data))
            }
        }
        // The biggest group within 40 km of each other: six Oslo places, not a namesake in Steninge.
        let kept = biggestCluster(found)
        return kept.count >= 2 ? kept : []
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
