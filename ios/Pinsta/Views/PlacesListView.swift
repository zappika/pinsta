import SwiftUI
import SwiftData
import CoreLocation

/// What the screen shows, kept outside the content so a refresh (which rebuilds
/// it) changes nothing you can see: filters, the open sheet, the location fix.
@Observable
final class Screen {
    var city: String?
    var category: PlaceCategory?
    /// A sub-row of the What menu (`Subtypes`), within `category`.
    var subtype: String?
    var adding = false
    var editing: Place?
    var here: CLLocation?
    /// The empty list's tutorial page, kept while the save sheet opens and closes.
    var tutorialPage = 0
    /// The tutorial sent them to Instagram; coming back with the list still empty means they got stuck.
    var wentToInstagram = false
    var leftForInstagram = false
    /// Back from Instagram with nothing saved: the tutorial shows the step they likely missed.
    var stuck = false
    /// `LocationPrimer` is up: the list reached `NearMe.askAfter` places, location never asked.
    var askingLocation = false
    /// The empty list's tutorial is what's on screen, not the chosen view.
    var tutorial = false
    /// Testing: `-addURL <link>` opens the save sheet with that link, the way a share arrives.
    var launchURL = TestArgs.string("addURL")
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
    @State private var clock = ScreenClock()

    var body: some View {
        PlacesContent(view: $view, started: $started, screen: screen)
            .id(refreshID)
            .onChange(of: scenePhase) { old, phase in
                // Only a real return from the background (share extension, other apps).
                // Dialogs and menus pass through .inactive and must not reset the screen.
                // Back from Instagram (it went through .background, whatever the last step was):
                // if a share landed, the list rebuilds and the tutorial goes; if not, it opens on
                // the Share to… page with a word about it.
                if phase == .background, screen.wentToInstagram { screen.leftForInstagram = true }
                if phase == .active, screen.leftForInstagram {
                    screen.wentToInstagram = false
                    screen.leftForInstagram = false
                    screen.stuck = true
                    screen.tutorialPage = 1
                }
                if phase == .active && old == .background { refreshIfShared() }
            }
            .onChange(of: screen.adding) { _, _ in refreshIfShared() }
            .onChange(of: screen.editing == nil) { _, _ in refreshIfShared() }
            // How the app is used (`Uses`): opens, and the seconds each screen is in front.
            .task { Uses.count("open"); tick() }
            .onChange(of: view) { _, _ in tick() }
            .onChange(of: screen.tutorial) { _, _ in tick() }
            .onChange(of: scenePhase) { old, phase in
                if phase == .active && old == .background { Uses.count("open") }
                tick()
                if phase == .background { Task { await Uses.flush() } }
            }
    }

    private func tick() {
        clock.set(screen.tutorial ? "tutorial" : view.rawValue, running: scenePhase != .background)
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \Place.createdAt, order: .reverse) private var places: [Place]

    let screen: Screen
    // The screen's state lives in `Screen`; these read like local state.
    private var city: String? { get { screen.city } nonmutating set { screen.city = newValue } }
    private var category: PlaceCategory? { get { screen.category } nonmutating set { screen.category = newValue; screen.subtype = nil } }
    private var subtype: String? { get { screen.subtype } nonmutating set { screen.subtype = newValue } }
    private var adding: Bool { get { screen.adding } nonmutating set { screen.adding = newValue } }
    private var editing: Place? { get { screen.editing } nonmutating set { screen.editing = newValue } }
    private var here: CLLocation? { get { screen.here } nonmutating set { screen.here = newValue } }
    private var launchURL: String? { get { screen.launchURL } nonmutating set { screen.launchURL = newValue } }
    private let settings = Settings.shared
    @State private var notice: String?
    @State private var noticeTask: Task<Void, Never>?

