import CoreLocation
import SwiftUI
import UIKit
import UserNotifications

/// Notifications the phone writes itself (Sarp, 2026-11-24): the list lives on the phone, so the
/// server has nothing to say. Each kind is written ahead with its trigger (a place, a time) and
/// rewritten on every open, so counts stay fresh; iOS shows it when the trigger comes, without
/// waking the app. Location triggers need only "While Using" (no background location).
///
/// Rules for every kind: two a week at most (a fired one is noticed on the next open, and while
/// two fired in the last 7 days nothing new is written), and one switch per kind in Settings.
/// Here, not in Services: the share extension doesn't need it.
@MainActor
enum Nudges {
    static let weekCap = 2
    private static var defaults: UserDefaults { .standard }

    // MARK: Switches (Settings → Notifications)

    static let welcomeKey = "vicolo.notify.welcome"
    static var welcomeOn: Bool { defaults.object(forKey: welcomeKey) as? Bool ?? true }

    // MARK: Written and fired

    /// What is written now, by identifier, with a signature of its content: unchanged ones aren't rewritten.
    private static let writtenKey = "vicolo.notify.written"
    /// When each one fired, by identifier (a month kept).
    private static let firedKey = "vicolo.notify.fired"

    private static var written: [String: String] {
        get { defaults.dictionary(forKey: writtenKey) as? [String: String] ?? [:] }
        set { defaults.set(newValue, forKey: writtenKey) }
    }
    private static var fired: [String: Date] {
        get { defaults.dictionary(forKey: firedKey) as? [String: Date] ?? [:] }
        set { defaults.set(newValue.filter { $0.value > .now.addingTimeInterval(-30 * 86400) }, forKey: firedKey) }
    }

    /// One written earlier that is no longer waiting has fired (each fires once): noted, and counted.
    private static func noteFired(pending: Set<String>) {
        var w = written, f = fired
        for id in w.keys where !pending.contains(id) {
            f[id] = .now
            w[id] = nil
            Uses.count("notify." + (id.split(separator: ".").first.map(String.init) ?? id))
        }
        written = w
        fired = f
    }

    private static var overWeekCap: Bool {
        fired.values.filter { $0 > .now.addingTimeInterval(-7 * 86400) }.count >= weekCap
    }

    static func notificationsAllowed() async -> Bool {
        let s = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        return s == .authorized || s == .provisional || s == .ephemeral
    }

    static var locationAllowed: Bool {
        let s = CLLocationManager().authorizationStatus
        return s == .authorizedWhenInUse || s == .authorizedAlways
    }

    // MARK: Rewrite

    private static var running = false

    /// On open, after a save, and on the way to the background. `labels` are the Where rows.
    static func refresh(places: [Place], labels: [UUID: String]) async {
        guard !running else { return }
        running = true
        defer { running = false }
        let center = UNUserNotificationCenter.current()
        let pending = Set(await center.pendingNotificationRequests().map(\.identifier))
        noteFired(pending: pending)

        var wanted: [String: UNNotificationRequest] = [:]
        if await notificationsAllowed(), locationAllowed, welcomeOn, !overWeekCap {
            let recent = Set(fired.filter { $0.value > .now.addingTimeInterval(-Welcome.again) }.keys)
            for w in Welcome.plan(places: places, labels: labels) where !recent.contains(w.id) {
                wanted[w.id] = await w.request()
            }
        }
        #if DEBUG
        // `-welcomeNow`: the first city's welcome in 5 seconds, to see it without travelling.
        if TestArgs.has("-welcomeNow"), let w = Welcome.plan(places: places, labels: labels).first {
            let r = await w.request(trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false))
            try? await center.add(UNNotificationRequest(identifier: "test." + w.id, content: r.content, trigger: r.trigger))
        }
        #endif

