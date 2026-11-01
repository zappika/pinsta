// The save sheet's search, without the sheet: what AddPlaceView.find does with a post, Apple only
// (no Google fallback, no slide reading). Compiled by scripts/review/replay.mts together with the
// app's own PlaceSearch.swift, so it replays whatever the code in that checkout says.
// Input: a JSON file of cases. Output: one JSON line per case.
// Keep it in step with AddPlaceView.swift when the order of the search there changes.
import CoreLocation
import Foundation

struct Case: Decodable {
    let url: String
    let kind: String
    let locationName: String?
    let caption: String?
    let ownerFullName: String?
    let ownerUsername: String?
    let coauthors: [String]
    let hashtags: [String]
    let category: String?
    let city: String?
}

struct Result: Encodable { let url: String; let got: [String]; let auto: Bool }

setvbuf(stdout, nil, _IONBF, 0)
let args = CommandLine.arguments
let cases = try! JSONDecoder().decode([Case].self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
// Apple throttles a burst of searches (about 50 a minute): a pause between cases.
let pause = args.count > 2 ? Double(args[2]) ?? 12 : 12

func find(_ p: Case) async -> (found: [PlaceCandidate], trusted: Bool) {
    var found: [PlaceCandidate] = []
    var trusted = false
    let tagged = p.locationName.flatMap { PlaceSearch.areaOfTag($0) == nil && PlaceSearch.streetOfTag($0) == nil ? $0 : nil }
    var townTag: String?
    if let tag = tagged {
        found = Array(await PlaceSearch.resolveTag(
            tag, ownerFullName: p.ownerFullName, ownerUsername: p.ownerUsername, coauthors: p.coauthors, caption: p.caption,
            hashtags: p.hashtags, cityHints: [], extraQueries: p.city.map { ["\(tag) \($0)"] } ?? []
        ).prefix(5))
        trusted = true
        if !found.isEmpty, found.allSatisfy({ $0.category == .other && PlaceSearch.sameName($0.name, tag) }) {
            found = []
            townTag = tag
        }
    }
    if found.isEmpty {
        var streetPin: CLLocationCoordinate2D?
        if PlaceSearch.streetOfTag(p.locationName) != nil { streetPin = await PlaceSearch.locate(p.locationName!) }
        let r = await PlaceSearch.resolveUntagged(
            caption: p.caption, ownerFullName: p.ownerFullName, ownerUsername: p.ownerUsername, coauthors: p.coauthors,
            town: townTag ?? PlaceSearch.areaOfTag(p.locationName), near: streetPin, hint: townTag == nil ? tagged : nil
        )
        found = r.candidates
        trusted = r.pinned
    }
    if p.kind == "profile" {
        found = PlaceSearch.profileMatches(found, fullName: p.ownerFullName, username: p.ownerUsername, category: p.category)
        trusted = true
    }
    found = PlaceSearch.lifted(found, to: PlaceSearch.languageCountries(caption: p.caption, username: p.ownerUsername))
    return (found, trusted)
}

Task {
    for (i, p) in cases.enumerated() {
        if i > 0 { try? await Task.sleep(for: .seconds(pause)) }
        let (found, trusted) = await find(p)
        let line = Result(url: p.url, got: found.map(\.name), auto: trusted && found.count == 1)
        print(String(data: try! JSONEncoder().encode(line), encoding: .utf8)!)
    }
    exit(0)
}
RunLoop.main.run()
