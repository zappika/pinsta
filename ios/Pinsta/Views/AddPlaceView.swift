import SwiftUI
import SwiftData
import MapKit

/// A small sheet that fits what it shows (the /success sandbox, Sarp 2026-10-10). Paste a link → the post is read (cloud) → the
/// tag becomes a place (MapKit, on device). One match saves itself; several ask
/// for a tap; none falls back to the account that posted, then to search.
/// In edit mode the post is known and only the place changes.
struct AddPlaceView: View {
    /// Above this the list scrolls.
    static let maxScroll: CGFloat = 380
    /// The success card is taller: the post photo at 4:5.
    static let savedHeight: CGFloat = 460
    static let savedSeconds: Double = 2.6

    /// Pre-filled link (the share extension passes the shared URL).
    var initialURL: String? = nil
    /// Re-selecting the place behind an existing card.
    var editing: Place? = nil
    /// Called when the sheet is done; the share extension completes its request here.
    var onFinish: (() -> Void)? = nil
    /// Extensions can't read the general pasteboard.
    var allowsPasteboard = true

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var urlText = ""
    @State private var reading: Reading = .idle
    @State private var source: Source? = nil
    @State private var query = ""
    @State private var candidates: [PlaceCandidate] = []
    @State private var searching = false
    @State private var saving: String?
    @State private var saved: Saved?
    @State private var error: String?
    /// Between reading the post and having candidates: the steps stay on screen.
    @State private var finding = false
    @State private var readStarted = Date()
    /// The post's picture, fetched while the place is being found: the success card opens with it.
    @State private var postImage: Data?
    @FocusState private var focus: Field?

    private enum Field { case url, query }
    private enum Source { case tag, account, link }
    fileprivate struct Saved {
        let place: Place; let already: Bool; let changed: Bool
        /// The post was added to a place already in the list, not saved as a new one.
        var mergedURL: String? = nil
        var milestone: String? = nil
        /// The post's picture, until the place's own copy has downloaded.
        var imageURL: String? = nil
        /// Decoded before the card shows, so it never opens on the type icon and then jumps.
        var image: UIImage? = nil
    }
    private enum Reading: Equatable {
        case idle, loading, done(InstagramPost), failed(String)
        static func == (a: Reading, b: Reading) -> Bool {
            switch (a, b) {
            case (.idle, .idle), (.loading, .loading): return true
            case let (.done(x), .done(y)): return x.url == y.url
            case let (.failed(x), .failed(y)): return x == y
            default: return false
            }
        }
    }

    private var validURL: String? { editing?.instagramURL ?? SourceURL.parse(urlText)?.url }
    private var post: InstagramPost? { if case .done(let p) = reading { return p } else { return nil } }
    private var showSuggestedFirst: Bool { !candidates.isEmpty && source != nil && query.trimmed.count < 2 }
    private var manualMode: Bool {
        if case .failed = reading { return true }
        if case .done = reading, source == nil { return true }
        return false
    }

    private var showQuery: Bool { validURL != nil && reading != .loading && reading != .idle && !finding && saving == nil }

    /// The sheet's question lives in its small label (Sarp, 2026-10-09): no headings.
    private var label: String {
        if editing != nil { return "Change place" }
        if validURL == nil { return "Save a place" }
        if reading == .loading || finding { return "Finding the place…" }
        if saving != nil { return "Saving…" }
        if showSuggestedFirst { return candidates.count == 1 ? "Is this the place?" : "Is it one of these?" }
        return "Which place is it?"
    }