        var w = written
        // Also any of ours still waiting that this phone lost track of (settings reset, a reinstall).
        let gone = Set(w.keys).union(pending.filter { $0.hasPrefix("welcome.") }).filter { wanted[$0] == nil }
        center.removePendingNotificationRequests(withIdentifiers: Array(gone))
        for id in gone { w[id] = nil }
        for (id, request) in wanted {
            let sig = request.content.userInfo["sig"] as? String ?? ""
            guard w[id] != sig else { continue }
            center.removePendingNotificationRequests(withIdentifiers: [id])
            do {
                try await center.add(request)
                w[id] = sig
            } catch {
                print("nudges: not written", id, error.localizedDescription)
            }
        }
        written = w
    }

    /// A switch turned off: what it had written goes now, not on the next open.
    static func removeAll(prefix: String) async {
        let center = UNUserNotificationCenter.current()
        let ids = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
        written = written.filter { !$0.key.hasPrefix(prefix) }
    }

    // MARK: Asking

    private static let askedKey = "vicolo.notify.asked"

    /// The city to name when asking for notifications: the first time a city that isn't home (or where
    /// you are) has `Welcome.minPlaces`, with location already allowed and notifications never asked.
    static func cityToAsk(places: [Place], labels: [UUID: String]) async -> Welcome? {
        guard !defaults.bool(forKey: askedKey), locationAllowed,
              await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .notDetermined
        else { return nil }
        return Welcome.plan(places: places, labels: labels).first
    }

    static func markAsked() { defaults.set(true, forKey: askedKey) }

    /// The primer's Continue: the system's question.
    static func ask() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
    }
}

/// The town you're in on each day the app opens (the Where row of your nearest place within
/// `NearMe.km`, as the opening screen picks it), kept 30 days. Home is the one seen on most days.
@MainActor
enum HomeTown {
    private static let key = "vicolo.townByDay"
    private static var today: String { Date.now.formatted(.iso8601.year().month().day()) }

    private static var days: [String: String] {
        UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:]
    }

    static func saw(_ town: String) {
        let cutoff = Date.now.addingTimeInterval(-30 * 86400).formatted(.iso8601.year().month().day())
        var d = days.filter { $0.key >= cutoff }
        d[today] = town
        UserDefaults.standard.set(d, forKey: key)
    }

    /// Where the app opened today, if it knew.
    static var current: String? { days[today] }

    /// Seen on 3 days or more, and more than any other town.
    static var home: String? {
        let counts = Dictionary(grouping: days.values, by: { $0 }).mapValues(\.count)
        guard let best = counts.max(by: { $0.value < $1.value }), best.value >= 3 else { return nil }
        return best.key
    }
}

/// "🇮🇹 Benvenuti a Milano! 20 places you saved are here." (Sarp, 2026-11-24): an area around
/// a city's places, the notification written for it, shown by iOS when you arrive.
@MainActor
struct Welcome: Identifiable {
    /// A city counts from this many saved places.
    static let minPlaces = 3
    /// At most this many cities are watched (iOS watches 20 areas per app; the rest are for later kinds).
    static let maxCities = 10
    /// After a welcome, that city waits this long: one per trip.
    static let again: TimeInterval = 7 * 86400

    let label: String
    let places: [Place]
    let center: CLLocationCoordinate2D
    let radius: CLLocationDistance
    let countryCode: String?

    var id: String { "welcome." + label }

    /// The cities to watch: Where rows with `minPlaces`, most places first, not home and not
    /// where you are today (a welcome is for arriving).
    static func plan(places: [Place], labels: [UUID: String]) -> [Welcome] {
        let skip = Set([HomeTown.home, HomeTown.current].compactMap { $0 })
        let byLabel = Dictionary(grouping: places) { labels[$0.id] ?? "" }
        return byLabel
            .filter { !$0.key.isEmpty && !skip.contains($0.key) && $0.value.count >= minPlaces }
            .sorted { $0.value.count != $1.value.count ? $0.value.count > $1.value.count : $0.key < $1.key }
            .prefix(maxCities)
            .map { label, ps in
                let (center, radius) = area(ps)
                let countries = Dictionary(grouping: ps.compactMap { Flags.code(for: $0.country) }, by: { $0 })
                return Welcome(label: label, places: ps, center: center, radius: radius,
                               countryCode: countries.max { $0.value.count < $1.value.count }?.key)
            }
    }

    /// The area: around the place with most others within 15 km (a region row can be scattered),
    /// taking in the places within 30 km of it, 3 to 30 km across.
    static func area(_ ps: [Place]) -> (CLLocationCoordinate2D, CLLocationDistance) {
        let locs = ps.map { CLLocation(latitude: $0.latitude, longitude: $0.longitude) }
        let near = { (a: CLLocation) in locs.filter { $0.distance(from: a) <= 15_000 }.count }
        let hub = locs.max { near($0) < near($1) } ?? locs[0]
        let group = locs.filter { $0.distance(from: hub) <= 30_000 }
        let lat = group.map(\.coordinate.latitude).reduce(0, +) / Double(group.count)
        let lng = group.map(\.coordinate.longitude).reduce(0, +) / Double(group.count)
        let mid = CLLocation(latitude: lat, longitude: lng)
        let far = group.map { $0.distance(from: mid) }.max() ?? 0
        let cap = min(30_000, CLLocationManager().maximumRegionMonitoringDistance)
        return (mid.coordinate, min(max(far + 2_000, 3_000), cap))
    }

