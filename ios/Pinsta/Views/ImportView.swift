import SwiftUI
import SwiftData

/// Buddy menu → Import from Google: the web's /import on the phone (Sarp, 2026-10-09: same
/// flow, same design). Paste a shared list's link, review it grouped by type (untick, move a
/// place or a whole group to another type), import. Matching runs with MapKit while the
/// review is open and goes on after it closes (`ListImport`).
struct ImportView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    private var job: ListImport { .shared }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("In Google Maps, open Saved, pick a list, and tap Share. Paste that link here. The list has to be shared, not private.")
                        .font(.subheadline).foregroundStyle(.secondary)
                    linkField.padding(.top, 14)
                    if job.reading {
                        Text("Reading the list…").font(.subheadline).foregroundStyle(.secondary).padding(.top, 10)
                    }
                    if let error = job.error {
                        Text(error).font(.subheadline).foregroundStyle(.red).padding(.top, 10)
                    }
                    if !job.rows.isEmpty { review.padding(.top, 28) }
                }
                .padding(.horizontal, 16).padding(.bottom, 120)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Import from Google Maps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .safeAreaInset(edge: .bottom) { if !job.rows.isEmpty { importButton } }
        }
        .onAppear {
            if url.isEmpty, let link = job.link { url = link }
            // Testing: `-importURL <link>` opens here and reads that list.
            if job.rows.isEmpty, let link = UserDefaults.standard.string(forKey: "importURL") { url = link; read() }
        }
    }

    private var linkField: some View {
        HStack(spacing: 8) {
            TextField("https://maps.app.goo.gl/…", text: $url)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .submitLabel(.go)
                .onSubmit(read)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            if url.isEmpty {
                PasteButton(payloadType: String.self) { strings in
                    if let s = strings.first { url = s; read() }
                }
                .labelStyle(.titleOnly).buttonStyle(.borderless).tint(.primary)
                .font(.subheadline.weight(.medium))
            } else {
                Button(job.reading ? "Reading…" : "Read list", action: read)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color(.systemBackground))
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Color(.label), in: RoundedRectangle(cornerRadius: 12))
                    .disabled(job.reading || job.importing && job.busy)
            }
        }
    }

    private func read() {
        let link = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !link.isEmpty, !job.reading else { return }
        Task { await job.read(link, context: context) }
    }

    // MARK: Review

    private var review: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.title ?? "Your list").font(.title3.weight(.semibold)).lineLimit(1)
                    Text(summary).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                if !job.importing {
                    let anyOff = job.rows.contains { $0.importable && !$0.picked }
                    Button(anyOff ? "Select all" : "Select none") { setAll(picked: anyOff) }
                        .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                }
            }
            ForEach(groups, id: \.id) { group in
                GroupSection(group: group, disabled: job.importing)
                    .padding(.top, 20)
            }
        }
    }

    private var summary: String {
        var parts = [count(job.rows.count, "place")]
        if job.findingCount > 0 { parts.append("finding \(job.findingCount)…") }
        if job.savedCount > 0 { parts.append("\(job.savedCount) imported") }
        return parts.joined(separator: " · ")
    }

    private func setAll(picked: Bool) {
        for i in job.rows.indices where job.rows[i].importable && job.rows[i].save == .idle {
            job.rows[i].picked = picked
        }
    }

    fileprivate struct Group: Identifiable {
        let id: String
        let title: String
        let category: PlaceCategory?
        let rows: [ListImport.Row]
    }

    /// One section per type in the app's order, then places still being found, then
    /// what's already a card, then what couldn't be found (at the bottom, Sarp 2026-10-09).
    private var groups: [Group] {
        let rows = job.rows
        let byType = PlaceCategory.allCases.map { c in
            Group(id: c.rawValue, title: c.rawValue, category: c, rows: rows.filter { $0.status == .matched && $0.category == c })
        }
        return (byType + [
            Group(id: "finding", title: "Finding…", category: nil, rows: rows.filter { $0.status == .finding }),
            Group(id: "already", title: "Already in your list", category: nil, rows: rows.filter { $0.status == .already }),
            Group(id: "missing", title: "Couldn’t find these", category: nil, rows: rows.filter { $0.status == .missing }),
        ]).filter { !$0.rows.isEmpty }
    }

    // MARK: Import

    @ViewBuilder
    private var importButton: some View {
        let picked = job.picked.count
        let over = picked - ListImport.limit
        let done = job.importing && job.waitingCount == 0 && picked == 0
        Button {
            if done { dismiss() } else { job.startImport() }
        } label: {
            Text(
                done ? "Done · \(count(job.savedCount, "place")) imported"
                : job.importing ? "Importing… \(job.savedCount) done\(job.waitingCount > 0 ? ", \(job.waitingCount) still finding" : "")"
                : over > 0 ? "Untick \(over) to import (\(ListImport.limit) at most)"
                : picked == 0 ? "Nothing selected"
                : "Import \(count(picked, "place"))"
            )
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color(.systemBackground))
            .frame(maxWidth: .infinity).padding(.vertical, 15)
            .background(Color(.label), in: RoundedRectangle(cornerRadius: 16))
        }
        .disabled(!done && (job.importing || picked == 0 || over > 0))
        .opacity(!done && (picked == 0 || over > 0) ? 0.4 : 1)
        .padding(.horizontal, 16).padding(.bottom, 8)
    }
}

