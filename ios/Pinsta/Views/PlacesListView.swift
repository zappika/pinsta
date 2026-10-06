import SwiftUI
import SwiftData
import CoreLocation

/// What the screen shows, kept outside the content so a refresh (which rebuilds
/// it) changes nothing you can see: filters, the open sheet, the location fix.
@Observable
final class Screen {
    var city: String?
    var category: PlaceCategory?
    var adding = false
    var editing: Place?
    var here: CLLocation?
    /// Everywhere on the map: the country picked from the chips (nil = the automatic one).
    var country: String?
    /// The empty list's tutorial page, kept while the save sheet opens and closes.
    var tutorialPage = 0
    /// Testing: `-addURL <link>` opens the save sheet with that link, the way a share arrives.
    var launchURL = UserDefaults.standard.string(forKey: "addURL")
}

/// Thin wrapper: re-runs the query when the app comes back to the foreground
/// after the share extension saved something, so that save shows up.
struct PlacesListView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var refreshID = UUID()
    // Kept out here so a refresh keeps the chosen view and does not run the opening screen again.
    @State private var view: PlacesView = .map
    @State private var started = false
    @State private var screen = Screen()
    /// The extension's last write that this list has seen (`Persistence.lastWrite`).
    @State private var seenWrite = Persistence.lastWrite

    var body: some View {
        PlacesContent(view: $view, started: $started, screen: screen)
            .id(refreshID)
            .onChange(of: scenePhase) { old, phase in
                // Only a real return from the background (share extension, other apps).
                // Dialogs and menus pass through .inactive and must not reset the screen.
                if phase == .active && old == .background { refreshIfShared() }
            }
            .onChange(of: screen.adding) { _, _ in refreshIfShared() }
            .onChange(of: screen.editing == nil) { _, _ in refreshIfShared() }
    }

    /// Rebuild only for a share that landed meanwhile, and never under an open sheet;
    /// closing the sheet tries again. Each rebuild also re-runs the photo and price passes.
    private func refreshIfShared() {
        guard scenePhase == .active, !screen.adding, screen.editing == nil else { return }
        let last = Persistence.lastWrite
        guard last != seenWrite else { return }
        seenWrite = last
        refreshID = UUID()
    }
}