    /// The notification, with its area as trigger (or another, for testing).
    func request(trigger: UNNotificationTrigger? = nil) async -> UNNotificationRequest {
        let town = await Flags.localName(label, at: center, country: countryCode)
        let content = UNMutableNotificationContent()
        content.title = [Flags.flag(countryCode), Flags.greeting(town, country: countryCode, places: places)]
            .compactMap { $0 }.joined(separator: " ")
        content.body = "\(places.count) places you saved are here."
        content.sound = .default
        let photo = places.filter { $0.imageData != nil }.max { $0.createdAt < $1.createdAt }
        content.userInfo = [
            "welcomeCity": label,
            "sig": [content.title, content.body, String(format: "%.3f,%.3f", center.latitude, center.longitude),
                    "\(Int(radius))", photo?.id.uuidString ?? ""].joined(separator: "|"),
        ]
        if let photo, let attachment = Self.attachment(photo) { content.attachments = [attachment] }

        let region = CLCircularRegion(center: center, radius: radius, identifier: id)
        region.notifyOnEntry = true
        region.notifyOnExit = false
        return UNNotificationRequest(identifier: id, content: content,
                                     trigger: trigger ?? UNLocationNotificationTrigger(region: region, repeats: false))
    }

    /// The newest photo, small, as a file iOS takes in (it moves the file into its own store).
    private static func attachment(_ place: Place) -> UNNotificationAttachment? {
        guard let data = place.imageData, let image = UIImage(data: data),
              let jpeg = (image.preparingThumbnail(of: fit(image.size, 600)) ?? image).jpegData(compressionQuality: 0.8)
        else { return nil }
        let url = FileManager.default.temporaryDirectory.appending(path: "welcome-\(UUID().uuidString).jpg")
        guard (try? jpeg.write(to: url)) != nil else { return nil }
        return try? UNNotificationAttachment(identifier: "photo", url: url)
    }

    private static func fit(_ size: CGSize, _ side: CGFloat) -> CGSize {
        let scale = min(1, side / max(size.width, size.height, 1))
        return CGSize(width: size.width * scale, height: size.height * scale)
    }
}

/// The flag, the hello in the country's own language, and the city's own name for it.
@MainActor
enum Flags {
    /// "Italy" → "IT". Places keep the country's English name (`CountryName`).
    static func code(for country: String?) -> String? {
        guard let name = CountryName.english(country)?.lowercased() else { return nil }
        return table[name]
    }

    private static let table: [String: String] = {
        let en = Locale(identifier: "en")
        var out: [String: String] = [:]
        for region in Locale.Region.isoRegions where region.identifier.count == 2 {
            if let name = en.localizedString(forRegionCode: region.identifier) { out[name.lowercased()] = region.identifier }
        }
        return out
    }()

    /// "IT" → 🇮🇹.
    static func flag(_ code: String?) -> String? {
        guard let code, code.count == 2 else { return nil }
        let scalars = code.uppercased().unicodeScalars.compactMap { Unicode.Scalar(127_397 + $0.value) }
        return scalars.count == 2 ? String(String.UnicodeScalarView(scalars)) : nil
    }

    /// The hello, by country; the language its city names are asked in. Plural, as signs say it.
    /// Languages that bend the city's name (Finnish, Turkish, Polish…) say it in English instead.
    private static let hellos: [String: (format: String, language: String)] = {
        var h: [String: (String, String)] = [
            "IT": ("Benvenuti a %@!", "it"), "SM": ("Benvenuti a %@!", "it"), "VA": ("Benvenuti a %@!", "it"),
            "FR": ("Bienvenue à %@ !", "fr"), "MC": ("Bienvenue à %@ !", "fr"),
            "PT": ("Bem-vindos a %@!", "pt"), "BR": ("Bem-vindos a %@!", "pt-BR"),
            "DE": ("Willkommen in %@!", "de"), "AT": ("Willkommen in %@!", "de"),
            "NL": ("Welkom in %@!", "nl"),
            "SE": ("Välkommen till %@!", "sv"), "DK": ("Velkommen til %@!", "da"), "NO": ("Velkommen til %@!", "nb"),
            "AD": ("Benvinguts a %@!", "ca"),
        ]
        for c in ["ES", "MX", "AR", "CO", "CL", "PE", "UY", "CR", "EC"] { h[c] = ("¡Bienvenidos a %@!", "es") }
        return h
    }()

