import SwiftUI
import SwiftData
import MapKit

/// The + menu → Google Maps, with a list link: a shared Google Maps list into Vicolo.
/// One mode at a time (Sarp, 2026-10-19: the old review "feels like I'd rather cut myself"):
/// 1. Paste: the instruction, the field, Paste.
/// 2. Finding: the server matches the list (`ListImport`); the count, and that this can be closed.
/// 3. The list: its name, what's in it by type, what couldn't be found (Search), "I've been to
///    these", Import. "Choose what to import" opens the places one by one. Cancel drops the import.
/// 4. Importing, then Done.
struct ImportView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    /// A list link pasted into the + menu's Google Maps entry: read at once.
    var initialLink: String? = nil
    @State private var url = ""
    /// Notifications are on: the wait can say "we'll let you know".
    @State private var tells = false
    @State private var confirmingCancel = false
    private var job: ListImport { .shared }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if job.matching { finding }
                    else if !job.rows.isEmpty { overview }
                    else { paste }
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Import from Google Maps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    // Later (or pulling the sheet down) keeps the import for another time: the buddy
                    // menu's Import row brings it back. Dropping it is "Cancel import", below the list,
                    // and asks first (Sarp, 2026-10-19: Cancel up here was too harsh).
                    Button(job.matching || (!job.rows.isEmpty && !job.finished) ? "Later" : "Close") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) { if !job.rows.isEmpty { bottomBar } }
        }
        .task(id: job.matching) { tells = await Push.willTell() }
        .onChange(of: job.phase) { _, phase in if phase == .ready { job.markOpened() } }
        .onAppear {
            job.resume(context: context)
            job.markOpened()
            if let initialLink, initialLink != job.link { url = initialLink; read(); return }
            // Testing: `-importURL <link>` opens here and reads that list.
            if job.job == nil, let link = TestArgs.string("importURL") { url = link; read() }
        }
    }

    // MARK: 1. Paste

    private var paste: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("In Google Maps, open Saved, pick a list, and tap Share. Paste that link here. The list has to be shared, not private.")
                .font(.subheadline).foregroundStyle(.secondary)
            TextField("https://maps.app.goo.gl/…", text: $url)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .submitLabel(.go)
                .onSubmit(read)
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            if url.isEmpty {
                PasteButton(payloadType: String.self) { strings in
                    if let s = strings.first { url = s; read() }
                }
                .labelStyle(.titleAndIcon)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .tint(Color(.label))
                .frame(maxWidth: .infinity)
            } else {
                Button(action: read) {
                    Text(job.reading ? "Reading the list…" : "Read list")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(.systemBackground))
                        .frame(maxWidth: .infinity).padding(.vertical, 15)
                        .background(Color(.label), in: RoundedRectangle(cornerRadius: 16))
                }
                .disabled(job.reading)
            }
            if job.phase == .failed, let error = job.error {
                Text(error).font(.subheadline).foregroundStyle(.red)
            }
        }
    }

    private func read() {
        let link = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !link.isEmpty, !job.reading else { return }
        Task {
            // The moment it makes sense to ask (Sarp, 2026-10-19): this can take a while.
            await Push.ask()
            await job.start(link, context: context)
        }
    }

    // MARK: 2. Finding

    private var finding: some View {
        let done = job.job?.done ?? 0
        let total = max(job.job?.total ?? 0, 1)
        return VStack(alignment: .leading, spacing: 10) {
            Text(job.title ?? "Your list").font(.title2.weight(.semibold)).lineLimit(2)
            ProgressView(value: Double(min(done, total)), total: Double(total)).tint(Color(.label))
                .padding(.top, 6)
            Text("Finding the places… \(done) of \(total)").font(.subheadline).foregroundStyle(.secondary)
            Text(tells
                 ? "You can close this. We'll let you know when it's ready."
                 : "You can close this. It keeps going, and the list waits here.")
                .font(.subheadline).foregroundStyle(.secondary)
            Button("Stop this import", role: .destructive) { job.forget(); url = "" }
                .font(.subheadline).padding(.top, 14)
        }
    }

    // MARK: 3. The list

    private var overview: some View {
        let picked = job.picked
        let open = job.rows.filter { $0.importable && $0.save != .saved }
        let byType = PlaceCategory.allCases.compactMap { c -> (PlaceCategory, Int)? in
            guard open.contains(where: { $0.category == c }) else { return nil }
            return (c, picked.filter { $0.category == c }.count)
        }
        let missing = job.rows.filter { $0.status == .missing }
        let already = job.rows.filter { $0.status == .already }.count
        return VStack(alignment: .leading, spacing: 0) {
            Text(job.title ?? "Your list").font(.title2.weight(.semibold)).lineLimit(2)
            if let owner = job.owner {
                Text("From \(owner)").font(.subheadline).foregroundStyle(.secondary).padding(.top, 2)
            }

            // Where the list is: every place its type icon on its tint (Sarp, 2026-10-19: a visual
            // summary; photos would cost a Google call each, the pins are free).
            ListMap(rows: picked)
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.top, 16)

            // What's going in, by type. A type opens its places, to leave some out.
            VStack(spacing: 0) {
                ForEach(Array(byType.enumerated()), id: \.element.0) { i, entry in
                    NavigationLink {
                        ChooseView(category: entry.0)
                    } label: {
                        HStack(spacing: 12) {
                            entry.0.icon.resizable().scaledToFit().frame(width: 30, height: 30)
                            Text(entry.0.plural)
                            Spacer()
                            Text("\(entry.1)").monospacedDigit().foregroundStyle(.secondary)
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(job.importing)
                    if i < byType.count - 1 { Divider().padding(.leading, 58) }
                }
                if byType.isEmpty {
                    Text("Nothing chosen").foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(16)
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            .padding(.top, 12)

            if already > 0 {
                Text("\(count(already, "place")) already in your list.")
                    .font(.footnote).foregroundStyle(.secondary).padding(.top, 10).padding(.horizontal, 16)
            }

            if !missing.isEmpty {
                Text("Couldn’t find \(missing.count)")
                    .font(.subheadline.weight(.semibold)).padding(.top, 28).padding(.horizontal, 16)
                Text("Search finds one by its name.")
                    .font(.footnote).foregroundStyle(.secondary).padding(.top, 2).padding(.horizontal, 16)
                VStack(spacing: 0) {
                    ForEach(Array(missing.enumerated()), id: \.element.id) { i, row in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.name).lineLimit(1)
                                if let address = row.address {
                                    Text(address).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                }
                            }
                            Spacer(minLength: 12)
                            Button("Search") {
                                Settings.shared.showingImport = false
                                Settings.shared.searchName = row.name
                            }
                            .font(.subheadline.weight(.medium))
                        }
                        .padding(.horizontal, 16).padding(.vertical, 12)
                        if i < missing.count - 1 { Divider().padding(.leading, 16) }
                    }
                }
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                .padding(.top, 8)
            }

            if !job.importing {
                Button("Cancel import", role: .destructive) { confirmingCancel = true }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 32)
                    .confirmationDialog("Cancel this import?", isPresented: $confirmingCancel, titleVisibility: .visible) {
                        Button("Cancel import", role: .destructive) { job.forget(); dismiss() }
                        Button("Keep it", role: .cancel) {}
                    } message: {
                        Text("Nothing from this list is added. You can paste the link again any time.")
                    }
            }
        }
    }

    // MARK: 4. Import

    /// Not over the list: a solid bar of its own. Everything comes in as Want to go (Sarp, 2026-10-19:
    /// no "I've been to these"); while importing the count, then Done.
    private var bottomBar: some View {
        let picked = job.picked.count
        let over = picked - ListImport.limit
        let done = job.finished
        let total = job.savedCount + picked
        let open = job.rows.filter { $0.importable && $0.save != .saved }.count
        return VStack(spacing: 12) {
            if job.importing && !done {
                ProgressView(value: Double(job.savedCount), total: Double(max(total, 1))).tint(Color(.label))
            }
            Button {
                if done { dismiss() } else { job.startImport() }
            } label: {
                Text(
                    done ? "Done · \(count(job.savedCount, "place")) imported"
                    : job.importing ? "Importing \(job.savedCount) of \(total)…"
                    : over > 0 ? "Choose \(over) fewer (\(ListImport.limit) at most)"
                    : picked == 0 ? "Nothing chosen"
                    : picked == open ? "Import all \(count(picked, "place"))"
                    : "Import \(picked) of \(count(open, "place"))"
                )
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(.systemBackground))
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(Color(.label), in: RoundedRectangle(cornerRadius: 16))
            }
            .disabled(!done && (job.importing || picked == 0 || over > 0))
            .opacity(!done && (picked == 0 || over > 0) ? 0.4 : 1)
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .overlay(alignment: .top) { Divider() }
    }
}