    var body: some View {
        VStack(spacing: 0) {
            if let saved {
                SavedCard(saved: saved, onDone: finish)
                    .transition(.opacity)
                    .task(id: saved.place.id) {
                        try? await Task.sleep(for: .seconds(Self.savedSeconds))
                        guard !Task.isCancelled else { return }
                        finish()
                    }
            } else {
              VStack(spacing: 0) {
                HStack {
                    sectionLabel(label)
                    Spacer()
                    Button("Cancel") { finish() }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 8)

                // Sized in the same layout pass as its content, so the sheet and what's in it
                // move together (a measured height lagged a frame: Sarp saw it jump, 2026-10-10).
                // Scrolls only past the cap.
                CappedHeight(max: Self.maxScroll) {
                    ScrollView { form }
                        .scrollBounceBehavior(.basedOnSize)
                        .scrollDismissesKeyboard(.interactively)
                }
                // The search sits pinned under the list, never below the scroll (Sarp, 2026-10-09);
                // one place for it, so typing never moves it (and its focus) elsewhere.
                if showQuery {
                    queryField.padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 16)
                }
              }
              .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: saved == nil ? nil : Self.savedHeight)
        // Raised surface: white in light, the elevated grey in dark (never pure black on black).
        .background(saved == nil ? Color(.secondarySystemGroupedBackground) : .clear)
        // Every step (finding → the question → saved) resizes the sheet in one animation.
        .animation(.snappy, value: step)
        .onAppear {
            if let editing {
                reading = .done(InstagramPost(
                    url: editing.instagramURL, caption: editing.caption, locationName: editing.igLocationName,
                    imageURL: nil, ownerUsername: editing.ownerUsername, ownerFullName: nil, hashtags: []
                ))
                query = editing.igLocationName ?? editing.name
                focus = .query
                return
            }
            if let initialURL {
                urlText = initialURL
                return
            }
        }
        .task {
            // Same as the web: the field starts empty and Paste is a deliberate tap.
            // (Reading the pasteboard here would also raise the system paste prompt.)
            // Focus once the sheet has risen: the keyboard rising during the slide
            // made the sheet jump.
            guard editing == nil, initialURL == nil else { return }
            try? await Task.sleep(for: .milliseconds(350))
            focus = .url
        }
        .task(id: validURL) { if editing == nil { await readPost() } }
        .task(id: query) { await manualSearch() }
    }

