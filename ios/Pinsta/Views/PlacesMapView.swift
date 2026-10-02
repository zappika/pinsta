import SwiftUI
import MapKit

/// The current Where·What selection on a map, framed to fit it. Pins are the
/// category emoji on a soft type tint (a photo shrunk to 44pt is unreadable).
/// Pins that would overlap on screen group into a count on the tint of their
/// most common type; tap a group to zoom until it splits. Port of the web's
/// PlacesMap: same 44pt rule, no grouping at street level.
struct PlacesMapView: View {
    let places: [Place]
    @Binding var selected: Place?

    @State private var camera: MapCameraPosition = .automatic
    @State private var groups: [PinGroup] = []
    /// Where the map last came to rest; `camera.region` is nil once the user pans or zooms.
    @State private var lastRegion: MKCoordinateRegion?

    /// Pins closer than this on screen are shown as one numbered circle.
    private let clusterPoints: CGFloat = 44
    /// From street level on (span under ~1 km), never group.
    private let noClusterSpan: CLLocationDegrees = 0.01

    struct PinGroup: Identifiable {
        let members: [Place]
        let coordinate: CLLocationCoordinate2D
        var id: String { members.map(\.id.uuidString).joined(separator: ",") }
    }

    var body: some View {
        MapReader { proxy in
            Map(position: $camera, interactionModes: [.pan, .zoom, .rotate]) {
                ForEach(groups.isEmpty ? places.map { PinGroup(members: [$0], coordinate: $0.coordinate) } : groups) { g in
                    if g.members.count == 1, let place = g.members.first {
                        Annotation(place.name, coordinate: place.coordinate, anchor: .center) {
                            pin(place).onTapGesture { select(place) }
                        }
                        .annotationTitles(.automatic)
                    } else {
                        Annotation("\(g.members.count) places", coordinate: g.coordinate, anchor: .center) {
                            groupPin(g).onTapGesture { zoom(to: g.members) }
                        }
                        .annotationTitles(.hidden)
                    }
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .onTapGesture { withAnimation(.snappy) { selected = nil } }
            .onAppear { frame(animated: false) }
            .onChange(of: places.map(\.id)) { _, _ in
                // Pins follow the selection at once; the camera may not move at all
                // (a pin removed from the middle), so don't wait for it to settle.
                if let span = lastRegion?.span { regroup(proxy: proxy, span: span) } else { groups = [] }
                frame(animated: true)
            }
            .onMapCameraChange(frequency: .onEnd) { ctx in
                lastRegion = ctx.region
                regroup(proxy: proxy, span: ctx.region.span)
            }
        }
    }

    // MARK: Grouping

    private func regroup(proxy: MapProxy, span: MKCoordinateSpan) {
        guard span.latitudeDelta > noClusterSpan else {
            groups = places.map { PinGroup(members: [$0], coordinate: $0.coordinate) }
            return
        }
        var buckets: [(point: CGPoint, members: [Place])] = []
        for p in places {
            guard let pt = proxy.convert(p.coordinate, to: .local) else { continue }
            if let i = buckets.firstIndex(where: { hypot($0.point.x - pt.x, $0.point.y - pt.y) < clusterPoints }) {
                buckets[i].members.append(p)
            } else {
                buckets.append((pt, [p]))
            }
        }
        groups = buckets.map { b in
            let first = b.members[0]
            return PinGroup(members: b.members, coordinate: b.members.count == 1 ? first.coordinate : (proxy.convert(b.point, from: .local) ?? first.coordinate))
        }
    }

    private func zoom(to members: [Place]) {
        withAnimation(.easeInOut(duration: 0.5)) { camera = .region(region(fitting: members, minDelta: 0.004)) }
    }

    private func select(_ place: Place) {
        withAnimation(.snappy) {
            selected = place
            // Sit the pin in the upper part so the place sheet doesn't cover it.
            let span = currentSpan ?? MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            let center = CLLocationCoordinate2D(latitude: place.latitude - span.latitudeDelta * 0.22, longitude: place.longitude)
            camera = .region(MKCoordinateRegion(center: center, span: span))
        }
    }

    private var currentSpan: MKCoordinateSpan? { lastRegion?.span ?? camera.region?.span }

    /// Fit every pin, with room for the header above and the controls below.
    /// One place → a neighbourhood, not a dot at max zoom.
    private func frame(animated: Bool) {
        guard !places.isEmpty else { return }
        let r = region(fitting: places, minDelta: 0.012)
        if animated {
            withAnimation(.easeInOut(duration: 0.6)) { camera = .region(r) }
        } else {
            camera = .region(r)
        }
    }

    private func region(fitting ps: [Place], minDelta: CLLocationDegrees) -> MKCoordinateRegion {
        let lats = ps.map(\.latitude), lngs = ps.map(\.longitude)
        let minLat = lats.min()!, maxLat = lats.max()!, minLng = lngs.min()!, maxLng = lngs.max()!
        let latDelta = max((maxLat - minLat) * 1.35, minDelta)
        let lngDelta = max((maxLng - minLng) * 1.25, minDelta)
        return MKCoordinateRegion(
            // Bias south a little: the bottom ~30 % is under the pill and button.
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2 - latDelta * 0.08, longitude: (minLng + maxLng) / 2),
            span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lngDelta)
        )
    }

    // MARK: Pins

    private func pin(_ place: Place) -> some View {
        let active = selected?.id == place.id
        return Text(place.category.emoji)
            .font(.system(size: 20))
            .frame(width: 44, height: 44)
            .background(place.category.tint, in: Circle())
            .overlay(Circle().strokeBorder(active ? Color.primary : Color(.systemBackground), lineWidth: 3))
            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            .scaleEffect(active ? 1.2 : 1)
            .animation(.snappy, value: active)
    }

    private func groupPin(_ g: PinGroup) -> some View {
        let top = Dictionary(grouping: g.members, by: \.category).max { $0.value.count < $1.value.count }?.key ?? .other
        return Text("\(g.members.count)")
            .font(.system(size: 16, weight: .bold).monospacedDigit())
            .foregroundStyle(Color(white: 0.1))
            .frame(width: 44, height: 44)
            .background(top.tint, in: Circle())
            .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 3))
            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
    }
}

extension Place {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