private func count(_ n: Int, _ word: String) -> String { "\(n) \(word)\(n == 1 ? "" : "s")" }

/// One type's places from the list: tap one to leave it out or put it back, hold it to give it
/// another type. Each with its type icon on its tint, like a map pin (Sarp, 2026-10-19).
private struct ChooseView: View {
    let category: PlaceCategory
    private var job: ListImport { .shared }

    var body: some View {
        let rows = job.rows.filter { $0.importable && $0.category == category }
        List {
            Section {
                ForEach(rows) { row in ChooseRow(row: row) }
            } footer: {
                Text("Tap a place to leave it out. Hold it to change its type.")
            }
        }
        .navigationTitle(category.plural)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ChooseRow: View {
    let row: ListImport.Row
    private var job: ListImport { .shared }

    var body: some View {
        Button { update { $0.picked.toggle() } } label: {
            HStack(spacing: 12) {
                row.icon.resizable().scaledToFit()
                    .frame(width: 26, height: 26)
                    .frame(width: 44, height: 44)
                    .background(row.category.tint, in: Circle())
                    .saturation(row.picked ? 1 : 0)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.match?.name ?? row.name).lineLimit(1)
                    if let place = row.match?.city ?? row.address {
                        Text(place).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    if let note = row.note {
                        Text("“\(note)”").font(.caption).italic().foregroundStyle(.secondary).lineLimit(2)
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: row.picked ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(row.picked ? Color(.label) : Color(.tertiaryLabel))
            }
            .opacity(row.picked ? 1 : 0.5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(row.picked ? .isSelected : [])
        .contextMenu {
            ForEach(PlaceCategory.allCases.filter { $0 != row.category }) { c in
                Button(c.rawValue) { update { $0.category = c } }
            }
        }
    }

    private func update(_ change: (inout ListImport.Row) -> Void) {
        if let i = job.rows.firstIndex(where: { $0.id == row.id }) { change(&job.rows[i]) }
    }
}

/// The list on a still map: each place its type icon on its tint (as the app's map), framed to fit.
private struct ListMap: View {
    let rows: [ListImport.Row]

    var body: some View {
        Map(initialPosition: .region(region), interactionModes: []) {
            ForEach(rows) { row in
                Annotation("", coordinate: CLLocationCoordinate2D(latitude: row.latitude, longitude: row.longitude)) {
                    row.icon.resizable().scaledToFit()
                        .frame(width: 18, height: 18)
                        .frame(width: 28, height: 28)
                        .background(row.category.tint, in: Circle())
                        .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                        .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .allowsHitTesting(false)
    }

    private var region: MKCoordinateRegion {
        let lats = rows.map(\.latitude), lngs = rows.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLng = lngs.min(), let maxLng = lngs.max() else {
            return MKCoordinateRegion(center: .init(latitude: 48, longitude: 10), span: .init(latitudeDelta: 30, longitudeDelta: 30))
        }
        return MKCoordinateRegion(
            center: .init(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2),
            span: .init(latitudeDelta: max((maxLat - minLat) * 1.5, 0.008), longitudeDelta: max((maxLng - minLng) * 1.5, 0.008))
        )
    }
}

private extension ListImport.Row {
    /// A restaurant's food icon when its name or note says (poke, pizza…), else its type's.
    var icon: Image {
        if category == .restaurant, let food = Food.icon(name: match?.name ?? name, caption: note) { return Image(food) }
        return category.icon
    }
}