    /// What changes the sheet's size: one value, so each change animates once.
    private var step: String {
        [label, candidates.map(\.id).joined(separator: ","), saving ?? "", error ?? "",
         saved.map { $0.place.id.uuidString } ?? "", showQuery ? "q" : "", finding ? "f" : ""].joined(separator: "|")
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 12) {
            // A shared link is already known: the field would only look like a task (Sarp, 2026-10-09).
            if editing == nil, initialURL == nil { urlField }
            postSection
            if showSuggestedFirst && saving == nil { suggested }
            if let error {
                Text(error).font(.subheadline).foregroundStyle(.red)
            }
            if !showSuggestedFirst { candidateList }
            footnotes
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16).padding(.bottom, 16)
    }

    // MARK: Sections

    private var urlField: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                TextField("Instagram, TikTok or Maps link", text: $urlText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .focused($focus, equals: .url)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(!urlText.isEmpty && validURL == nil ? Color.red.opacity(0.5) : Color.clear)
                    )
                if urlText.isEmpty && allowsPasteboard {
                    // The system paste control reads the pasteboard without the permission prompt.
                    PasteButton(payloadType: String.self) { strings in
                        if let s = strings.first { urlText = s }
                    }
                    .labelStyle(.titleOnly)
                    .buttonStyle(.borderless)
                    .tint(.primary)
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator)))
                }
            }
            if !urlText.isEmpty && validURL == nil {
                Text("Needs to be an Instagram post, a TikTok video, or a Google Maps place.").font(.caption).foregroundStyle(.red)
            }
        }
    }

    @ViewBuilder
    private var postSection: some View {
        switch reading {
        case .loading:
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 10).fill(Color(.tertiarySystemFill)).frame(width: 48, height: 48)
                        .phaseAnimator([0.45, 1]) { $0.opacity($1) } animation: { _ in .easeInOut(duration: 0.8) }
                    Text(["instagram": "Instagram post", "tiktok": "TikTok video", "google": "Google Maps link"][SourceURL.parse(validURL ?? "")?.kind.rawValue ?? ""] ?? "Link")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                LoadingBar(read: false, started: readStarted)
            }
        case .done(let post):
            VStack(alignment: .leading, spacing: 14) {
                PostRow(post: post, fallbackImage: editing?.imageData, category: candidates.first?.category)
                if finding { LoadingBar(read: true, started: readStarted) }
            }
        case .failed:
            Text("Couldn't read that post. Type the place's name to save it.")
                .font(.subheadline).foregroundStyle(.secondary)
        case .idle:
            EmptyView()
        }
    }

    private var suggested: some View { candidateList }

    private var queryField: some View {
        TextField(
            editing != nil ? "Search the right place" : (manualMode ? "Place name, e.g. Septime Paris" : "Search for another place"),
            text: $query
        )
        .autocorrectionDisabled()
        .submitLabel(.search)
        .focused($focus, equals: .query)
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private var candidateList: some View {
        CandidateList(candidates: candidates, saving: saving) { save($0) }
    }

    @ViewBuilder
    private var footnotes: some View {
        if searching && candidates.isEmpty {
            Text("Searching…").font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        } else if !searching && query.trimmed.count >= 2 && candidates.isEmpty && error == nil {
            Text("No matches. Try adding the city.").font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        } else if editing == nil, manualMode, !finding, case .done = reading, query.trimmed.count < 2 {
            Text("No location on this post. Type the place's name to save it.")
                .font(.subheadline).foregroundStyle(.secondary)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }

    // MARK: Actions

    private func readPost() async {
        guard let validURL else {
            reading = .idle
            candidates = []
            return
        }
        reading = .loading
        readStarted = Date()
        finding = false
        source = nil
        candidates = []
        query = ""
        error = nil
        // Debounce: while a URL is being typed, every prefix is a "valid" post
        // link. Only the one that survives 700ms of silence gets read. A shared
        // link is complete already: read it at once.
        if initialURL.flatMap({ SourceURL.parse($0)?.url }) != validURL {
            try? await Task.sleep(for: .milliseconds(700))
        }
        guard !Task.isCancelled else { return }
        if let existing = existingPlace(for: validURL) {
            reading = .idle
            await show(Saved(place: existing, already: true, changed: false))
            return
        }
        do {
            let post = try await PostReader.read(validURL)
            guard !Task.isCancelled else { return }
            // A short link may resolve to a post already saved under its
            // canonical URL. The pre-read duplicate check cannot see that.
            if let existing = existingPlace(for: post.url) {
                reading = .idle
                await show(Saved(place: existing, already: true, changed: false))
                return
            }
            withAnimation(.snappy) {
                reading = .done(post)
                finding = true
            }
            postImage = nil
            Task { postImage = await ImageLoader.data(from: post.imageURL) }
            defer { withAnimation(.snappy) { finding = false } }
            let cityHints = Set((try? context.fetch(FetchDescriptor<Place>()))?.compactMap(\.city) ?? [])
            var found: [PlaceCandidate]
            var from: Source
            if post.kind == "google", let name = post.locationName {
                let pin = post.near.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
                found = await PlaceSearch.resolveLink(name: name, near: pin)
                from = .link
            } else if let tag = post.locationName, PlaceSearch.areaOfTag(tag) == nil {
                found = Array(await PlaceSearch.resolveTag(
                    tag, ownerFullName: post.ownerFullName, caption: post.caption,
                    hashtags: post.hashtags ?? [], cityHints: Array(cityHints),
                    extraQueries: post.city.map { ["\(tag) \($0)"] } ?? []
                ).prefix(5))
                from = .tag
            } else {
                // The caption naming a place beats the account; both are suggestions only.
                var fromCaption: [PlaceCandidate] = []
                if let q = PlaceSearch.captionPlaceQuery(post.caption) {
                    fromCaption = Array(((try? await PlaceSearch.search(q, limit: 3)) ?? []))
                }
                // Three account matches at most, as on the web.
                // A tag naming a town ("Ostuni, Puglia, Italy") says where, not what: the account, there.
                let fromAccount = await PlaceSearch.resolveAccount(
                    ownerFullName: post.ownerFullName, ownerUsername: post.ownerUsername,
                    town: PlaceSearch.areaOfTag(post.locationName)
                ).prefix(3)
                var seen = Set<String>()
                found = Array((fromCaption + fromAccount).filter { seen.insert($0.id).inserted }.prefix(4))
                from = .account
            }
            // The search field is open while this runs: if the user started typing,
            // their own results win, and nothing saves itself behind their back.
            guard !Task.isCancelled, query.trimmed.count < 2 else { return }
            candidates = found
            source = found.isEmpty ? nil : from
            // Only a location tag or a Maps link is trusted enough to save without a tap.
            if candidates.count == 1, source == .tag || source == .link {
                save(candidates[0])
            } else if candidates.isEmpty {
                focus = .query
            }
        } catch {
            guard !Task.isCancelled else { return }
            reading = .failed(error.localizedDescription)
            focus = .query
        }
    }

    private func manualSearch() async {
        let q = query.trimmed
        guard q.count >= 2 else { return }
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        searching = true
        defer { searching = false }
        do {
            let results = try await PlaceSearch.search(q, limit: 6)
            guard !Task.isCancelled else { return }
            candidates = results
        } catch {
            guard !Task.isCancelled else { return }
            self.error = "Search failed"
        }
    }

    private func save(_ c: PlaceCandidate) {
        guard let validURL, saving == nil else { return }
        saving = c.id
        Task {
            if let editing {
                editing.name = c.name
                editing.latitude = c.latitude
                editing.longitude = c.longitude
                editing.address = c.address
                editing.city = c.city
                editing.region = c.region
                editing.country = c.country
                editing.categoryRaw = c.category.rawValue
                editing.website = c.website
                editing.googlePlaceID = nil
                // A different place has its own price.
                editing.priceLevel = nil
                editing.priceChecked = false
                persist()
                Task { await PriceLookup.check(editing, in: context) }
                await show(Saved(place: editing, already: false, changed: true))
                saving = nil
                return
            }
            let url = post?.url ?? validURL
            // One place, many posts: a second post of a place already in the list joins its card.
            let all = (try? context.fetch(FetchDescriptor<Place>())) ?? []
            if let same = all.first(where: { SamePlace.matches($0, name: c.name, latitude: c.latitude, longitude: c.longitude) }) {
                if same.allPostURLs.contains(url) {
                    await show(Saved(place: same, already: true, changed: false, imageURL: post?.imageURL))
                    saving = nil
                    return
                }
                same.extraPostURLs.append(url)
                persist()
                await show(Saved(place: same, already: false, changed: false, mergedURL: url, imageURL: post?.imageURL))
                saving = nil
                return
            }
            let place = Place(
                // The server's canonical link: short links (vm.tiktok.com, maps.app.goo.gl) resolved.
                instagramURL: post?.url ?? validURL,
                name: c.name,
                latitude: c.latitude,
                longitude: c.longitude,
                address: c.address,
                city: c.city,
                region: c.region,
                country: c.country,
                category: c.category,
                caption: post?.caption,
                ownerUsername: post?.ownerUsername,
                igLocationName: post?.locationName
            )
            place.website = c.website
            // Saved before the photo downloads: closing the share card mid-download
            // used to lose the save. The photo follows (PhotoRetry covers a failure).
            context.insert(place)
            persist()
            Task { await PriceLookup.check(place, in: context) }
            let line = Milestone.line(for: place, among: all)
            let id = place.id
            // The picture usually arrived while the place was being found; it is the card's photo too.
            let image: Data?
            if let postImage { image = postImage } else { image = await ImageLoader.data(from: post?.imageURL) }
            if let image, let place = Place.find(id, in: context) {
                place.imageData = image
                persist()
            }
            await show(Saved(place: place, already: false, changed: false, milestone: line, imageURL: post?.imageURL))
            saving = nil
        }
    }

    /// The success card, with its photo decoded first (Sarp, 2026-10-10: it opened on the
    /// type icon and then jumped to the photo). A slow download waits 2 s at most; then
    /// the card opens on the icon and stays there.
    private func show(_ s: Saved) async {
        var s = s
        let url = s.imageURL
        var data = s.place.imageData
        if data == nil {
            data = await withTaskGroup(of: Data?.self) { group in
                group.addTask { await ImageLoader.data(from: url) }
                group.addTask { try? await Task.sleep(for: .seconds(2)); return nil }
                let first = await group.next() ?? nil
                group.cancelAll()
                return first
            }
        }
        if let data { s.image = await SavedCard.decode(data) }
        withAnimation(.snappy) { saved = s }
    }

    /// Save, and tell the app when this is the share extension saving.
    private func persist() {
        try? context.save()
        Persistence.noteWrite()
    }

    private func existingPlace(for url: String) -> Place? {
        ((try? context.fetch(FetchDescriptor<Place>())) ?? []).first { $0.allPostURLs.contains(url) }
    }

    private func finish() {
        if let onFinish { onFinish() } else { dismiss() }
    }
}

// MARK: - Pieces

/// One card for every save (Sarp, 2026-10-09): the post photo with the place's name and
/// type · town over it, "Saved to Vicolo" with the elephant, and a milestone line above the
/// name when there is one. No photo → the type icon on its tint. Tap or wait to close.
/// Mirrors SavedCard in the web's AddPlace.tsx.
private struct SavedCard: View {
    let saved: AddPlaceView.Saved
    let onDone: () -> Void
    @State private var started = false

    private static let ink = Color(hex: 0x1F1C1A)
    private static let paper = Color(hex: 0xFFFDF8)
    /// The bar waits for the card to settle, then starts slow: a timer from the first frame felt stressful (Sarp).
    private static let barDelay = 0.5

    var body: some View {
        let place = saved.place
        let line = saved.mergedURL != nil ? "Another post for this place" : saved.milestone
        let badge = saved.already ? "Already in Vicolo" : saved.changed ? "Changed" : "Saved to Vicolo"
        let image = saved.image
        let photo = image != nil
        Button(action: onDone) {
            ZStack(alignment: .bottomLeading) {
                // A clear base takes the card's size; the photo fills it without pushing it wider.
                Color.clear
                    .overlay {
                        if let image {
                            Image(uiImage: image).resizable().scaledToFill().allowsHitTesting(false)
                        } else {
                            place.category.tint
                                .overlay(alignment: .center) {
                                    place.icon.resizable().scaledToFit().frame(width: 150, height: 150)
                                        .padding(.bottom, 90)
                                }
                        }
                    }
                    .clipped()

                if photo {
                    LinearGradient(colors: [.black.opacity(0.75), .black.opacity(0.35), .clear], startPoint: .bottom, endPoint: .top)
                        .frame(height: 220)
                }

                VStack(alignment: .leading, spacing: 2) {
                    if let line {
                        Text(line.uppercased()).font(.caption.weight(.semibold)).tracking(0.8).opacity(0.8).padding(.bottom, 2)
                    }
                    Text(place.name).font(.system(size: 28, weight: .semibold)).lineLimit(2)
                    Text([place.category.rawValue, place.city ?? place.country].compactMap { $0 }.joined(separator: " · "))
                        .font(.body).opacity(0.8).lineLimit(1)
                }
                .foregroundStyle(photo ? Self.paper : Self.ink)
                .padding(.horizontal, 20).padding(.bottom, 24)

                GeometryReader { geo in
                    Rectangle().fill(photo ? Color.white.opacity(0.1) : Color.black.opacity(0.05))
                        .overlay(alignment: .leading) {
                            Rectangle().fill(photo ? Color.white.opacity(0.5) : Color.black.opacity(0.25))
                                .frame(width: started ? geo.size.width : 0)
                        }
                }
                .frame(height: 4)
            }
            .overlay(alignment: .topLeading) {
                HStack(spacing: 6) {
                    Image("ElephantResin").resizable().scaledToFit().frame(width: 28, height: 28)
                    Text(badge).font(.subheadline.weight(.semibold)).foregroundStyle(Self.ink)
                }
                .padding(.leading, 4).padding(.trailing, 12).padding(.vertical, 4)
                .background(.ultraThinMaterial, in: Capsule())
                .background(Self.paper.opacity(0.6), in: Capsule())
                .environment(\.colorScheme, .light)
                .padding(16)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(place.category.tint)
        }
        .buttonStyle(.plain)
        .task(id: place.id) {
            withAnimation(.timingCurve(0.45, 0, 0.8, 1, duration: AddPlaceView.savedSeconds - Self.barDelay).delay(Self.barDelay)) { started = true }
        }
    }

    /// Decoded off the main thread, at about the card's size.
    static func decode(_ data: Data) async -> UIImage? {
        await Task.detached(priority: .userInitiated) {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 1400, kCGImageSourceCreateThumbnailWithTransform: true]
            return CGImageSourceCreateThumbnailAtIndex(source, 0, opts as CFDictionary).map(UIImage.init(cgImage:))
        }.value
    }
}

/// As tall as its content up to `max`, decided in one layout pass (no measured state a frame late).
private struct CappedHeight: Layout {
    let max: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let child = subviews.first else { return .zero }
        let ideal = child.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil))
        return CGSize(width: proposal.width ?? ideal.width, height: min(ideal.height, max))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: bounds.origin, proposal: ProposedViewSize(bounds.size))
    }
}