    private func showNotice(_ text: String, seconds: Double = TestArgs.has("-slowNotices") ? 30 : 5) {
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
    /// The + fans out its choices first; the save sheet opens on one (Sarp, 2026-10-16).
    @State private var fan = false
    @State private var addMode: AddPlaceView.AddMode = .post
    /// The locate button (Sarp, 2026-10-15, as the web): you at town size.
    @State private var goHere = 0
    @State private var locating = false

    private var labels: [UUID: String] { Grouping.destinationLabels(places) }
    private var shown: [Place] { places.filter { !hidden.contains($0.id) } }

    // Where you are: located on launch for the opening town and the map's frame (fix in `screen.here`).
    @State private var nearMe = NearMe()

    /// Everywhere on the map frames every place, like a saved map in Google Maps (port of the
    /// web, Sarp 2026-10-15: from Copenhagen, the nearest country was Norway with one bakery, and a
    /// tester read it as random). Only places worlds apart (`NearMe.spreadKm`, Japan and Spain) get
    /// one country: the one with most places. The others are a zoom out away.
    private var countries: [(name: String, places: [Place])] {
        Dictionary(grouping: visible) { CountryName.english($0.country) ?? "Elsewhere" }
            .map { (name: $0.key, places: $0.value) }
            .sorted { $0.places.count != $1.places.count ? $0.places.count > $1.places.count : $0.name < $1.name }
    }
    private var framed: (name: String, places: [Place])? {
        guard city == nil else { return nil }
        guard NearMe.spread(visible.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }) > NearMe.spreadKm else { return nil }
        let groups = countries
        return groups.count > 1 ? groups.first : nil
    }