private struct PlacesContent: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Place.createdAt, order: .reverse) private var places: [Place]

    let screen: Screen
    // The screen's state lives in `Screen`; these read like local state.
    private var city: String? { get { screen.city } nonmutating set { screen.city = newValue } }
    private var category: PlaceCategory? { get { screen.category } nonmutating set { screen.category = newValue } }
    private var adding: Bool { get { screen.adding } nonmutating set { screen.adding = newValue } }
    private var editing: Place? { get { screen.editing } nonmutating set { screen.editing = newValue } }
    private var here: CLLocation? { get { screen.here } nonmutating set { screen.here = newValue } }
    private var launchURL: String? { get { screen.launchURL } nonmutating set { screen.launchURL = newValue } }
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
    @State private var openSwipe: UUID?
    /// Which header picker is open: the web's sheet, not a system Menu.
    @State private var picking: Picking?
    private enum Picking { case city, category }

    // How the selection is shown. Every launch opens on the map of what is near (see start()).
    @Binding var view: PlacesView
    @Binding var started: Bool

    init(view: Binding<PlacesView>, started: Binding<Bool>, screen: Screen) {
        _view = view
        _started = started
        self.screen = screen
    }
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

    // "Near me": located on launch for the opening screen, or when picked (fix in `screen.here`).
    @State private var nearMe = NearMe()
    private var nearIDs: Set<UUID> {
        guard let here else { return [] }
        return Set(shown.filter { here.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude)) <= NearMe.km * 1000 }.map(\.id))
    }

    /// Everywhere on the map frames one country, not the world (port of the web,
    /// 2026-10-06): the one with most places, or with a location fix the nearest.
    private var countries: [(name: String, places: [Place])] {
        Dictionary(grouping: visible) { CountryName.english($0.country) ?? "Elsewhere" }
            .map { (name: $0.key, places: $0.value) }
            .sorted { $0.places.count != $1.places.count ? $0.places.count > $1.places.count : $0.name < $1.name }
    }
    private var framed: (name: String, places: [Place])? {
        let groups = countries
        guard city == nil, groups.count > 1 else { return nil }
        if let picked = groups.first(where: { $0.name == screen.country }) { return picked }
        guard let here else { return groups.first }
        func away(_ g: (name: String, places: [Place])) -> CLLocationDistance {
            g.places.map { here.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude)) }.min() ?? .infinity
        }
        return groups.min { away($0) < away($1) }
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
            // Only the save sheet follows the keyboard. The map, the bar and the
            // toasts behind its dim stay put; them resizing too made the sheet jump.
            page(view)
                .ignoresSafeArea(.keyboard)

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
            .ignoresSafeArea(.keyboard)
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
                PeekCardView(
                    place: peek,
                    onClose: { withAnimation(.snappy) { self.peek = nil } },
                    onEdit: { self.peek = nil; editing = peek },
                    onDelete: { self.peek = nil; remove(peek) }
                )
                .id(peek.id)
            }
        }
        .animation(.snappy, value: peek?.id)
        .overlay(alignment: .bottomTrailing) {
            // Its own glass circle beside the view pill, as on the web; not a tab
            // bar item (the system TabView of build 6+ merged them, Sarp disliked it).
            // The empty list has its own "Paste a link", so no + there, only the ×.
            if (peek == nil || view == .cards) && (adding || editing != nil || !shown.isEmpty) { plusButton }
        }
        .overlay { picker }
        .animation(.snappy(duration: 0.25), value: picking)
        .animation(.snappy, value: notice)
        .sheet(isPresented: Bindable(settings).showingSheet) { SettingsSheet() }
        .fullScreenCover(isPresented: Bindable(settings).showingTutorial) {
            TutorialCover(onPaste: { settings.showingTutorial = false; adding = true })
                .preferredColorScheme(settings.appearance.scheme)
        }
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
            if launchURL != nil { adding = true }
            start()
            await PhotoRetry.run(in: context)
            await PriceLookup.run(in: context)
        }
        .onChange(of: places.isEmpty) { _, _ in start() }
        .onChange(of: Launch.shared.splashDone) { _, _ in start() }
        .onChange(of: city) { old, new in
            category = nil
            peek = nil
            // The opening screen may already have a fix.
            guard new == NearMe.tag, here == nil else { return }
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
        // A place waiting behind the Undo toast is gone as far as a new save is
        // concerned: otherwise a new post could join it and be deleted with it.
        .onChange(of: adding) { _, open in if open { commitPending() } }
        .onChange(of: editing == nil) { _, closed in if !closed { commitPending() } }
        .onChange(of: view) { _, _ in peek = nil }
        .onDisappear { commitPending() }
    }

    // MARK: - Opening screen

    /// The map, Near me. Offline or no location → the list of everything.
    /// Nothing within reach → the map of everything. Whatever was picked
    /// meanwhile wins. Once per launch, once there is a list and the splash is
    /// over. Location is asked here only from `NearMe.askAfter` places on (Sarp,
    /// 2026-10-05); before that the map of everything opens, no question.
    private func start() {
        guard !started, !places.isEmpty, Launch.shared.splashDone else { return }
        started = true
        let toList = { if view == .map { view = .list } }
        Task {
            guard await NearMe.online() else { return toList() }
            switch nearMe.onOpen(placeCount: places.count) {
            case .wait: return  // the map of everything, no question yet
            case .refused: return toList()
            case .locate: break
            }
            guard let fix = await nearMe.locate() else { return toList() }
            here = fix
            if shown.contains(where: { fix.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude)) <= NearMe.km * 1000 }) {
                if city == nil { city = NearMe.tag }
            } else {
                showNotice("Nothing saved within \(Int(NearMe.km)) km, so here is everything.")
            }
        }
    }

    // MARK: - Content: map, cards, or tiles

    private func page(_ v: PlacesView) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
            content(v)
        }
        .background(shown.isEmpty ? Tutorial.background : Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private func content(_ v: PlacesView) -> some View {
        if shown.isEmpty {
            EmptyTutorial(page: Bindable(screen).tutorialPage, onPaste: { adding = true })
                .ignoresSafeArea(.keyboard)
        } else if v == .map {
            PlacesMapView(places: visible, selected: $peek, focus: framed?.places)
                .ignoresSafeArea(edges: .bottom)
                .overlay(alignment: .top) {
                    if let framed {
                        CountryChips(groups: countries, current: framed.name) { picked in
                            withAnimation(.snappy) { peek = nil }
                            screen.country = picked
                        }
                    }
                }
        } else if visible.isEmpty {
            ScrollView { noMatchState }
        } else if v == .list {
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
        } else if v == .tiles {
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
        let near = city == NearMe.tag ? nearIDs : []  // once, not per place
        let scoped = city == NearMe.tag ? shown.filter { near.contains($0.id) }
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

    /// Places exist, but not for this Where · What. The cup for cafés, else the elephant.
    private var noMatchState: some View {
        VStack(spacing: 0) {
            Image(category == .cafe ? "BrandCoffee" : "ElephantResin")
                .resizable()
                .scaledToFit()
                .frame(width: 112, height: 112)
                .accessibilityHidden(true)
            Text("No places here yet")
                .font(.headline)
                .padding(.top, 16)
            Text("Try another area or clear your filters.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.top, 8)
            Button("Show all places") { city = nil; category = nil }
                .font(.subheadline.weight(.medium))
                .underline()
                .foregroundStyle(Color(.label))
                .frame(minHeight: 44)
                .padding(.horizontal, 16)
                .padding(.top, 4)
        }
        .frame(maxWidth: 280)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 20)
        .padding(.top, 40)
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

    /// Below iOS 26: a fade so cards don't run into the material pill. On 26+
    /// none: glass needs the content behind it, and the opaque fade made the
    /// pill read as a flat white capsule (Sarp, build 4 on iOS 27).
    @ViewBuilder
    private var bottomFade: some View {
        if #unavailable(iOS 26) { fade }
    }

    private var fade: some View {
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

/// Over the map on Everywhere: one chip per country, the framed one dark; a tap
/// frames it (web: CountryChips). Scrolls sideways when there are many.
private struct CountryChips: View {
    let groups: [(name: String, places: [Place])]
    let current: String
    let onPick: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(groups, id: \.name) { g in
                    let on = g.name == current
                    Button { onPick(g.name) } label: {
                        HStack(spacing: 4) {
                            Text(g.name)
                            Text("\(g.places.count)").foregroundStyle(on ? Color(.systemBackground).opacity(0.6) : .secondary)
                        }
                        .font(.caption.weight(.medium))
                        .foregroundStyle(on ? Color(.systemBackground) : .primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(on ? AnyShapeStyle(Color.primary) : AnyShapeStyle(.regularMaterial), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        // Only as tall as the chips: a scroll view fills the height it is offered,
        // and over the map that swallowed every tap on a pin.
        .fixedSize(horizontal: false, vertical: true)
    }
}
