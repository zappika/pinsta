import SwiftUI
import SwiftData

/// Paste a link → the post is read (cloud) → MapKit resolves the location tag
/// (local) → tap a candidate to save. Typing is the fallback.
struct AddPlaceView: View {
    /// Pre-filled link (the share extension passes the shared URL).
    var initialURL: String? = nil
    /// Called when the sheet is done; the share extension completes its request here.
    var onFinish: (() -> Void)? = nil
    /// Extensions can't read the general pasteboard.
    var allowsPasteboard = true

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var urlText = ""
    @State private var reading: Reading = .idle
    @State private var query = ""
    @State private var candidates: [PlaceCandidate] = []
    @State private var searching = false
    @State private var saving: String?
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case url, query }
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

    private var validURL: String? { InstagramURL.normalize(urlText) }
    private var post: InstagramPost? { if case .done(let p) = reading { return p } else { return nil } }
    private var showTaggedFirst: Bool { !candidates.isEmpty && post?.locationName != nil && query.trimmed.count < 2 }
    private var manualMode: Bool {
        if case .failed = reading { return true }
        if let post, post.locationName == nil { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    urlField
                    postSection
                    if showTaggedFirst { taggedCandidates }
                    queryField
                    if let error {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    }
                    if !showTaggedFirst { candidateList }
                    footnotes
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Save a place")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { finish() }
                }
            }
        }
        .onAppear {
            if let initialURL {
                urlText = initialURL
                return
            }
            focus = .url
            // Pre-fill from the clipboard if it already holds an Instagram link.
            if allowsPasteboard, let s = UIPasteboard.general.string, InstagramURL.normalize(s) != nil {
                urlText = s
            }
        }
        .task(id: validURL) { await readPost() }
        .task(id: query) { await manualSearch() }
    }

    // MARK: Sections

    private var urlField: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Instagram post")
            HStack(spacing: 8) {
                TextField("https://www.instagram.com/p/…", text: $urlText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .focused($focus, equals: .url)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(!urlText.isEmpty && validURL == nil ? Color.red.opacity(0.5) : Color.clear)
                    )
                if urlText.isEmpty && allowsPasteboard {
                    Button("Paste") {
                        if let s = UIPasteboard.general.string { urlText = s }
                    }
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                }
            }
            if !urlText.isEmpty && validURL == nil {
                Text("Needs to be an Instagram post or reel link.")
                    .font(.caption).foregroundStyle(.red)
            }
        }
    }

    @ViewBuilder
    private var postSection: some View {
        switch reading {
        case .loading:
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 0).fill(Color(.tertiarySystemFill)).aspectRatio(4/3, contentMode: .fit)
                Text("Reading post…").font(.caption).foregroundStyle(.secondary).padding([.horizontal, .bottom], 16)
            }
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        case .done(let post):
            PostPreview(post: post)
        case .failed(let message):
            Text("Couldn't read that post (\(message)). Type the place below.")
                .font(.subheadline).foregroundStyle(.secondary)
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        case .idle:
            EmptyView()
        }
    }

    private var taggedCandidates: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel("Tagged “\(post?.locationName ?? "")” — tap to save")
            candidateList
        }
    }

    private var queryField: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionLabel(post?.locationName != nil && !manualMode ? "Not the right place? Search" : "Which place is it?")
            TextField(
                reading == .loading ? "One moment…" : (manualMode ? "e.g. Septime Paris" : "Search a different place"),
                text: $query
            )
            .autocorrectionDisabled()
            .submitLabel(.search)
            .focused($focus, equals: .query)
            .disabled(validURL == nil || reading == .loading)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private var candidateList: some View {
        CandidateList(candidates: candidates, saving: saving, onPick: save)
    }

    @ViewBuilder
    private var footnotes: some View {
        if searching && candidates.isEmpty {
            Text("Searching…").font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        } else if !searching && query.trimmed.count >= 2 && candidates.isEmpty && error == nil {
            Text("No matches. Try adding the city.").font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        } else if manualMode, case .done = reading, query.trimmed.count < 2 {
            Text("No location tag on this post — type the place name.")
                .font(.subheadline).foregroundStyle(.tertiary).frame(maxWidth: .infinity)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
    }

    // MARK: Actions

    private func readPost() async {
        guard let validURL else {
            reading = .idle
            candidates = []
            return
        }
        reading = .loading
        candidates = []
        query = ""
        error = nil
        // Debounce: while a URL is being typed, every prefix is a "valid" post
        // link. Only the one that survives 700ms of silence gets read.
        try? await Task.sleep(for: .milliseconds(700))
        guard !Task.isCancelled else { return }
        do {
            let post = try await PostReader.read(validURL)
            guard !Task.isCancelled else { return }
            reading = .done(post)
            if let tag = post.locationName {
                candidates = (try? await PlaceSearch.search(tag)) ?? []
            }
            if candidates.isEmpty { focus = .query }
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
            let image = await ImageLoader.data(from: post?.imageURL)
            context.insert(Place(
                instagramURL: validURL,
                name: c.name,
                latitude: c.latitude,
                longitude: c.longitude,
                address: c.address,
                city: c.city,
                country: c.country,
                category: c.category,
                caption: post?.caption,
                ownerUsername: post?.ownerUsername,
                igLocationName: post?.locationName,
                imageData: image
            ))
            try? context.save()
            finish()
        }
    }

    private func finish() {
        if let onFinish { onFinish() } else { dismiss() }
    }
}

// MARK: - Pieces

private struct PostPreview: View {
    let post: InstagramPost
    @State private var image: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                Group {
                    if let image {
                        Image(uiImage: image).resizable().scaledToFill()
                    } else {
                        Color(.tertiarySystemFill)
                    }
                }
                .aspectRatio(4/3, contentMode: .fit)
                .clipped()
                if let owner = post.ownerUsername {
                    Text("@\(owner)")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(.black.opacity(0.55), in: Capsule())
                        .padding(8)
                }
            }
            if let caption = post.caption {
                Text(caption)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .padding(16)
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .task(id: post.imageURL) {
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
                    if index < candidates.count - 1 { Divider().padding(.leading, 16) }
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private func row(_ c: PlaceCandidate) -> some View {
        let whereText = [c.city, multiCountry ? c.country : nil].compactMap { $0 }.joined(separator: ", ")
        let key = "\(c.name)|\(c.city ?? "")".lowercased()
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 0) {
                    Text(c.name).font(.body.weight(.medium)).lineLimit(1)
                    if !whereText.isEmpty {
                        Text(" — \(whereText)").font(.body).foregroundStyle(.tertiary).lineLimit(1).layoutPriority(1)
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
        .padding(.horizontal, 16).padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