    private var visible: [Place] {
        let labels = labels
        return shown.filter { p in
            (city == nil || labels[p.id] == city) && (category == nil || p.category == category) && (subtype == nil || p.subtypeRaw == subtype)
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
                        .transition(.fromBottom(reduceMotion: reduceMotion))
                }
                if let toast {
                    undoToast(toast)
                        .transition(.fromBottom(reduceMotion: reduceMotion))
                }
                // One row: the view pill centred, the round + at the right edge (drawn
                // in an overlay above the save sheet, so it can turn into its ×).
                ZStack {
                    if !shown.isEmpty {
                        ViewSwitch(view: $view)
                            .opacity(pillHidden ? 0 : 1)
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
                        newPlaceSheet
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
            plusLayer
        }
        .overlay { picker }
        .animation(.snappy(duration: 0.25), value: picking)
        .animation(.snappy, value: notice)
        .sheet(isPresented: Bindable(settings).showingSheet) { SettingsSheet() }
        .sheet(isPresented: Bindable(settings).showingBeenThere) { BeenThereSheet() }
        .sheet(isPresented: Bindable(settings).showingImport, onDismiss: clearImportLink, content: importSheet)
        .sheet(item: Bindable(settings).webPage) { WebPageView(page: $0).ignoresSafeArea() }
        .onAppear { if TestArgs.string("importURL") != nil { settings.showingImport = true } }
        .fullScreenCover(isPresented: Bindable(settings).showingTutorial) {
            TutorialCover()
                .preferredColorScheme(settings.appearance.scheme)
        }
        .fullScreenCover(isPresented: Bindable(screen).askingLocation, onDismiss: { Task { await goHere() } }) {
            LocationPrimer(places: Array(shown.prefix(2))) { screen.askingLocation = false }
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
            askIfDue()
            // Save reports the share extension couldn't send before it closed.
            Task { await SaveReport.flush() }
            Task { await Uses.flush() }
            await PhotoRetry.run(in: context)
            await PriceLookup.run(in: context)
            await EnglishNames.run(in: context)
        }
        .onChange(of: places.isEmpty) { _, _ in start() }
        .onChange(of: Launch.shared.splashDone) { _, _ in start() }
        .onChange(of: city) { _, _ in
            category = nil
            peek = nil
        }
        .onChange(of: category) { _, _ in peek = nil }
        // A place waiting behind the Undo toast is gone as far as a new save is
        // concerned: otherwise a new post could join it and be deleted with it.
        .onChange(of: adding) { _, open in if open { commitPending() } else { askIfDue() } }
        .onChange(of: editing == nil) { _, closed in if !closed { commitPending() } }
        .onChange(of: places.count) { _, _ in askIfDue() }
        .onChange(of: view) { _, _ in peek = nil }
        .onDisappear { commitPending() }
        // Leaving the app stops the Undo timer: off to Instagram to share the post again, the place was
        // still there and the share said "Already in Vicolo" (Sarp, 2026-10-16). Gone means gone.
        .onChange(of: scenePhase) { _, phase in if phase == .background { commitPending() } }
    }

    // MARK: - Opening screen

    /// The map of the town you're in (Sarp, 2026-10-09: no "Near me" row; it just opens
    /// on Barcelona in Barcelona): the Where row of your nearest place within `NearMe.km`.
    /// Offline → the list of everything. No location, or nothing within reach → the map
    /// of everything. Whatever was picked meanwhile wins. Once per launch, once there is a list and the splash is
    /// over. Location is asked here only from `NearMe.askAfter` places on (Sarp,
    /// 2026-10-05, two since 2026-10-15), and only after `LocationPrimer`; before that
    /// the map of everything opens, no question.
    private func start() {
        guard !started, !places.isEmpty, Launch.shared.splashDone else { return }
        started = true
        let toList = { if view == .map { view = .list } }
        Task {
            guard await NearMe.online() else { return toList() }
            // Not asked yet with a small list, or refused: the map of everything.
            switch nearMe.onOpen(placeCount: places.count) {
            case .locate: await goHere()
            case .ask: askIfDue()
            case .wait, .refused: break
            }
        }
    }

    /// Where you are, and the town of your nearest place as the Where row.
    private func goHere() async {
        guard let fix = await nearMe.locate() else { return }
        here = fix
        let nearest = shown
            .map { ($0, fix.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude))) }
            .filter { $0.1 <= NearMe.km * 1000 }
            .min { $0.1 < $1.1 }?.0
        if city == nil, let nearest, let town = labels[nearest.id] { city = town }
    }

    /// `LocationPrimer` once the list has reached `NearMe.askAfter` places and location was
    /// never asked: on open, after an in-app save once its success card has gone, or back
    /// from a share. Never over a sheet; a moment's pause so it doesn't snap in.
    private func askIfDue() {
        let busy = { adding || editing != nil || screen.askingLocation || settings.showingSheet
            || settings.showingBeenThere || settings.showingImport || settings.showingTutorial
            || settings.webPage != nil }
        guard started, !busy(), nearMe.onOpen(placeCount: places.count) == .ask else { return }
        Task {
            try? await Task.sleep(for: .seconds(0.6))
            guard !busy(), scenePhase == .active else { return }
            screen.askingLocation = true
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
        .onChange(of: shown.isEmpty, initial: true) { _, empty in screen.tutorial = empty }
    }

    @ViewBuilder
    private func content(_ v: PlacesView) -> some View {
        if shown.isEmpty {
            EmptyTutorial(
                page: Bindable(screen).tutorialPage,
                stuck: Bindable(screen).stuck,
                onInstagram: { screen.wentToInstagram = true },
                onPaste: { link in
                    screen.stuck = false
                    screen.launchURL = link
                    adding = true
                }
            )
                .ignoresSafeArea(.keyboard)
        } else if v == .map {
            PlacesMapView(places: visible, selected: $peek, focus: framed?.places, here: here, goHere: goHere)
                .ignoresSafeArea(edges: .bottom)
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

    private var scoped: [Place] {
        let labels = labels
        return city == nil ? shown : shown.filter { labels[$0.id] == city }
    }

    private var categories: [(PlaceCategory, Int)] {
        let scoped = scoped
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
        } else if dynamicTypeSize.isAccessibilitySize {
            // The largest text sizes: Where above What, or both shrank to "Every… E".
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    whereButton
                    whatButton
                }
                Spacer(minLength: 0)
                BuddyMenu()
            }
            .padding(.top, 12)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                whereButton
                    .layoutPriority(1)
                whatButton
                Spacer(minLength: 0)
                BuddyMenu()
                    .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 8 }
            }
            .padding(.top, 12)
        }
    }

    private var whatLabel: String { subtype.map { Subtypes.label($0) + "s" } ?? category?.plural ?? "Everything" }

    private var whereButton: some View {
        Button { picking = .city } label: {
            headerLabel(city ?? "Everywhere", muted: false)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Where: \(city ?? "Everywhere")")
    }

    private var whatButton: some View {
        Button { picking = .category } label: {
            headerLabel(whatLabel, muted: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("What: \(whatLabel)")
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
        let scoped = scoped
        for (cat, count) in categories {
            options.append(FilterPicker.Option(id: cat.rawValue, label: cat.plural, count: count, selected: category == cat && subtype == nil) { pick { category = cat } })
            for s in Subtypes.of(scoped, in: cat) {
                options.append(FilterPicker.Option(id: "\(cat.rawValue)/\(s.type)", label: s.label, count: s.count, sub: true, selected: subtype == s.type) { pick { category = cat; subtype = s.type } })
            }
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
        .minimumScaleFactor(dynamicTypeSize.isAccessibilitySize ? 0.6 : 0.8)
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

    /// The view pill steps aside for the save sheet and the + menu.
    private var pillHidden: Bool { adding || fan }

    private func importSheet() -> ImportView { ImportView(initialLink: settings.importLink) }
    private func clearImportLink() { settings.importLink = nil }

    /// The + menu under the +, so the + can close it.
    private var plusLayer: some View {
        ZStack(alignment: .bottomTrailing) {
            addMenu
            VStack(alignment: .trailing, spacing: 12) {
                if view == .map, !shown.isEmpty, !adding, !fan, editing == nil, peek == nil { locateButton }
                if (peek == nil || view == .cards) && (adding || editing != nil || !shown.isEmpty) { plusButton }
            }
        }
    }

    /// Round arrow above the +, like Google Maps: frames you and your surroundings. Location not
    /// asked yet → this tap is the ask, at any list size (the person asked for it).
    private var locateButton: some View {
        Button {
            guard !locating else { return }
            locating = true
            Task {
                defer { locating = false }
                if let fix = await nearMe.locate() {
                    here = fix
                    goHere += 1
                } else {
                    showNotice("Location is off for Vicolo. Turn it on in Settings → Vicolo → Location to see where you are.")
                }
            }
        } label: {
            Image(systemName: "location.fill")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color(red: 0.10, green: 0.45, blue: 0.91))
                .symbolEffect(.pulse, isActive: locating)
                .frame(width: 44, height: 44)
                .modifier(LocateLook())
        }
        .buttonStyle(PressSpring())
        .accessibilityLabel("Show where I am")
        .padding(.trailing, 26)
    }

    private var addMenu: AddMenu {
        AddMenu(open: fan, onClose: { fan = false }, onPick: pick)
    }

    private func pick(_ mode: AddPlaceView.AddMode) {
        fan = false
        addMode = mode
        adding = true
    }

    private var newPlaceSheet: AddPlaceView {
        AddPlaceView(initialURL: launchURL, onFinish: { adding = false; launchURL = nil },
                     mode: launchURL == nil ? addMode : .post, onList: handOff)
    }

    /// A Google Maps list pasted into the save sheet: Import reads it.
    private func handOff(_ link: String) {
        adding = false
        launchURL = nil
        settings.importLink = link
        settings.showingImport = true
    }

    /// Round +, springs on press, turns into × while the save sheet is open and closes it.
    private var plusButton: some View {
        Button {
            if adding || editing != nil { adding = false; editing = nil } else { fan.toggle() }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .rotationEffect(.degrees(adding || editing != nil || fan ? 135 : 0))
                .animation(.motion(.spring(response: 0.35, dampingFraction: 0.55), reduceMotion: reduceMotion), value: adding || fan)
                .modifier(PlusLook())
        }
        .buttonStyle(PressSpring())
        .accessibilityLabel(adding || editing != nil || fan ? "Close" : "Save a place")
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)
                .transition(.opacity)
            // The sheet sizes itself: fixed while saving, taller for the success card.
            content()
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 12)
                // Sits above the + (now ×), which stays on top to close it.
                .padding(.bottom, 76)
                .transition(.fromBottom(reduceMotion: reduceMotion))
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

/// The locate button: a small glass circle on iOS 26+, a white one below.
private struct LocateLook: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(), in: .circle)
        } else {
            content.background(Color(.systemBackground), in: Circle()).shadow(color: .black.opacity(0.12), radius: 8, y: 3)
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
