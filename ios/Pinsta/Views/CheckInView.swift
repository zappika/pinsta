import SwiftUI
import SwiftData
import PhotosUI
import CoreLocation

/// I'm here (Sarp, 2026-11-20, after Italy: "I'm in a bar I really like, I should check in so I
/// remember this"). Swarm-fast: the places around you with their type icons, the likeliest one
/// big on top, one tap and it's a visit. A face, your photo and a note come after, all optional.
/// Opened with a place (`arrived`), it's "You made it": a saved place you're standing in, with the
/// post you saved it from.
struct CheckInView: View {
    var arrived: Place? = nil
    let locate: () async -> CLLocation?
    let onClose: () -> Void

    @Environment(\.modelContext) private var context
    @Query private var places: [Place]

    private enum Phase { case arrived(Place), locating, list([Row]), failed(String), done(Place, Visit) }
    @State private var phase: Phase = .locating
    @State private var fix: CLLocation?
    @State private var query = ""
    @State private var searched: [PlaceCandidate] = []
    @State private var busy = false

    /// A place around you: one already in the list, or one Apple knows.
    struct Row: Identifiable {
        var saved: Place?
        var candidate: PlaceCandidate?
        var meters: Double
        var id: String { saved.map { $0.id.uuidString } ?? candidate?.id ?? UUID().uuidString }
        var name: String { saved?.name ?? candidate?.name ?? "" }
        var category: PlaceCategory { saved?.category ?? candidate?.category ?? .other }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            switch phase {
            case .arrived(let p): ArrivedCard(place: p, onHere: { checkIn(saved: p) }, onLater: onClose)
            case .locating: header("Finding where you are…"); LoadingRows()
            case .failed(let why): header("I'm here"); Text(why).font(.subheadline).foregroundStyle(.secondary).padding(.horizontal, 20).padding(.bottom, 20)
            case .list(let rows): list(rows)
            case .done(let p, let v): VisitDone(place: p, visit: v, onDone: onClose)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .task { await start() }
    }

    private func header(_ title: String) -> some View {
        Text(title)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 10)
    }

    // MARK: The list

    @ViewBuilder
    private func list(_ rows: [Row]) -> some View {
        header(rows.isEmpty ? "Nothing found right around you" : "Where are you?")
        ScrollView {
            VStack(spacing: 0) {
                if let first = rows.first, searched.isEmpty {
                    likeliest(first)
                    ForEach(rows.dropFirst()) { r in
                        Divider().padding(.leading, 72)
                        row(r)
                    }
                }
                ForEach(searched) { c in
                    row(Row(candidate: c, meters: distance(c.latitude, c.longitude)))
                    Divider().padding(.leading, 72)
                }
            }
        }
        .frame(maxHeight: 420)
        .fixedSize(horizontal: false, vertical: true)
        TextField("Not here? Type its name", text: $query)
            .autocorrectionDisabled()
            .submitLabel(.search)
            .onSubmit { Task { await search() } }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            .padding(16)
            .onChange(of: query) { _, q in if q.isEmpty { searched = [] } }
    }

    /// The nearest place, big, with its own button: most of the time it's the one.
    private func likeliest(_ r: Row) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                icon(r, size: 56)
                VStack(alignment: .leading, spacing: 3) {
                    Text(r.name).font(.title3.weight(.semibold)).lineLimit(2)
                    Text(subtitle(r)).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            Button { pick(r) } label: {
                Text(busy ? "Checking in…" : "I'm here")
                    .font(.headline)
                    .foregroundStyle(Color(.systemBackground))
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Color.primary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(busy)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 14)
    }

