import SwiftUI
import SwiftData
import MapKit

/// A small, fixed-height sheet. Paste a link → the post is read (cloud) → the
/// tag becomes a place (MapKit, on device). One match saves itself; several ask
/// for a tap; none falls back to the account that posted, then to search.
/// In edit mode the post is known and only the place changes.
struct AddPlaceView: View {
    static let sheetHeight: CGFloat = 360

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
    @State private var autoSaveDeclined = false
    @State private var error: String?
    /// Between reading the post and having candidates: the steps stay on screen.
    @State private var finding = false
    @State private var readStarted = Date()
    @FocusState private var focus: Field?

    private enum Field { case url, query }
    private enum Source { case tag, account, link }
    fileprivate struct Saved {
        let place: Place; let automatic: Bool; let already: Bool; let changed: Bool
        /// The post was added to a place already in the list, not saved as a new one.
        var mergedURL: String? = nil
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

    var body: some View {
        VStack(spacing: 0) {
            if let saved {
                Receipt(saved: saved, onUndo: undo, onDone: finish)
                    .task(id: saved.place.id) {
                        // "Already saved" waits for Done — it's news, not a receipt.
                        guard !saved.already else { return }
                        try? await Task.sleep(for: .seconds(saved.automatic ? 3 : 1.5))
                        guard !Task.isCancelled else { return }
                        finish()
                    }
            } else {
                HStack {
                    sectionLabel(editing != nil ? "Change place" : "Save a place")
                    Spacer()
                    Button("Cancel") { finish() }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 8)

                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if editing == nil { urlField }
                        postSection
                        if showSuggestedFirst && saving == nil { suggested }
                        if validURL != nil, reading != .loading, reading != .idle, saving == nil { queryField }
                        if let error {
                            Text(error).font(.subheadline).foregroundStyle(.red)
                        }
                        if !showSuggestedFirst { candidateList }
                        footnotes
                    }
                    .padding(.horizontal, 16).padding(.bottom, 16)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Raised surface: white in light, the elevated grey in dark (never pure black on black).
        .background(Color(.secondarySystemGroupedBackground))
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
                LoadingSteps(read: false, tag: nil, started: readStarted)
            }
        case .done(let post):
            VStack(alignment: .leading, spacing: 14) {
                PostRow(post: post, fallbackImage: editing?.imageData)
                if finding { LoadingSteps(read: true, tag: post.locationName, started: readStarted) }
            }
        case .failed(let message):
            Text("Couldn't read that post (\(message)). Type the place below.")
                .font(.subheadline).foregroundStyle(.secondary)
        case .idle:
            EmptyView()
        }
    }

    private var suggested: some View {
        VStack(alignment: .leading, spacing: 6) {
            if source == .link {
                sectionLabel("From Google Maps — \(candidates.count > 1 ? "which one?" : "tap to save")")
            } else if source == .account {
                sectionLabel("No location tag — is it one of these?")
            } else {
                sectionLabel("Tagged “\(post?.locationName ?? "")” — \(candidates.count > 1 ? "which one?" : "tap to save")")
            }
            candidateList
        }
    }