/// Reading a post takes 5–20 s (Apify). One quiet line in the label ("Finding the place…")
/// and a bar that never stops creeping — the steps made it look like work to watch
/// (Sarp, 2026-10-09). Mirrors LoadingBar in the web's AddPlace.tsx.
private struct LoadingBar: View {
    /// The post is read; the place is being found.
    let read: Bool
    let started: Date

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.1)) { ctx in
            // Eases toward 70% while reading, then on toward 95%; it only hits 100% by finishing.
            let t = ctx.date.timeIntervalSince(started)
            let reading = 0.7 * (1 - exp(-t / 6))
            let value = read ? 0.7 + 0.25 * (1 - exp(-t / 8)) : reading
            GeometryReader { geo in
                Capsule().fill(Color(.tertiarySystemFill))
                    .overlay(alignment: .leading) {
                        Capsule().fill(Color.secondary)
                            .frame(width: geo.size.width * min(value, 0.95))
                            .animation(.linear(duration: 0.1), value: value)
                    }
            }
            .frame(height: 4)
        }
        .padding(.top, 4)
    }
}

private struct PostRow: View {
    let post: InstagramPost
    var fallbackImage: Data? = nil
    /// No picture (a Maps link): the type icon on its tint, as photo-less tiles do.
    var category: PlaceCategory? = nil
    @State private var image: UIImage?

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                } else if let category, post.imageURL == nil {
                    category.tint.overlay { category.icon.resizable().scaledToFit().padding(6) }
                } else {
                    Color(.tertiarySystemFill)
                }
            }
            .frame(width: 48, height: 48)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 2) {
                if let owner = post.ownerUsername {
                    Text("@\(owner)").font(.caption.weight(.medium)).foregroundStyle(.secondary).lineLimit(1)
                }
                if let caption = post.caption {
                    Text(caption).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .task(id: post.imageURL) {
            if let fallbackImage { image = UIImage(data: fallbackImage) }
            if let data = await ImageLoader.data(from: post.imageURL) { image = UIImage(data: data) }
        }
    }
}

