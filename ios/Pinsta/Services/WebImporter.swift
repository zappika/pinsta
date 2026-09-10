import Foundation
import SwiftData

/// One-shot seed from the web app's database so the native app starts with
/// the same list. Runs once, when the local store is empty.
enum WebImporter {
    private struct Row: Decodable {
        let id: UUID
        let instagramUrl: String
        let name: String
        let placeId: String
        let lat: Double
        let lng: Double
        let formattedAddress: String?
        let country: String?
        let city: String?
        let category: String?
        let createdAt: Date
        let imageUrl: String?
        let caption: String?
        let igLocationName: String?
        let ownerUsername: String?
    }

    private struct Envelope: Decodable { let places: [Row] }

    @MainActor
    static func runIfEmpty(in context: ModelContext) async {
        let count = (try? context.fetchCount(FetchDescriptor<Place>())) ?? 0
        guard count == 0 else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: PostReader.baseURL.appending(path: "api/places"))
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
            let rows = try decoder.decode(Envelope.self, from: data).places
            for row in rows {
                let image = await ImageLoader.data(from: row.imageUrl)
                context.insert(Place(
                    id: row.id,
                    instagramURL: row.instagramUrl,
                    name: row.name,
                    latitude: row.lat,
                    longitude: row.lng,
                    address: row.formattedAddress,
                    city: row.city,
                    country: row.country,
                    category: PlaceCategory(rawValue: row.category ?? "") ?? .other,
                    caption: row.caption,
                    ownerUsername: row.ownerUsername,
                    igLocationName: row.igLocationName,
                    imageData: image,
                    createdAt: row.createdAt,
                    googlePlaceID: row.placeId
                ))
            }
            try context.save()
        } catch {
            print("Web import failed: \(error)")
        }
    }
}

extension JSONDecoder.DateDecodingStrategy {
    /// Postgres timestamps come back like 2026-09-10T11:32:07.123Z.
    static var iso8601WithFractionalSeconds: JSONDecoder.DateDecodingStrategy {
        .custom { decoder in
            let string = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: string) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(in: try decoder.singleValueContainer(), debugDescription: "Bad date \(string)")
        }
    }
}