    private var queryField: some View {
        TextField(
            editing != nil ? "Search the right place" : (manualMode ? "Which place is it? e.g. Septime Paris" : "Not the right place? Search"),
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
        if let saving, showSuggestedFirst, let c = candidates.first(where: { $0.id == saving }) {
            Text("Saving \(c.name)…").font(.subheadline).foregroundStyle(.secondary)
        } else if searching && candidates.isEmpty {
            Text("Searching…").font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        } else if !searching && query.trimmed.count >= 2 && candidates.isEmpty && error == nil {
            Text("No matches. Try adding the city.").font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        } else if editing == nil, manualMode, case .done = reading, query.trimmed.count < 2 {
            Text("No location tag on this post, and the account didn't match a place.")
                .font(.caption).foregroundStyle(.tertiary)
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
            withAnimation(.snappy) { saved = Saved(place: existing, automatic: false, already: true, changed: false) }
            return
        }
        do {
            let post = try await PostReader.read(validURL)
            guard !Task.isCancelled else { return }
            // A short link may resolve to a post already saved under its
            // canonical URL. The pre-read duplicate check cannot see that.
            if let existing = existingPlace(for: post.url) {
                reading = .idle
                withAnimation(.snappy) { saved = Saved(place: existing, automatic: false, already: true, changed: false) }
                return
            }
            withAnimation(.snappy) {
                reading = .done(post)
                finding = true
            }
            defer { withAnimation(.snappy) { finding = false } }
            let cityHints = Set((try? context.fetch(FetchDescriptor<Place>()))?.compactMap(\.city) ?? [])
            var found: [PlaceCandidate]
            var from: Source
            if post.kind == "google", let name = post.locationName {
                let pin = post.near.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
                found = await PlaceSearch.resolveLink(name: name, near: pin)
                from = .link
            } else if let tag = post.locationName {
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
                let fromAccount = await PlaceSearch.resolveAccount(
                    ownerFullName: post.ownerFullName, ownerUsername: post.ownerUsername
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
            if candidates.count == 1, source == .tag || source == .link, !autoSaveDeclined {
                save(candidates[0], automatically: true)
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

    private func save(_ c: PlaceCandidate, automatically: Bool = false) {
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
                editing.googlePlaceID = nil
                // A different place has its own price.
                editing.priceLevel = nil
                editing.priceChecked = false
                persist()
                Task { await PriceLookup.check(editing, in: context) }
                saving = nil
                withAnimation(.snappy) { saved = Saved(place: editing, automatic: false, already: false, changed: true) }
                return
            }
            let url = post?.url ?? validURL
            // One place, many posts: a second post of a place already in the list joins its card.
            let all = (try? context.fetch(FetchDescriptor<Place>())) ?? []
            if let same = all.first(where: { SamePlace.matches($0, name: c.name, latitude: c.latitude, longitude: c.longitude) }) {
                if same.allPostURLs.contains(url) {
                    saving = nil
                    withAnimation(.snappy) { saved = Saved(place: same, automatic: false, already: true, changed: false) }
                    return
                }
                same.extraPostURLs.append(url)
                persist()
                saving = nil
                withAnimation(.snappy) { saved = Saved(place: same, automatic: automatically, already: false, changed: false, mergedURL: url) }
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
            // Saved before the photo downloads: closing the share card mid-download
            // used to lose the save. The photo follows (PhotoRetry covers a failure).
            context.insert(place)
            persist()
            Task { await PriceLookup.check(place, in: context) }
            saving = nil
            withAnimation(.snappy) { saved = Saved(place: place, automatic: automatically, already: false, changed: false) }
            let id = place.id
            if let image = await ImageLoader.data(from: post?.imageURL), let place = Place.find(id, in: context) {
                place.imageData = image
                persist()
            }
        }
    }

    /// Save, and tell the app when this is the share extension saving.
    private func persist() {
        try? context.save()
        Persistence.noteWrite()
    }

    private func existingPlace(for url: String) -> Place? {
        ((try? context.fetch(FetchDescriptor<Place>())) ?? []).first { $0.allPostURLs.contains(url) }
    }

    /// "Wrong place?" — take the save back and hand control to the user.
    private func undo() {
        // "Already saved" points at an existing place: never take that one back.
        guard let saved, !saved.already else { return }
        if let url = saved.mergedURL {
            saved.place.extraPostURLs.removeAll { $0 == url }
        } else {
            context.delete(saved.place)
        }
        persist()
        autoSaveDeclined = true
        withAnimation(.snappy) { self.saved = nil }
        focus = .query
    }

    private func finish() {
        if let onFinish { onFinish() } else { dismiss() }
    }
}

// MARK: - Pieces

/// The moment after a save: what it is, where it went, and — when the app
/// picked the place itself — a way to say it got it wrong.
private struct Receipt: View {
    let saved: AddPlaceView.Saved
    let onUndo: () -> Void
    let onDone: () -> Void

    var body: some View {
        let place = saved.place
        VStack(alignment: .leading, spacing: 14) {
            Text((saved.already ? "Already saved" : saved.changed ? "Changed" : saved.mergedURL != nil ? "Added to this place · \(saved.place.allPostURLs.count) posts" : "Saved").uppercased())
                .font(.caption.weight(.medium)).foregroundStyle(.secondary)
            HStack(spacing: 14) {
                if let data = place.imageData, let image = UIImage(data: data) {
                    Image(uiImage: image).resizable().scaledToFill()
                        .frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 12))
                } else {
                    RoundedRectangle(cornerRadius: 12).fill(Color(.tertiarySystemFill)).frame(width: 56, height: 56)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(place.name).font(.body.weight(.medium)).lineLimit(1)
                    Text([place.category.rawValue, place.city ?? place.country].compactMap { $0 }.joined(separator: " · "))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 0)
                if !saved.already {
                    Image(systemName: "checkmark").font(.title3.weight(.semibold)).foregroundStyle(.green)
                }
            }
            HStack(spacing: 10) {
                if saved.automatic && !saved.already {
                    Button(action: onUndo) {
                        Text("Wrong place?")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity).padding(.vertical, 11)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator)))
                    }
                }
                Button(action: onDone) {
                    Text("Done")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(.systemBackground))
                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(Color(.label), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .buttonStyle(.plain)
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

/// Reading a post takes 5–20 s (Apify). The wait should read as work: named
/// steps, the tag being looked up, and a bar that never stops creeping.
private struct LoadingSteps: View {
    /// The post is read; the place is being found.
    let read: Bool
    let tag: String?
    let started: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 10) {
                step(read ? "Read the post" : "Reading the post", read ? .done : .active)
                step(tag.map { "Finding “\($0)”" } ?? "Finding the place", read ? .active : .waiting)
                step("Saving to your list", .waiting)
            }
            TimelineView(.periodic(from: .now, by: 0.1)) { ctx in
                // Eases toward 70% while reading, then on toward 95%; it only hits 100% by finishing.
                let t = ctx.date.timeIntervalSince(started)
                let reading = 0.7 * (1 - exp(-t / 6))
                let value = read ? 0.7 + 0.25 * (1 - exp(-t / 8)) : reading
                GeometryReader { geo in
                    Capsule().fill(Color(.tertiarySystemFill))
                        .overlay(alignment: .leading) {
                            Capsule().fill(Color.primary.opacity(0.8))
                                .frame(width: geo.size.width * min(value, 0.95))
                                .animation(.linear(duration: 0.1), value: value)
                        }
                }
                .frame(height: 4)
            }
        }
    }

    private enum StepState { case waiting, active, done }

    private func step(_ text: String, _ state: StepState) -> some View {
        HStack(spacing: 10) {
            Group {
                switch state {
                case .done: Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                case .active: ProgressView().controlSize(.small)
                case .waiting: Image(systemName: "circle").foregroundStyle(.quaternary)
                }
            }
            .frame(width: 20, height: 20)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(state == .waiting ? .tertiary : state == .done ? .secondary : .primary)
                .lineLimit(1)
        }
        .transition(.opacity)
    }
}

private struct PostRow: View {
    let post: InstagramPost
    var fallbackImage: Data? = nil
    @State private var image: UIImage?

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
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

/// "Name — City". Country only when the list spans countries; street address
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
                    if index < candidates.count - 1 { Divider().padding(.leading, 14) }
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator).opacity(0.5)))
        }
    }

    private func row(_ c: PlaceCandidate) -> some View {
        let whereText = [c.city, multiCountry ? c.country : nil].compactMap { $0 }.joined(separator: ", ")
        let key = "\(c.name)|\(c.city ?? "")".lowercased()
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 0) {
                    // The name keeps its room; the city truncates first.
                    Text(c.name).font(.body.weight(.medium)).lineLimit(1).layoutPriority(1)
                    if !whereText.isEmpty {
                        Text(" — \(whereText)").font(.body).foregroundStyle(.tertiary).lineLimit(1)
                    }
                }
                if dupes.contains(key), let address = c.address {
                    Text(address).font(.caption).foregroundStyle(.tertiary).lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Text(saving == c.id ? "Saving…" : c.category.rawValue)
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Color(.tertiarySystemFill), in: Capsule())
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