/// One way to pick a place everywhere (tag, account guesses, search): the whole row saves,
/// the Save pill says so. "Type · City" under the name. Country only when the list spans countries; street address
/// only when two rows would otherwise be identical.
private struct CandidateList: View {
    let candidates: [PlaceCandidate]
    let saving: String?
    let onPick: (PlaceCandidate) -> Void

    private var multiCountry: Bool { Set(candidates.compactMap(\.country)).count > 1 }
    private var dupes: Set<String> {
        var seen = Set<String>(), d = Set<String>()
        for c in candidates {
            let k = "\(c.name)|\(c.city ?? "")".lowercased()
            if !seen.insert(k).inserted { d.insert(k) }
        }
        return d
    }

    var body: some View {
        if !candidates.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(candidates.enumerated()), id: \.element.id) { index, c in
                    Button { onPick(c) } label: { row(c) }
                        .buttonStyle(.plain)
                        .disabled(saving != nil)
                    if index < candidates.count - 1 { Divider() }
                }
            }
        }
    }

    private func row(_ c: PlaceCandidate) -> some View {
        let whereText = [c.city, multiCountry ? c.country : nil].compactMap { $0 }.joined(separator: ", ")
        let key = "\(c.name)|\(c.city ?? "")".lowercased()
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(c.name).font(.body.weight(.medium)).lineLimit(1)
                Text([c.category.rawValue, whereText.isEmpty ? nil : whereText].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                if dupes.contains(key), let address = c.address {
                    Text(address).font(.caption).foregroundStyle(.tertiary).lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Text(saving == c.id ? "Saving…" : "Save")
                .font(.caption.weight(.medium))
                .foregroundStyle(Color(.systemBackground))
                .padding(.horizontal, 12).padding(.vertical, 4)
                .background(Color(.label), in: Capsule())
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