    private func row(_ r: Row) -> some View {
        Button { pick(r) } label: {
            HStack(spacing: 12) {
                icon(r, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(r.name).font(.body.weight(.medium)).lineLimit(1)
                    Text(subtitle(r)).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }

    /// The type's 3D icon on its tint, as on the map: recognised, not read. A saved place shows its photo.
    @ViewBuilder
    private func icon(_ r: Row, size: CGFloat) -> some View {
        if let p = r.saved, p.imageData != nil {
            PlacePhoto(place: p, points: size).frame(width: size, height: size).clipShape(Circle())
        } else {
            (r.saved?.icon ?? r.category.icon)
                .resizable().scaledToFit()
                .frame(width: size * 0.62, height: size * 0.62)
                .frame(width: size, height: size)
                .background(r.category.tint, in: Circle())
        }
    }

    private func subtitle(_ r: Row) -> String {
        let away = r.meters < 20 ? "Right here" : "\(Int((r.meters / 10).rounded() * 10)) m"
        if let p = r.saved {
            let visits = p.visitCount
            return [visits > 0 ? "Been \(visits == 1 ? "once" : "\(visits) times")" : "Saved", away].joined(separator: " · ")
        }
        return [r.category.rawValue, away].joined(separator: " · ")
    }

    // MARK: Actions

    private func start() async {
        if let arrived { phase = .arrived(arrived); return }
        guard let here = await locate() else {
            phase = .failed("Location is off for Vicolo. Turn it on in Settings → Vicolo → Location.")
            return
        }
        fix = here
        let around = await PlaceSearch.around(here.coordinate, meters: 150, limit: 8)
        let mine = places
            .map { (p: $0, m: distance($0.latitude, $0.longitude)) }
            .filter { $0.m <= 150 }
            .sorted { $0.m < $1.m }
        // Yours first: a saved place you're standing in is the likeliest of all.
        var rows = mine.map { Row(saved: $0.p, meters: $0.m) }
        for c in around where !mine.contains(where: { SamePlace.matches($0.p, name: c.name, latitude: c.latitude, longitude: c.longitude) }) {
            rows.append(Row(candidate: c, meters: distance(c.latitude, c.longitude)))
        }
        // A saved place counts as nearest unless an unsaved one is clearly closer.
        rows.sort { a, b in
            let ma = a.saved != nil ? a.meters - 40 : a.meters
            let mb = b.saved != nil ? b.meters - 40 : b.meters
            return ma < mb
        }
        phase = .list(rows)
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { return }
        searched = (try? await PlaceSearch.search(q, limit: 6, near: fix?.coordinate))?.filter { PlaceSearch.isVenue($0, asked: q) } ?? []
    }

    private func distance(_ lat: Double, _ lng: Double) -> Double {
        guard let fix else { return 0 }
        return fix.distance(from: CLLocation(latitude: lat, longitude: lng))
    }

    private func pick(_ r: Row) {
        if let p = r.saved { checkIn(saved: p) } else if let c = r.candidate { checkIn(new: c) }
    }

    private func checkIn(saved p: Place) {
        let v = p.checkIn()
        finish(p, v)
    }

    /// Not in the list yet: saved and checked into at once. A Maps link stands in for a post, as for a typed name.
    private func checkIn(new c: PlaceCandidate) {
        guard !busy else { return }
        busy = true
        let all = (try? context.fetch(FetchDescriptor<Place>())) ?? []
        if let same = all.first(where: { SamePlace.matches($0, name: c.name, latitude: c.latitude, longitude: c.longitude) }) {
            busy = false
            return checkIn(saved: same)
        }
        let p = Place(instagramURL: AddPlaceView.mapsLink(c), name: c.name, latitude: c.latitude, longitude: c.longitude,
                      address: c.address, city: c.city, region: c.region, country: c.country, category: c.category)
        p.website = c.website
        p.subtypeRaw = c.subtype
        p.savedNearby = true
        context.insert(p)
        let v = p.checkIn()
        finish(p, v)
        Task { await PriceLookup.check(p, in: context) }
        Task { await EnglishNames.check(p, in: context) }
        busy = false
    }

    private func finish(_ p: Place, _ v: Visit) {
        try? context.save()
        Uses.count("checkin")
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        withAnimation(.snappy) { phase = .done(p, v) }
    }
}

/// "You made it": a saved place you're standing in, with why you saved it. The caption often
/// says what to order, which is the useful thing right now.
private struct ArrivedCard: View {
    let place: Place
    let onHere: () -> Void
    let onLater: () -> Void
    @State private var more = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if place.imageData != nil {
                PlacePhoto(place: place, points: 420).frame(height: 200).frame(maxWidth: .infinity)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("You made it").font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                Text(place.name).font(.title2.weight(.semibold))
                Text(WhyHere.line(for: place)).font(.subheadline).foregroundStyle(.secondary)
                if let caption = place.caption?.trimmingCharacters(in: .whitespacesAndNewlines), !caption.isEmpty {
                    Text(caption)
                        .font(.subheadline)
                        .lineLimit(more ? 12 : 4)
                        .padding(.top, 6)
                        .onTapGesture { withAnimation(.snappy) { more.toggle() } }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            HStack(spacing: 10) {
                Button(action: onLater) {
                    Text("Not now")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                Button(action: onHere) {
                    Text("I'm here")
                        .font(.headline)
                        .foregroundStyle(Color(.systemBackground))
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color.primary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .buttonStyle(.plain)
            .padding(16)
        }
    }
}

/// Checked in: the visit's count, then a face, your photo and a line, each optional.
private struct VisitDone: View {
    let place: Place
    @State var visit: Visit
    let onDone: () -> Void
    @Environment(\.modelContext) private var context
    @State private var picked: PhotosPickerItem?
    @State private var camera = false
    @State private var note = ""
    @FocusState private var writing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.name).font(.headline).lineLimit(1)
                    Text(countLine).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 18)

            Text("How is it?").font(.subheadline).foregroundStyle(.secondary).padding(.horizontal, 16).padding(.top, 18).padding(.bottom, 8)
            HStack(spacing: 8) {
                ForEach(1...3, id: \.self) { kind in
                    let on = visit.rating == kind
                    Button {
                        visit.rating = on ? nil : kind
                        keep()
                    } label: {
                        FaceView(kind: kind, size: 28)
                            .foregroundStyle(on ? Color(.systemBackground) : .primary)
                            .frame(maxWidth: .infinity, minHeight: 56)
                            .background(on ? AnyShapeStyle(Color.primary) : AnyShapeStyle(Color(.tertiarySystemFill)), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(FaceView.labels[kind - 1])
                }
            }
            .padding(.horizontal, 16)

            photos.padding(.horizontal, 16).padding(.top, 12)

            TextField("A note for next time", text: $note, axis: .vertical)
                .lineLimit(1...3)
                .focused($writing)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16).padding(.top, 12)

            Button {
                saveNote()
                onDone()
            } label: {
                Text("Done")
                    .font(.headline)
                    .foregroundStyle(Color(.systemBackground))
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Color.primary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(16)
        }
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) { addPhoto(data) }
                picked = nil
            }
        }
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { data in if let data { addPhoto(data) } }
                .ignoresSafeArea()
        }
    }