    /// In Catalonia, Catalan (Barcelona, Girona…).
    private static func hello(_ code: String?, places: [Place]) -> (format: String, language: String)? {
        guard let code else { return nil }
        if code == "ES", places.contains(where: { Grouping.regionName($0.region, country: $0.country) == "Catalonia" }) {
            return ("Benvinguts a %@!", "ca")
        }
        return hellos[code]
    }

    static func greeting(_ town: String, country: String?, places: [Place] = []) -> String {
        guard let hello = hello(country, places: places) else { return "Welcome to \(town)!" }
        return String(format: hello.format, town)
    }

    private static let namesKey = "vicolo.localNames"

    /// "Milan" → "Milano": the city's name in its own language, when Apple names the area's middle
    /// the same as the row in English (a travel area like "Costa Brava" keeps its row name). Asked once per row.
    static func localName(_ label: String, at center: CLLocationCoordinate2D, country: String?) async -> String {
        guard let language = hellos[country ?? ""]?.language else { return label }
        var cache = UserDefaults.standard.dictionary(forKey: namesKey) as? [String: String] ?? [:]
        if let known = cache[label] { return known }
        let at = CLLocation(latitude: center.latitude, longitude: center.longitude)
        let fold = { (s: String?) in s?.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil) }
        let english: CLPlacemark?
        do { english = try await CLGeocoder().reverseGeocodeLocation(at, preferredLocale: Locale(identifier: "en")).first }
        catch { return label }  // offline or throttled: asked again next time
        var name = label
        if fold(english?.locality) == fold(label) {
            try? await Task.sleep(for: .seconds(1))
            guard let local = try? await CLGeocoder().reverseGeocodeLocation(at, preferredLocale: Locale(identifier: language)).first
            else { return label }
            name = local.locality ?? label
        }
        cache[label] = name
        UserDefaults.standard.set(cache, forKey: namesKey)
        return name
    }
}

/// Before the system's notification question, the first time a city other than home reaches
/// `Welcome.minPlaces`: why, in that city's words. One button on to the system's question
/// (App Review 5.1.1, as `LocationPrimer`).
struct NotifyPrimer: View {
    let welcome: Welcome
    let onContinue: () -> Void
    @State private var town: String

    init(welcome: Welcome, onContinue: @escaping () -> Void) {
        self.welcome = welcome
        self.onContinue = onContinue
        _town = State(initialValue: welcome.label)
    }

    var body: some View {
        VStack(spacing: 0) {
            TutorialPage(
                title: "A hello in \(town)",
                subtitle: "When you arrive, Vicolo tells you the \(welcome.places.count) places you saved there.",
                caption: "Next, your iPhone asks to allow notifications. Two a week at most.",
                spoken: "When you arrive in \(town), Vicolo tells you the \(welcome.places.count) places you saved there. Next, your iPhone asks to allow notifications.",
                art: { art }
            )
            Button(action: onContinue) {
                Text("Continue")
                    .font(.headline)
                    .foregroundStyle(Tutorial.actionText)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Tutorial.action, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows the iPhone's question about notifications.")
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
        .padding(.top, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tutorial.background)
        .task { town = await Flags.localName(welcome.label, at: welcome.center, country: welcome.countryCode) }
    }

    /// The notification itself, as it will look on the Lock Screen.
    private var art: some View {
        ZStack {
            Tutorial.blush
            HStack(alignment: .top, spacing: 10) {
                Image("OnboardingAppIcon")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 38, height: 38)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text([Flags.flag(welcome.countryCode), Flags.greeting(town, country: welcome.countryCode, places: welcome.places)]
                        .compactMap { $0 }.joined(separator: " "))
                        .font(.subheadline.weight(.semibold))
                    Text("\(welcome.places.count) places you saved are here.")
                        .font(.subheadline)
                }
                .foregroundStyle(.primary)
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(Tutorial.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
            .padding(.horizontal, 24)
        }
        .accessibilityHidden(true)
    }
}
