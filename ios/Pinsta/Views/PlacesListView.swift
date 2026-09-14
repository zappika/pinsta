import SwiftUI
import SwiftData

/// Thin wrapper: re-runs the query whenever the app comes back to the
/// foreground, so places saved by the share extension show up.
struct PlacesListView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var refreshID = UUID()

    var body: some View {
        PlacesContent()
            .id(refreshID)
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { refreshID = UUID() }
            }
    }
}

private struct PlacesContent: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Place.createdAt, order: .reverse) private var places: [Place]

    @State private var city: String?
    @State private var category: PlaceCategory?
    @State private var adding = false
    @State private var editing: Place?
    @State private var importing = false
    @State private var openSwipe: UUID?

    // How the selection is shown; the filters reset per launch, this doesn't.
    @AppStorage("pinsta.view") private var view: PlacesView = .cards
    @State private var peek: Place?

    // Removal is deferred behind an "Undo" toast; the row hides at once and
    // is deleted for real when the toast expires.
    @State private var hidden: Set<UUID> = []
    // Bumped on undo so the card comes back as a fresh view, not the one that flew off.
    @State private var generation: [UUID: Int] = [:]
    @State private var toast: Place?
    @State private var toastTask: Task<Void, Never>?

    private var labels: [UUID: String] { Grouping.destinationLabels(places) }
    private var shown: [Place] { places.filter { !hidden.contains($0.id) } }

    private var visible: [Place] {
        let labels = labels
        return shown.filter { p in
            (city == nil || labels[p.id] == city) && (category == nil || p.category == category)
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
                content
            }
            .background(Color(.systemGroupedBackground))

            VStack(spacing: 10) {
                if let peek, view != .cards {
                    PeekCardView(place: peek) { withAnimation(.snappy) { self.peek = nil } }
                }
                if let toast {
                    undoToast(toast)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if !shown.isEmpty {
                    ViewSwitch(view: $view)
                }
                saveButton
            }
            .animation(.snappy, value: toast?.id)
            .animation(.snappy, value: peek?.id)
        }
        .overlay {
            // Presented like the web (and the share extension): a dimmed backdrop
            // and a fixed-height card floating 12pt off the edges. Not a system
            // sheet — that one is edge to edge and adds its own chrome.
            if adding || editing != nil {
                FloatingSheet(onClose: { adding = false; editing = nil }) {
                    if let place = editing {
                        AddPlaceView(editing: place, onFinish: { editing = nil })
                    } else {
                        AddPlaceView(onFinish: { adding = false })
                    }
                }
            }
        }
        .animation(.snappy(duration: 0.3), value: adding)
        .animation(.snappy(duration: 0.3), value: editing?.id)
        .task {
            importing = true
            await WebImporter.runIfEmpty(in: context)
            importing = false
            await PhotoRetry.run(in: context)
        }
        .onChange(of: city) { _, _ in category = nil; peek = nil }
        .onChange(of: category) { _, _ in peek = nil }
        .onChange(of: view) { _, _ in peek = nil }
        .onDisappear { commitPending() }
    }

    // MARK: - Content: map, cards, or tiles

    @ViewBuilder
    private var content: some View {
        if importing && places.isEmpty {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(.secondarySystemGroupedBackground))
                            .frame(height: 112)
                    }
                }
                .padding(.horizontal, 20)
            }
        } else if shown.isEmpty {
            ScrollView { emptyState }
        } else if view == .map {
            PlacesMapView(places: visible, selected: $peek)
                .ignoresSafeArea(edges: .bottom)
        } else if visible.isEmpty {
            Text("No places match.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.top, 48)
            Spacer()
        } else if view == .tiles {
            ScrollView {
                PlaceTilesView(places: visible, selected: $peek)
                    .padding(.bottom, 160)
            }
        } else {
            cards
        }
    }

    private var cards: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(visible) { place in
                    SwipeCard(
                        isOpen: openSwipe == place.id,
                        onOpen: { openSwipe = place.id },
                        onClose: { if openSwipe == place.id { openSwipe = nil } },
                        onEdit: { openSwipe = nil; editing = place },
                        onDelete: { remove(place) }
                    ) {
                        PlaceCardView(
                            place: place,
                            hideCategory: category != nil,
                            // A region row ("Halland") still wants the town on the card.
                            hideCity: city != nil && place.city == city
                        )
                    }
                    .id("\(place.id)-\(generation[place.id] ?? 0)")
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 160)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Remove / undo

    private func remove(_ place: Place) {
        commitPending()
        hidden.insert(place.id)
        openSwipe = nil
        toast = place
        toastTask = Task {
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            commit(place)
        }
    }

    private func undo() {
        guard let place = toast else { return }
        toastTask?.cancel()
        toastTask = nil
        hidden.remove(place.id)
        generation[place.id, default: 0] += 1
        toast = nil
    }

    private func commit(_ place: Place) {
        context.delete(place)
        try? context.save()
        hidden.remove(place.id)
        if toast?.id == place.id { toast = nil }
    }

    private func commitPending() {
        guard let place = toast else { return }
        toastTask?.cancel()
        commit(place)
    }

    private func undoToast(_ place: Place) -> some View {
        HStack(spacing: 12) {
            Text("Removed \(place.name)").lineLimit(1)
            Spacer(minLength: 0)
            Button("Undo", action: undo)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(red: 1, green: 0.8, blue: 0.3))
        }
        .font(.subheadline)
        .foregroundStyle(.white)
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(Color(white: 0.15), in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 20)
    }

    // MARK: - Header: "Barcelona ▾  Restaurants ▾"

    private var destinations: [(String, Int)] {
        let labels = labels
        var counts: [String: Int] = [:]
        for p in shown { if let l = labels[p.id] { counts[l, default: 0] += 1 } }
        return counts.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
    }

    private var categories: [(PlaceCategory, Int)] {
        let labels = labels
        let scoped = city == nil ? shown : shown.filter { labels[$0.id] == city }
        var counts: [PlaceCategory: Int] = [:]
        for p in scoped { counts[p.category, default: 0] += 1 }
        return PlaceCategory.allCases.compactMap { c in counts[c].map { (c, $0) } }
    }

    @ViewBuilder
    private var header: some View {
        if shown.isEmpty {
            Text("Pinsta")
                .font(.title.weight(.semibold))
                .padding(.top, 12)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Menu {
                    Picker("Where", selection: $city) {
                        Label("Everywhere · \(shown.count)", systemImage: "globe").tag(String?.none)
                        ForEach(destinations, id: \.0) { name, count in
                            Text("\(name) · \(count)").tag(String?.some(name))
                        }
                    }
                } label: {
                    headerLabel(city ?? "Everywhere", muted: false)
                }

                Menu {
                    Picker("What", selection: $category) {
                        Text("Everything · \(categories.reduce(0) { $0 + $1.1 })").tag(PlaceCategory?.none)
                        ForEach(categories, id: \.0) { cat, count in
                            Text("\(cat.plural) · \(count)").tag(PlaceCategory?.some(cat))
                        }
                    }
                } label: {
                    headerLabel(category?.plural ?? "Everything", muted: true)
                }
                Spacer(minLength: 0)
            }
            .padding(.top, 12)
        }
    }

    private func headerLabel(_ text: String, muted: Bool) -> some View {
        HStack(spacing: 4) {
            Text(text).lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.footnote.weight(.bold))
                .opacity(0.6)
        }
        .font(.title.weight(.semibold))
        .foregroundStyle(muted ? Color.secondary : Color.primary)
    }

    private var emptyState: some View {
        VStack(spacing: 4) {
            Text("Nothing saved yet").font(.headline)
            Text("Paste an Instagram post and pin the place it shows.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 96)
    }

    private var saveButton: some View {
        Button {
            adding = true
        } label: {
            Text("Save a place")
                .font(.body.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.primary, in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(Color(.systemBackground))
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .background(
            LinearGradient(
                colors: [Color(.systemGroupedBackground).opacity(0), Color(.systemGroupedBackground)],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 96)
            .offset(y: -8)
            .opacity(view == .map ? 0 : 1),
            alignment: .top
        )
    }
}

/// The save sheet as the web has it: dimmed backdrop, tap outside to close,
/// a fixed-height card 12pt off the edges that rides up with the keyboard.
private struct FloatingSheet<Content: View>: View {
    let onClose: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)
                .transition(.opacity)
            content()
                .frame(height: AddPlaceView.sheetHeight)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}
