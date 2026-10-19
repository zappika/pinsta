import SwiftUI
import MapKit

/// The current Where·What selection on a map, framed to fit it. A place saved from a post
/// shows the post's photo, round; one from a list or a Maps link the category icon on its
/// tint, so the map shows how much came from where (Sarp, 2026-10-16, as the web).
/// Pins that would overlap on screen group into a count on the tint of their
/// most common type; tap a group to zoom until it splits. Port of the web's
/// PlacesMap: same 44pt rule, no grouping at street level.
struct PlacesMapView: View {
    let places: [Place]
    @Binding var selected: Place?
    /// What to frame, when not every pin (Everywhere: one country; PlacesListView).
    var focus: [Place]? = nil
    /// Where you are, once location is allowed: the frame takes you in when you're among
    /// the places. The dot itself is the system's live one (`UserAnnotation`), like Google Maps.
    var here: CLLocation? = nil
    /// Bumped by the locate button: frame you (`here`) at town size, whatever the selection.
    var goHere = 0

    /// No frame tighter than this, across: one place or a few on one street show their
    /// neighbourhood, not a street map (Sarp, 2026-10-15, as the web's MIN_FRAME_KM).
    static let minFrameKm: Double = 4.5

    @State private var camera: MapCameraPosition = .automatic
    /// Reduce Motion: the map jumps to a new frame instead of flying there.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var groups: [PinGroup] = []
    /// Where the map last came to rest; `camera.region` is nil once the user pans or zooms.
    @State private var lastRegion: MKCoordinateRegion?

    /// Pins closer than this on screen are shown as one numbered circle.
    private let clusterPoints: CGFloat = 44
    /// From street level on (span under ~1 km), never group.
    private let noClusterSpan: CLLocationDegrees = 0.01
    /// Zoomed out wider than this (about the web's zoom 7), places become one bubble per city,
    /// the Where label, for trip planning (Sarp, 2026-10-19). Tap → that city.
    private let citySpan: CLLocationDegrees = 4.4
    @State private var cities: [CityBubble] = []

    struct CityBubble: Identifiable {
        let name: String
        let members: [Place]
        let coordinate: CLLocationCoordinate2D
        /// Where two touch, the bigger city keeps its name.
        var named = true
        var id: String { name }
    }

    struct PinGroup: Identifiable {
        let members: [Place]
        let coordinate: CLLocationCoordinate2D
        var id: String { members.map(\.id.uuidString).joined(separator: ",") }
    }

