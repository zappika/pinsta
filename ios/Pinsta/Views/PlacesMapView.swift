import SwiftUI
import MapKit

/// The current Where·What selection on a map, framed to fit it. Port of the web's PlacesMap
/// "Mix" (Sarp, 2026-10-29): a place saved from a post is loud, its look set by zoom: far out a
/// group is a mosaic of its photos with "N places" beside it, across a city a named dot, closer in
/// its photo with its name; places that would collide stack as one ("Name +N more"). Everything
/// else is quiet: a small dot on its type's tint, the type icon at street level. The look changes
/// mid-pinch when a zoom step is crossed, and new pins fade in. Zoomed out past 7: city bubbles.
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
    /// The look last drawn: crossing into another one mid-pinch redraws at once.
    @State private var lookKey = ""
    @State private var mapWidth: CGFloat = 400

    /// Web zoom levels (MapLibre's), worked out from the span and the map's width.
    static let cityZoom = 7.0
    static let dotsFrom = 12.5
    static let photosFrom = 13.8
    /// From street level on, never group: two entries at one address would never split.
    static let noClusterZoom = 16.0
    /// This few places on screen: everything at full size and named.
    static let roomy = 8
    @State private var cities: [CityBubble] = []

    struct CityBubble: Identifiable {
        let name: String
        let members: [Place]
        let coordinate: CLLocationCoordinate2D
        /// Where two touch, the bigger city keeps its name.
        var named = true
        var id: String { name }
    }

    enum Look: String { case far, mid, close }

    struct PinGroup: Identifiable {
        let members: [Place]
        let coordinate: CLLocationCoordinate2D
        /// Saved from a post (a photo) or not (a dot).
        let loud: Bool
        let look: Look
        let size: CGFloat
        /// At street level (or few places): quiet places show their type icon.
        let street: Bool
        var named = false
        /// The look is part of the id, so a new look makes new views, which fade in.
        var id: String { look.rawValue + ":" + members.map(\.id.uuidString).joined(separator: ",") }
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
                ForEach(cities.isEmpty ? shownGroups : []) { g in
                    Annotation(g.members.count == 1 ? g.members[0].name : "\(g.members.count) places", coordinate: g.coordinate, anchor: .center) {
                        groupView(g).onTapGesture {
                            if g.members.count == 1 { select(g.members[0]) } else { zoom(to: g.members) }
                        }
                    }
                    .annotationTitles(.hidden)
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
                if let lastRegion { regroup(proxy: proxy, region: lastRegion) } else { groups = [] }
                frame(animated: true)
            }
            .onMapCameraChange(frequency: .onEnd) { ctx in
                lastRegion = ctx.region
                regroup(proxy: proxy, region: ctx.region)
            }
            // Live (Sarp, 2026-10-29): mid-pinch, only when a zoom step is crossed, not every frame.
            .onMapCameraChange(frequency: .continuous) { ctx in
                if Self.key(at: zoom(of: ctx.region)) != lookKey { regroup(proxy: proxy, region: ctx.region) }
            }
            .onGeometryChange(for: CGFloat.self, of: { $0.size.width }) { mapWidth = $0 }
        }
    }

    // MARK: Grouping

    /// Before the map has settled once: every place on its own.
    private var shownGroups: [PinGroup] {
        guard groups.isEmpty else { return groups }
        return places.map { PinGroup(members: [$0], coordinate: $0.coordinate, loud: Self.fromPost($0), look: .close, size: 44, street: true) }
    }

    private func zoom(of region: MKCoordinateRegion) -> Double {
        log2(360 * Double(max(mapWidth, 1)) / (256 * max(region.span.longitudeDelta, 0.000_001)))
    }

    private static func look(at z: Double) -> Look { z < dotsFrom ? .far : z < photosFrom ? .mid : .close }
    private static func key(at z: Double) -> String { z < cityZoom ? "cities" : look(at: z).rawValue }

    private static func contains(_ r: MKCoordinateRegion, _ c: CLLocationCoordinate2D) -> Bool {
        abs(c.latitude - r.center.latitude) <= r.span.latitudeDelta / 2
            && abs(c.longitude - r.center.longitude) <= r.span.longitudeDelta / 2
    }

    /// Greedy screen-space grouping, loud and quiet apart (web: draw). Then names, loud first,
    /// each only where it hits no photo and no name already placed.
    private func regroup(proxy: MapProxy, region: MKCoordinateRegion) {
        let z = zoom(of: region)
        lookKey = Self.key(at: z)
        guard z >= Self.cityZoom else {
            groups = []
            cities = cityBubbles(proxy: proxy)
            return
        }
        cities = []
        let look = Self.look(at: z)
        let roomy = places.filter { Self.contains(region, $0.coordinate) }.count <= Self.roomy
        let street = roomy || z >= Self.noClusterZoom
        let photoSize: CGFloat = street ? 44 : z < 13.5 ? 30 : 36
        let loudSize: CGFloat = look == .mid ? 10 : photoSize
        let quietSize: CGFloat = street ? 32 : 12

        var buckets: [(point: CGPoint, members: [Place], loud: Bool)] = []
        for p in places {
            guard let pt = proxy.convert(p.coordinate, to: .local) else { continue }
            let loud = Self.fromPost(p)
            // Past the mosaic, places whose names would collide become one "Name +N more".
            let near: CGFloat = !loud ? max(quietSize - 2, 8) : look == .far ? loudSize + 2 : look == .mid ? 22 : loudSize * 1.3
            if z < Self.noClusterZoom,
               let i = buckets.firstIndex(where: { $0.loud == loud && hypot($0.point.x - pt.x, $0.point.y - pt.y) < near }) {
                buckets[i].members.append(p)
            } else {
                buckets.append((pt, [p], loud))
            }
        }

        var taken: [CGRect] = []
        var made: [(group: PinGroup, point: CGPoint)] = buckets.map { b in
            let many = b.members.count > 1
            let size: CGFloat = b.loud ? (many && look == .far ? max(loudSize, 40) : loudSize) : (many && !street ? 16 : quietSize)
            let coord = many ? (proxy.convert(b.point, from: .local) ?? b.members[0].coordinate) : b.members[0].coordinate
            let g = PinGroup(members: b.members, coordinate: coord, loud: b.loud, look: look, size: size, street: street)
            if b.loud {
                let reach = CGFloat(Self.behind(g)) * 8
                // A mosaic's "N places" always shows: it takes its room too.
                let extra: CGFloat = many && look == .far ? 75 : 0
                taken.append(CGRect(x: b.point.x - size / 2, y: b.point.y - size / 2, width: size + reach + extra, height: size))
            }
            return (g, b.point)
        }
        let order = made.indices.sorted { made[$0].group.loud && !made[$1].group.loud }
        for i in order {
            let g = made[i].group, pt = made[i].point
            let many = g.members.count > 1
            let wants = g.loud ? (look != .far || roomy) && !(many && look == .far) : !many && (roomy || z >= 14.5)
            guard wants else { continue }
            let name = g.members[0].name
            let w = CGFloat(name.count) * (g.loud ? 7.2 : 6.4) + 4
            let h: CGFloat = many ? 32 : 18
            let box = CGRect(x: pt.x + g.size / 2 + 3 + CGFloat(Self.behind(g)) * 8, y: pt.y - h / 2, width: w, height: h)
            if taken.contains(where: { $0.intersects(box) }) { continue }
            taken.append(box)
            made[i].group.named = true
        }
        groups = made.map(\.group)
    }

    /// How many photos peek out behind a stack (close in only).
    private static func behind(_ g: PinGroup) -> Int {
        g.loud && g.look == .close ? min(g.members.count - 1, 2) : 0
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

    private func groupView(_ g: PinGroup) -> some View {
        let n = g.members.count, first = g.members[0]
        let behind = Self.behind(g)
        let peeking = Array(g.members.dropFirst().prefix(behind).enumerated().reversed())
        return ZStack {
            if !g.loud {
                quietPin(g)
            } else if g.look == .mid {
                Circle().fill(Color.primary)
                    .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 1.5))
                    .scaleEffect(n == 1 && selected?.id == first.id ? 1.6 : 1)
            } else if n > 1 && g.look == .far {
                mosaic(Array(g.members.prefix(4)), size: g.size)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 2))
                    .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            } else {
                ForEach(peeking, id: \.offset) { item in
                    photoCircle(item.element, size: g.size, active: false)
                        .offset(x: CGFloat(item.offset + 1) * 8, y: -CGFloat(item.offset + 1) * 6)
                }
                photoCircle(first, size: g.size, active: n == 1 && selected?.id == first.id)
            }
        }
        .frame(width: g.size, height: g.size)
        .overlay(alignment: .leading) {
            pinLabel(g).fixedSize().offset(x: g.size + 5 + CGFloat(behind) * 8)
        }
        .modifier(FadeIn())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(n == 1 ? first.name : "\(first.name) and \(n - 1) more")
        .accessibilityAddTraits(.isButton)
    }

    private func photoCircle(_ p: Place, size: CGFloat, active: Bool) -> some View {
        PlacePhoto(place: p, points: size)
            .frame(width: size, height: size)
            .background(p.category.tint)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 2))
            .shadow(color: .black.opacity(active ? 0.35 : 0.2), radius: active ? 8 : 4, y: 2)
            .scaleEffect(active ? 1.25 : 1)
            .animation(.snappy, value: active)
    }

    /// A tinted dot (deeper than the pastel, which vanished on the grey map), the type icon at street level.
    @ViewBuilder
    private func quietPin(_ g: PinGroup) -> some View {
        let first = g.members[0]
        let top = Dictionary(grouping: g.members, by: \.category).max { $0.value.count < $1.value.count }?.key ?? first.category
        let active = g.members.count == 1 && selected?.id == first.id
        if g.street && g.members.count == 1 {
            first.icon.resizable().scaledToFit()
                .padding(g.size * 0.18)
                .background(first.category.tint, in: Circle())
                .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 1.5))
                .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
                .scaleEffect(active ? 1.25 : 1)
        } else if g.street {
            Text("\(g.members.count)")
                .font(.system(size: 11, weight: .bold).monospacedDigit())
                .foregroundStyle(Color(white: 0.1))
                .frame(width: g.size, height: g.size)
                .background(top.tint, in: Circle())
                .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 1.5))
        } else {
            Circle().fill(top.tint)
                .overlay(Circle().fill(Color.black.opacity(0.2)))
                .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 1.5))
                .shadow(color: top.tint, radius: 4)
                .scaleEffect(active ? 1.6 : 1)
        }
    }

    /// Beside the pin: "N places" by a mosaic, else the name (and "+N more") where it fits.
    @ViewBuilder
    private func pinLabel(_ g: PinGroup) -> some View {
        let n = g.members.count
        if g.loud && n > 1 && g.look == .far {
            Text("\(n) places").font(.system(size: 13, weight: .semibold)).halo()
        } else if g.named {
            VStack(alignment: .leading, spacing: 0) {
                Text(g.members[0].name)
                    .font(.system(size: g.loud ? 13 : 11.5, weight: g.loud ? .semibold : .medium))
                    .foregroundStyle(g.loud ? Color.primary : Color.secondary)
                if n > 1 {
                    Text("+\(n - 1) more").font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
                }
            }
            .lineLimit(1)
            .halo()
        }
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

}

/// New pins (a new look, a new group) fade in instead of popping (web: .pinsta-appear).
private struct FadeIn: ViewModifier {
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown || reduceMotion ? 1 : 0)
            .onAppear { withAnimation(.easeOut(duration: 0.22)) { shown = true } }
    }
}

private extension View {
    /// A label on the map: a soft outline in the background colour, so it reads on any tile.
    func halo() -> some View {
        shadow(color: Color(.systemBackground), radius: 1.5).shadow(color: Color(.systemBackground), radius: 1.5)
    }
}

extension Place {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
