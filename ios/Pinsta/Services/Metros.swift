import Foundation

/// Big cities whose neighbourhoods come back as the "town", a port of the web's
/// `lib/metros.ts` (same list, same radii).
///
/// MapKit says "Beyoğlu" for a restaurant in Istanbul and "Nordhavn" (a Danish
/// postal district) for one in Copenhagen. Nobody says that to a friend. A place
/// within a metro's radius is filed under the metro's name in the Where menu
/// only; the card keeps the saved town. Coordinates, not names, so it also
/// fixes places already saved.
enum Metros {
    struct Metro { let name: String; let lat: Double; let lng: Double; let km: Double }

    static let all: [Metro] = [
        Metro(name: "Istanbul", lat: 41.015, lng: 28.98, km: 30),
        Metro(name: "Copenhagen", lat: 55.676, lng: 12.568, km: 9),
        Metro(name: "Stockholm", lat: 59.329, lng: 18.069, km: 10),
        Metro(name: "Oslo", lat: 59.913, lng: 10.752, km: 9),
        Metro(name: "Helsinki", lat: 60.17, lng: 24.94, km: 10),
        Metro(name: "London", lat: 51.507, lng: -0.128, km: 20),
        Metro(name: "Paris", lat: 48.857, lng: 2.352, km: 9),
        Metro(name: "Berlin", lat: 52.52, lng: 13.405, km: 18),
        Metro(name: "Amsterdam", lat: 52.373, lng: 4.893, km: 9),
        Metro(name: "Barcelona", lat: 41.389, lng: 2.165, km: 7),
        Metro(name: "Girona", lat: 41.98, lng: 2.82, km: 4),
        Metro(name: "Madrid", lat: 40.417, lng: -3.704, km: 12),
        Metro(name: "Lisbon", lat: 38.722, lng: -9.139, km: 8),
        Metro(name: "Rome", lat: 41.893, lng: 12.483, km: 12),
        Metro(name: "Milan", lat: 45.464, lng: 9.19, km: 9),
        Metro(name: "Vienna", lat: 48.208, lng: 16.373, km: 12),
        Metro(name: "Prague", lat: 50.075, lng: 14.437, km: 11),
        Metro(name: "Budapest", lat: 47.498, lng: 19.04, km: 12),
        Metro(name: "Athens", lat: 37.984, lng: 23.728, km: 10),
        Metro(name: "Mexico City", lat: 19.433, lng: -99.133, km: 18),
        Metro(name: "New York", lat: 40.73, lng: -73.99, km: 18),
        Metro(name: "Los Angeles", lat: 34.052, lng: -118.244, km: 25),
        Metro(name: "San Francisco", lat: 37.775, lng: -122.419, km: 8),
        Metro(name: "Tokyo", lat: 35.681, lng: 139.767, km: 22),
        Metro(name: "Seoul", lat: 37.566, lng: 126.978, km: 18),
        Metro(name: "Bangkok", lat: 13.756, lng: 100.502, km: 18),
        Metro(name: "Buenos Aires", lat: -34.604, lng: -58.382, km: 14),
    ]

    /// Travel areas: what you'd say for a place outside a city ("Costa Brava", not "Begur" or
    /// the province "Girona"). Sarp, 2026-10-09. Filed under in the Where menu even when the
    /// village has several places; cities come first. First circle that holds a point wins.
    /// Same list as `AREAS` in lib/metros.ts.
    static let areas: [Metro] = [
        // Catalonia
        Metro(name: "Costa Brava", lat: 42.07, lng: 3.07, km: 38),
        Metro(name: "Priorat", lat: 41.17, lng: 0.8, km: 15),
        Metro(name: "Penedès", lat: 41.33, lng: 1.75, km: 20),
        Metro(name: "Maresme", lat: 41.55, lng: 2.45, km: 18),
        // France
        Metro(name: "Roussillon", lat: 42.62, lng: 2.85, km: 30),
        Metro(name: "Côte d'Azur", lat: 43.62, lng: 7.1, km: 40),
        Metro(name: "Provence", lat: 43.85, lng: 5.2, km: 45),
        // Italy
        Metro(name: "Amalfi Coast", lat: 40.63, lng: 14.55, km: 18),
        Metro(name: "Cinque Terre", lat: 44.12, lng: 9.71, km: 10),
        Metro(name: "Langhe", lat: 44.6, lng: 8.0, km: 22),
    ]

    /// The travel area a point lies in, or nil.
    static func area(lat: Double, lng: Double) -> String? {
        areas.first { km(lat, lng, $0.lat, $0.lng) <= $0.km }?.name
    }

    /// The metro a point lies in, the nearest one if radii overlap.
    static func at(lat: Double, lng: Double) -> String? {
        all.map { ($0, km(lat, lng, $0.lat, $0.lng)) }
            .filter { $0.1 <= $0.0.km }
            .min { $0.1 < $1.1 }?.0.name
    }

    private static func km(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
        let rad = Double.pi / 180
        let a = pow(sin((lat2 - lat1) * rad / 2), 2)
            + cos(lat1 * rad) * cos(lat2 * rad) * pow(sin((lng2 - lng1) * rad / 2), 2)
        return 12742 * asin(sqrt(a))
    }
}
