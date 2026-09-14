import SwiftUI
import MapKit

/// The current Where·What selection on a map, framed to fit it. Pins are the
/// post photo, or the category glyph when there is none. Tap a pin → PeekCard.
struct PlacesMapView: View {
    let places: [Place]
    @Binding var selected: Place?

    @State private var camera: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom, .rotate]) {
            ForEach(places) { place in
                Annotation(place.name, coordinate: place.coordinate, anchor: .center) {
                    pin(place)
                        .onTapGesture { select(place) }
                }
                .annotationTitles(.automatic)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .onTapGesture { withAnimation(.snappy) { selected = nil } }
        .onAppear { frame(animated: false) }
        .onChange(of: places.map(\.id)) { _, _ in frame(animated: true) }
    }

    private func select(_ place: Place) {
        withAnimation(.snappy) {
            selected = place
            // Sit the pin in the upper part so the PeekCard doesn't cover it.
            let span = currentSpan ?? MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            let center = CLLocationCoordinate2D(
                latitude: place.latitude - span.latitudeDelta * 0.22,
                longitude: place.longitude
            )
            camera = .region(MKCoordinateRegion(center: center, span: span))
        }
    }

    private var currentSpan: MKCoordinateSpan? { camera.region?.span }

    /// Fit every pin, with room for the header above and the controls below.
    /// One place → a neighbourhood, not a dot at max zoom.
    private func frame(animated: Bool) {
        guard !places.isEmpty else { return }
        let lats = places.map(\.latitude), lngs = places.map(\.longitude)
        let minLat = lats.min()!, maxLat = lats.max()!, minLng = lngs.min()!, maxLng = lngs.max()!
        let latDelta = max((maxLat - minLat) * 1.6, 0.012)
        let lngDelta = max((maxLng - minLng) * 1.4, 0.012)
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                // Bias south a little: the bottom ~30 % is under the pill and button.
                latitude: (minLat + maxLat) / 2 - latDelta * 0.12,
                longitude: (minLng + maxLng) / 2
            ),
            span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lngDelta)
        )
        if animated {
            withAnimation(.easeInOut(duration: 0.6)) { camera = .region(region) }
        } else {
            camera = .region(region)
        }
    }

    private func pin(_ place: Place) -> some View {
        let active = selected?.id == place.id
        return Group {
            if let data = place.imageData, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Color(.systemBackground).overlay {
                    Text(place.category.emoji).font(.system(size: 20))
                }
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(active ? Color.primary : Color(.systemBackground), lineWidth: 2))
        .shadow(color: .black.opacity(0.18), radius: 4, y: 2)
        .scaleEffect(active ? 1.2 : 1)
        .animation(.snappy, value: active)
    }
}

extension Place {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