    /// "First visit", "2nd visit · last time 12 Oct".
    private var countLine: String {
        let n = place.visitCount
        // "Saved to Vicolo" only for a place this check-in added; a saved one was already there.
        guard n > 1 else { return place.createdAt.timeIntervalSinceNow > -30 ? "First visit. Saved to Vicolo." : "First visit." }
        let before = place.visits.dropLast().last?.at
        let ordinal = NumberFormatter.localizedString(from: NSNumber(value: n), number: .ordinal)
        return before.map { "\(ordinal) visit · last time \($0.formatted(.dateTime.day().month(.abbreviated)))" } ?? "\(ordinal) visit"
    }

    @ViewBuilder
    private var photos: some View {
        HStack(spacing: 8) {
            ForEach(visit.photos, id: \.self) { name in
                VisitPhotoView(name: name, size: 56)
            }
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button { camera = true } label: { tile("camera", "Camera") }.buttonStyle(.plain)
            }
            PhotosPicker(selection: $picked, matching: .images, preferredItemEncoding: .compatible) { tile("photo.on.rectangle", "Photos") }
                .buttonStyle(.plain)
            Spacer(minLength: 0)
        }
    }

    private func tile(_ symbol: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: symbol).font(.system(size: 17, weight: .medium))
            Text(label).font(.caption2)
        }
        .foregroundStyle(.primary)
        .frame(width: 64, height: 56)
        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityLabel("Add a photo from \(label)")
    }

    private func addPhoto(_ data: Data) {
        place.addVisitPhoto(data, to: visit.id)
        if let saved = place.visits.first(where: { $0.id == visit.id }) { visit = saved }
        try? context.save()
    }

    private func saveNote() {
        let t = note.trimmingCharacters(in: .whitespacesAndNewlines)
        visit.note = t.isEmpty ? nil : t
        keep()
    }

    private func keep() {
        // Photos are added on the place directly; keep them when the face or note changes.
        if let saved = place.visits.first(where: { $0.id == visit.id }) { visit.photos = saved.photos }
        place.update(visit)
        try? context.save()
    }
}

/// One of your photos, read from its file once and downsampled.
struct VisitPhotoView: View {
    let name: String
    let size: CGFloat
    @State private var image: UIImage?
    @Environment(\.displayScale) private var scale

    var body: some View {
        Color(.tertiarySystemFill)
            .overlay { if let image { Image(uiImage: image).resizable().scaledToFill().allowsHitTesting(false) } }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .task(id: name) {
                let px = size * scale
                image = await Task.detached {
                    guard let url = VisitPhotos.url(name),
                          let src = CGImageSourceCreateWithURL(url as CFURL, nil),
                          let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, [
                            kCGImageSourceCreateThumbnailFromImageAlways: true,
                            kCGImageSourceThumbnailMaxPixelSize: px,
                            kCGImageSourceCreateThumbnailWithTransform: true,
                          ] as CFDictionary) else { return nil }
                    return UIImage(cgImage: cg)
                }.value
            }
    }
}

/// The camera, for a photo of where you are. UIKit's picker: SwiftUI has none.
struct CameraPicker: UIViewControllerRepresentable {
    let onPicked: (Data?) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = info[.originalImage] as? UIImage
            parent.onPicked(image?.jpegData(compressionQuality: 0.9))
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.onPicked(nil)
            parent.dismiss()
        }
    }
}

/// Grey rows while the location and the places around come in.
private struct LoadingRows: View {
    var body: some View {
        VStack(spacing: 14) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: 12) {
                    Circle().fill(Color(.tertiarySystemFill)).frame(width: 44, height: 44)
                    RoundedRectangle(cornerRadius: 6).fill(Color(.tertiarySystemFill)).frame(height: 14)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 20)
        .redacted(reason: .placeholder)
    }
}