private func count(_ n: Int, _ word: String) -> String { "\(n) \(word)\(n == 1 ? "" : "s")" }

private struct GroupSection: View {
    let group: ImportView.Group
    let disabled: Bool
    private var job: ListImport { .shared }

    var body: some View {
        let open = group.rows.filter { $0.importable && $0.save == .idle }
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                if let category = group.category {
                    let all = !open.isEmpty && open.allSatisfy(\.picked)
                    Button { set(open, picked: !all) } label: { Check(on: all) }
                        .disabled(disabled || open.isEmpty)
                    category.icon.resizable().scaledToFit().frame(width: 28, height: 28)
                }
                (Text(group.title).fontWeight(.semibold) + Text(" · \(group.rows.count)").foregroundStyle(.tertiary))
                    .font(.subheadline)
                Spacer()
                if let category = group.category, !open.isEmpty {
                    MoveMenu(label: "Move all", current: category, disabled: disabled) { c in move(open, to: c) }
                }
            }
            .padding(.horizontal, 16)
            VStack(spacing: 0) {
                ForEach(Array(group.rows.enumerated()), id: \.element.id) { i, row in
                    ImportRowView(row: row, disabled: disabled)
                    if i < group.rows.count - 1 { Divider().padding(.leading, 16) }
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    private func set(_ rows: [ListImport.Row], picked: Bool) {
        for r in rows { if let i = job.rows.firstIndex(where: { $0.id == r.id }) { job.rows[i].picked = picked } }
    }
    private func move(_ rows: [ListImport.Row], to c: PlaceCategory) {
        for r in rows { if let i = job.rows.firstIndex(where: { $0.id == r.id }) { job.rows[i].category = c } }
    }
}

private struct ImportRowView: View {
    let row: ListImport.Row
    let disabled: Bool
    private var job: ListImport { .shared }

    var body: some View {
        let can = row.importable && row.save != .saved
        HStack(alignment: .top, spacing: 12) {
            if row.importable {
                Button { update { $0.picked.toggle() } } label: { Check(on: row.picked && can) }
                    .disabled(!can || disabled)
                    .padding(.top, 1)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(row.match?.name ?? row.name).font(.subheadline.weight(.medium)).lineLimit(1)
                if let place = row.match?.city ?? row.address {
                    Text(place).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                if let note = row.note {
                    Text("“\(note)”").font(.caption).italic().foregroundStyle(.secondary).lineLimit(2)
                }
                if row.save == .failed {
                    Text("Couldn't save. Try again.").font(.caption.weight(.medium)).foregroundStyle(.red)
                }
            }
            .opacity(row.importable || row.save == .saved ? 1 : 0.6)
            Spacer(minLength: 8)
            if row.save == .saved {
                Text("✓ Imported").font(.caption.weight(.medium)).foregroundStyle(.secondary)
            } else if row.status == .finding {
                ProgressView().controlSize(.mini)
            } else if can {
                MoveMenu(label: "Move", current: row.category, disabled: disabled) { c in update { $0.category = c } }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
    }

    private func update(_ change: (inout ListImport.Row) -> Void) {
        if let i = job.rows.firstIndex(where: { $0.id == row.id }) { change(&job.rows[i]) }
    }
}

/// The web's quiet "Move" pill: the system menu of types, minus the current one.
private struct MoveMenu: View {
    let label: String
    let current: PlaceCategory
    let disabled: Bool
    let onMove: (PlaceCategory) -> Void

    var body: some View {
        Menu {
            ForEach(PlaceCategory.allCases.filter { $0 != current }) { c in
                Button(c.rawValue) { onMove(c) }
            }
        } label: {
            Text(label).font(.caption.weight(.medium)).foregroundStyle(.secondary)
                .padding(.horizontal, 12).padding(.vertical, 4)
                .background(Color(.tertiarySystemFill), in: Capsule())
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
    }
}

private struct Check: View {
    let on: Bool
    var body: some View {
        Image(systemName: on ? "checkmark.square.fill" : "square")
            .font(.body)
            .foregroundStyle(on ? Color(.label) : Color(.tertiaryLabel))
    }
}