    var body: some View {
        MapReader { proxy in
            Map(position: $camera, interactionModes: [.pan, .zoom, .rotate]) {
                UserAnnotation()
                ForEach(cities) { c in
                    Annotation(c.name, coordinate: c.coordinate, anchor: .top) {
                        cityPin(c).onTapGesture { zoom(to: c.members, minKm: Self.minFrameKm) }
                    }
                    .annotationTitles(.hidden)
                }
                ForEach(!cities.isEmpty ? [] : groups.isEmpty ? places.map { PinGroup(members: [$0], coordinate: $0.coordinate) } : groups) { g in
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
            // The live location dot takes the tint; the app's accent is ink, Google's dot is blue.
            .tint(Color(red: 0.10, green: 0.45, blue: 0.91))
            .onTapGesture { withAnimation(.snappy) { selected = nil } }
            .onAppear { frame(animated: false) }
            .onChange(of: focus?.map(\.id)) { _, _ in frame(animated: true) }
            .onChange(of: here != nil) { _, _ in frame(animated: true) }
            .onChange(of: goHere) { _, _ in
                guard let here else { return }
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.6)) { camera = .region(region(fitting: [here.coordinate], minKm: Self.minFrameKm)) }
            }
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
        guard span.longitudeDelta < citySpan else { return cities = cityBubbles(proxy: proxy) }
        cities = []
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

    /// One bubble per Where label, biggest first (web: drawCities).
    private func cityBubbles(proxy: MapProxy) -> [CityBubble] {
        let labels = Grouping.destinationLabels(places)
        let byCity = Dictionary(grouping: places) { labels[$0.id] ?? $0.city ?? $0.country ?? "Elsewhere" }
        var taken: [CGRect] = []
        return byCity.sorted { $0.value.count > $1.value.count }.map { name, members in
            let n = Double(members.count)
            let coord = CLLocationCoordinate2D(latitude: members.map(\.latitude).reduce(0, +) / n,
                                               longitude: members.map(\.longitude).reduce(0, +) / n)
            var bubble = CityBubble(name: name, members: members, coordinate: coord)
            if let pt = proxy.convert(coord, to: .local) {
                let size = Self.citySize(members.count), w = max(size, CGFloat(name.count) * 7.5 + 24)
                let box = CGRect(x: pt.x - w / 2, y: pt.y, width: w, height: size + 20)
                if taken.contains(where: { $0.intersects(box) }) { bubble.named = false } else { taken.append(box) }
            }
            return bubble
        }
    }

    static func citySize(_ count: Int) -> CGFloat { (min(56, 34 + sqrt(Double(count)) * 3)).rounded() }

    private func zoom(to members: [Place], minKm: Double = 0.45) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.9)) { camera = .region(region(fitting: members.map(\.coordinate), minKm: minKm)) }
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
        let framed = (focus?.isEmpty == false ? focus : nil) ?? places
        guard !framed.isEmpty else { return }
        var points = framed.map(\.coordinate)
        // You're among these places: the frame takes you in too, so the dot shows.
        if let here, framed.contains(where: { here.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude)) <= NearMe.km * 1000 }) {
            points.append(here.coordinate)
        }
        let r = region(fitting: points, minKm: Self.minFrameKm)
        if animated {
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.6)) { camera = .region(r) }
        } else {
            camera = .region(r)
        }
    }

    /// `minKm`: the frame is at least this wide and tall.
    private func region(fitting ps: [CLLocationCoordinate2D], minKm: Double) -> MKCoordinateRegion {
        let lats = ps.map(\.latitude), lngs = ps.map(\.longitude)
        let minLat = lats.min()!, maxLat = lats.max()!, minLng = lngs.min()!, maxLng = lngs.max()!
        let minLatDelta = minKm / 111.32
        let minLngDelta = minLatDelta / max(cos((minLat + maxLat) / 2 * .pi / 180), 0.1)
        let latDelta = max((maxLat - minLat) * 1.35, minLatDelta)
        let lngDelta = max((maxLng - minLng) * 1.25, minLngDelta)
        return MKCoordinateRegion(
            // Bias south a little: the bottom ~30 % is under the pill and button.
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2 - latDelta * 0.08, longitude: (minLng + maxLng) / 2),
            span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lngDelta)
        )
    }

    // MARK: Pins

    private func pin(_ place: Place) -> some View {
        let active = selected?.id == place.id
        return Group {
            if Self.fromPost(place) {
                PlacePhoto(place: place, points: 44)
                    .frame(width: 44, height: 44)
                    .background(place.category.tint)
                    .clipShape(Circle())
            } else {
                place.icon.resizable().scaledToFit()
                    .frame(width: 28, height: 28)
                    .frame(width: 44, height: 44)
                    .background(place.category.tint, in: Circle())
            }
        }
            .overlay(Circle().strokeBorder(active ? Color.primary : Color(.systemBackground), lineWidth: 3))
            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            .scaleEffect(active ? 1.2 : 1)
            .animation(.snappy, value: active)
    }

    /// Saved from an Instagram or TikTok post, with its picture; not a list import or a Maps link.
    static func fromPost(_ p: Place) -> Bool {
        p.fromListTitle == nil && p.imageData != nil
            && (p.instagramURL.contains("instagram.com") || p.instagramURL.contains("tiktok.com"))
    }

    /// Up to four of the city's post photos (else its first place's type icon), name and count under it.
    private func cityPin(_ c: CityBubble) -> some View {
        let size = Self.citySize(c.members.count)
        let photos = Array(c.members.filter(Self.fromPost).prefix(4))
        return VStack(spacing: 3) {
            Group {
                if photos.isEmpty, let first = c.members.first {
                    first.icon.resizable().scaledToFit().padding(size * 0.2)
                        .background(first.category.tint)
                } else {
                    mosaic(photos, size: size)
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 2))
            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            if c.named {
                (Text(c.name).bold() + Text(" \(c.members.count)").foregroundStyle(.secondary))
                    .font(.system(size: 12))
                    .lineLimit(1).fixedSize()
                    .shadow(color: Color(.systemBackground), radius: 1.5)
                    .shadow(color: Color(.systemBackground), radius: 1.5)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(c.name), \(c.members.count) places")
        .accessibilityAddTraits(.isButton)
    }

    /// 1 photo whole, 2 side by side, 3 one tall and two stacked, 4 a grid (web .pinsta-mosaic).
    @ViewBuilder
    private func mosaic(_ ps: [Place], size: CGFloat) -> some View {
        let half = (size - 1) / 2
        let photo = { (p: Place, w: CGFloat, h: CGFloat) in PlacePhoto(place: p, points: max(w, h)).frame(width: w, height: h).clipped() }
        HStack(spacing: 1) {
            switch ps.count {
            case 1: photo(ps[0], size, size)
            case 2: photo(ps[0], half, size); photo(ps[1], half, size)
            case 3: photo(ps[0], half, size); VStack(spacing: 1) { photo(ps[1], half, half); photo(ps[2], half, half) }
            default:
                VStack(spacing: 1) { photo(ps[0], half, half); photo(ps[2], half, half) }
                VStack(spacing: 1) { photo(ps[1], half, half); photo(ps[3], half, half) }
            }
        }
        .background(Color.white)
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
