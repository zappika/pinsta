import SwiftUI
import SwiftData
import CoreLocation

/// Thin wrapper: re-runs the query whenever the app comes back to the
/// foreground, so places saved by the share extension show up.
struct PlacesListView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var refreshID = UUID()

    var body: some View {
        PlacesContent()
            .id(refreshID)
            .onChange(of: scenePhase) { old, phase in
                // Only a real return from the background (share extension, other apps).
                // Dialogs and menus pass through .inactive and must not reset the screen.
                if phase == .active && old == .background { refreshID = UUID() }
            }
    }
}

private struct PlacesContent: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Place.createdAt, order: .reverse) private var places: [Place]

    @State private var city: String?
    @State private var category: PlaceCategory?
    @State private var adding = false
    /// Testing: `-addURL <link>` opens the save sheet with that link, the way a share arrives.
    @State private var launchURL = UserDefaults.standard.string(forKey: "addURL")
    private let settings = Settings.shared
    @State private var notice: String?
    @State private var noticeTask: Task<Void, Never>?

    private func showNotice(_ text: String, seconds: Double = ProcessInfo.processInfo.arguments.contains("-slowNotices") ? 30 : 5) {
        withAnimation(.snappy) { notice = text }
        noticeTask?.cancel()
        noticeTask = Task {
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            withAnimation(.snappy) { notice = nil }
        }
    }
    @State private var editing: Place?
    @State private var importing = false
    @State private var openSwipe: UUID?
    /// Which header picker is open: the web's sheet, not a system Menu.
    @State private var picking: Picking?
    private enum Picking { case city, category }

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

    // "Near me": located only when picked; never on launch.
    @State private var here: CLLocation?
    @State private var nearMe = NearMe()
    private var nearIDs: Set<UUID> {
        guard let here else { return [] }
        return Set(shown.filter { here.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude)) <= NearMe.km * 1000 }.map(\.id))
    }

    private var visible: [Place] {
        let labels = labels
        let near = city == NearMe.tag ? nearIDs : []
        return shown.filter { p in
            (city == nil || (city == NearMe.tag ? near.contains(p.id) : labels[p.id] == city))
                && (category == nil || p.category == category)
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
                if let notice {
                    Text(notice)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(white: 0.15), in: RoundedRectangle(cornerRadius: 16))
                        .padding(.horizontal, 20)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if let toast {
                    undoToast(toast)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                // One row: the view pill centred, the round + at the right edge (drawn
                // in an overlay above the save sheet, so it can turn into its ×).
                ZStack {
                    if !shown.isEmpty {
                        ViewSwitch(view: $view)
                            .opacity(adding ? 0 : 1)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 56)
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
                .background(bottomFade, alignment: .top)
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
                        AddPlaceView(initialURL: launchURL, onFinish: { adding = false; launchURL = nil })
                    }
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let peek, view != .cards {
                PeekCardView(place: peek) { withAnimation(.snappy) { self.peek = nil } }
                    .id(peek.id)
            }
        }
        .animation(.snappy, value: peek?.id)
        .overlay(alignment: .bottomTrailing) { if peek == nil || view == .cards { plusButton } }
        .overlay { picker }
        .animation(.snappy(duration: 0.25), value: picking)
        .animation(.snappy, value: notice)
        .sheet(isPresented: Bindable(settings).showingSheet) { SettingsSheet() }
        .confirmationDialog("Open directions in", isPresented: Bindable(settings).choosingOpen, titleVisibility: .visible) {
            ForEach(Settings.MapsApp.allCases, id: \.self) { app in
                Button(app.label) {
                    settings.pick(app)
                    showNotice("Saved \(app.label) as your default. You can change it anytime in Settings, top right.")
                }
            }
        }
        .animation(.snappy(duration: 0.3), value: adding)
        .animation(.snappy(duration: 0.3), value: editing?.id)
        .task {
            // No web import: the web list is Sarp's, and every install starts empty.
            // (WebImporter stays in the tree for a possible owner-only import later.)
            if launchURL != nil { adding = true }
            await PhotoRetry.run(in: context)
        }
        .onChange(of: city) { old, new in
            category = nil
            peek = nil
            guard new == NearMe.tag else { return }
            Task {
                if let fix = await nearMe.locate() {
                    here = fix
                } else {
                    city = old
                    showNotice("Location is off. Allow it for Vicolo in Settings to use Near me.")
                }
            }
        }
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
        } else if view == .list {
            ScrollView {
                PlaceListView(
                    places: visible,
                    selected: $peek,
                    hideCategory: category != nil,
                    hideCity: { city != nil && $0.city == city },
                    here: here
                )
                .padding(.bottom, 160)
            }
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
        let scoped = city == NearMe.tag ? shown.filter { nearIDs.contains($0.id) }
            : city == nil ? shown : shown.filter { labels[$0.id] == city }
        var counts: [PlaceCategory: Int] = [:]
        for p in scoped { counts[p.category, default: 0] += 1 }
        return PlaceCategory.allCases.compactMap { c in counts[c].map { (c, $0) } }
    }

    @ViewBuilder
    private var header: some View {
        if shown.isEmpty {
            // Settings (appearance, directions) are reachable before the first save too.
            HStack(alignment: .firstTextBaseline) {
                Text("Vicolo").font(.title.weight(.semibold))
                Spacer(minLength: 0)
                BuddyMenu()
                    .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 8 }
            }
            .padding(.top, 12)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Button { picking = .city } label: {
                    HStack(spacing: 6) {
                        if city == NearMe.tag { Image(systemName: "location.fill").font(.title3.weight(.semibold)).foregroundStyle(Color(.label)) }
                        headerLabel(city == NearMe.tag ? "Near me" : (city ?? "Everywhere"), muted: false)
                    }
                }
                .buttonStyle(.plain)
                .layoutPriority(1)

                Button { picking = .category } label: {
                    headerLabel(category?.plural ?? "Everything", muted: true)
                }
                .buttonStyle(.plain)
                Spacer(minLength: 0)
                BuddyMenu()
                    .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 8 }
            }
            .padding(.top, 12)
        }
    }

    @ViewBuilder
    private var picker: some View {
        switch picking {
        case .city: FilterPicker(title: "Where", options: whereOptions, onClose: { picking = nil })
        case .category: FilterPicker(title: "What", options: whatOptions, onClose: { picking = nil })
        case nil: EmptyView()
        }
    }

    private var whereOptions: [FilterPicker.Option] {
        var options: [FilterPicker.Option] = [
            FilterPicker.Option(id: "everywhere", label: "Everywhere", count: shown.count, selected: city == nil) { pick { city = nil } },
            FilterPicker.Option(id: NearMe.tag, label: "Near me", count: here == nil ? nil : nearIDs.count, locate: true, selected: city == NearMe.tag) { pick { city = NearMe.tag } },
        ]
        for (name, count) in destinations {
            options.append(FilterPicker.Option(id: "city-\(name)", label: name, count: count, selected: city == name) { pick { city = name } })
        }
        return options
    }

    private var whatOptions: [FilterPicker.Option] {
        let total = categories.reduce(0) { $0 + $1.1 }
        var options: [FilterPicker.Option] = [
            FilterPicker.Option(id: "everything", label: "Everything", count: total, selected: category == nil) { pick { category = nil } },
        ]
        for (cat, count) in categories {
            options.append(FilterPicker.Option(id: cat.rawValue, label: cat.plural, count: count, selected: category == cat) { pick { category = cat } })
        }
        return options
    }

    private func pick(_ change: () -> Void) {
        change()
        picking = nil
    }

    private func headerLabel(_ text: String, muted: Bool) -> some View {
        HStack(spacing: 4) {
            Text(text).lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.footnote.weight(.bold))
                .opacity(0.6)
        }
        // Scales down a little before truncating, so the buddy button fits beside it.
        .font(.title.weight(.semibold))
        .minimumScaleFactor(0.8)
        .foregroundStyle(muted ? Color.secondary : Color.primary)
        .layoutPriority(muted ? 0 : 1)
    }

    /// iOS hides a new share extension behind "More" until it is a favourite,
    /// so the first-run steps say how to pin it once.
    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Nothing saved yet").font(.title3.weight(.semibold))
            VStack(alignment: .leading, spacing: 12) {
                emptyStep(1, "In Instagram or TikTok, tap **Share** on a post of a place.")
                emptyStep(2, "First time only: scroll the app row to the end, tap **More**, and add **Vicolo** to Favorites.")
                emptyStep(3, "Tap **Vicolo**. The place lands here.")
            }
            Text("Or tap + and paste a link.").font(.subheadline).foregroundStyle(.tertiary)
        }
        .frame(maxWidth: 300, alignment: .leading)
        .frame(maxWidth: .infinity)
        .padding(.top, 96)
    }

    private func emptyStep(_ n: Int, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(n)")
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 20, height: 20)
                .background(Color(.tertiarySystemFill), in: Circle())
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 5 }
            Text(text).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Round +, springs on press, turns into × while the save sheet is open and closes it.
    private var plusButton: some View {
        Button {
            if adding || editing != nil { adding = false; editing = nil } else { adding = true }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .rotationEffect(.degrees(adding || editing != nil ? 135 : 0))
                .animation(.spring(response: 0.35, dampingFraction: 0.55), value: adding)
                .modifier(PlusLook())
        }
        .buttonStyle(PressSpring())
        .accessibilityLabel(adding || editing != nil ? "Close" : "Save a place")
        .padding(.trailing, 20)
        .padding(.bottom, 8)
    }

    private var bottomFade: some View {
        LinearGradient(
            colors: [Color(.systemGroupedBackground).opacity(0), Color(.systemGroupedBackground)],
            startPoint: .top, endPoint: .bottom
        )
        .frame(height: 96)
        .offset(y: -24)
        .opacity(view == .map || adding ? 0 : 1)
        .allowsHitTesting(false)
    }
}

/// The save sheet as the web has it: dimmed backdrop, tap outside to close,
/// a fixed-height card 12pt off the edges that rides up with the keyboard.
private struct FloatingSheet<Content: View>: View {
    let onClose: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)
                .transition(.opacity)
            content()
                .frame(height: AddPlaceView.sheetHeight)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 12)
                // Sits above the + (now ×), which stays on top to close it.
                .padding(.bottom, 76)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}

/// The round +: Liquid Glass on iOS 26, matching the view pill (Sarp,
/// 2026-10-01); the web's solid black circle below that.
private struct PlusLook: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .foregroundStyle(Color(.label))
                .frame(width: 56, height: 56)
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            content
                .foregroundStyle(Color(.systemBackground))
                .frame(width: 56, height: 56)
                .background(Color.primary, in: Circle())
                .shadow(color: .black.opacity(0.2), radius: 10, y: 4)
        }
    }
}

/// The + press: a quick squash and a springy release.
private struct PressSpring: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.5), value: configuration.isPressed)
    }
}
