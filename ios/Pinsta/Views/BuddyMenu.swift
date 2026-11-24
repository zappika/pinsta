import SwiftUI

/// The round elephant button, top right: a short menu, like the web's. Settings,
/// Timeline (Been there), Import from Google, What's new, Help and Privacy open as their own sheets. No red
/// dot for a new build any more (Sarp, 2026-11-24): the menu row still says which build is new. Accounts belong to the Social package.
struct BuddyMenu: View {
    private let settings = Settings.shared

    var body: some View {
        Menu {
            Button {
                settings.showingSheet = true
            } label: {
                Label("Settings", systemImage: "gearshape")
            }
            Button {
                settings.showingBeenThere = true
            } label: {
                Label("Timeline", systemImage: "checkmark.circle")
            }
            Button {
                settings.showingTutorial = true
            } label: {
                Label("How to save", systemImage: "questionmark.circle")
            }
            // Importing starts from the + menu (2026-10-16); while a list is being found on the
            // server, or waits for its review, the menu shows it and opens it (Sarp, 2026-10-19).
            if ListImport.shared.active, let job = ListImport.shared.job {
                Button {
                    settings.showingImport = true
                } label: {
                    Label("Import", systemImage: "square.and.arrow.down")
                    Text(job.ready ? "\(job.title ?? "Google list"): ready to review" : "\(job.title ?? "Google list"): \(job.done) of \(job.total)")
                }
            }
            Button {
                settings.openChangelog()
            } label: {
                Label("What's new", systemImage: "sparkles")
                if settings.changelogIsNew { Text("Build \(Settings.build)") }
            }
            // The App Store asks for both inside the app (guidelines 1.5 and 5.1.1).
            Section {
                Button {
                    settings.webPage = .support
                } label: {
                    Label("Help", systemImage: "lifepreserver")
                }
                Button {
                    settings.webPage = .privacy
                } label: {
                    Label("Privacy", systemImage: "hand.raised")
                }
            }
        } label: {
            // Explicit colour: a Menu label otherwise takes the tint, which vanished in dark.
            // The flat Vicolo mark (a template image, so it takes the ink), never the resin one at this size.
            Image("ElephantMark")
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .foregroundStyle(Color(.label))
                .frame(width: 44, height: 44)
                .background(Color(.tertiarySystemFill), in: Circle())
                .contentShape(Circle())
        }
        .accessibilityLabel("Menu")
    }
}

/// Per-device settings: the web's SettingsSheet, as a native half sheet.
/// Presented from the list's root (the header redraws, and took the sheet with it).
struct SettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    private let settings = Settings.shared
    /// Save reports and usage counts (`SaveReport.sharing`), on unless turned off. The App Group
    /// store, so the share extension reads the same switch.
    @AppStorage(SaveReport.sharingKey, store: UserDefaults(suiteName: Persistence.appGroup)) private var sharing = true

    /// "1.0 (8)", from the bundle, so it can't go stale.
    private static let version: String = {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(short) (\(build))"
    }()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Appearance", selection: Bindable(settings).appearance) {
                        ForEach(Settings.Appearance.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Appearance")
                } footer: {
                    Text("System follows your phone.")
                }
                Section {
                    Picker("Directions", selection: Bindable(settings).mapsApp) {
                        Text("Ask").tag(Settings.MapsApp?.none)
                        ForEach(Settings.MapsApp.allCases, id: \.self) { Text($0.label).tag(Settings.MapsApp?.some($0)) }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Directions")
                } footer: {
                    Text("Which app opens when you tap Directions on a place.")
                }
                // Guideline 5.1.1 (ii): anonymous usage data still needs a way to say no.
                Section {
                    Toggle("Help improve Vicolo", isOn: $sharing)
                        .onChange(of: sharing) { _, on in if !on { SaveReport.dropPending() } }
                } footer: {
                    Text("Sends how each save went (the link and the place found) and how often each view is used. Never your name, your list or where you are.")
                }
                Section {
                    HStack(spacing: 12) {
                        Image("ElephantResin")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 48, height: 48)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Vicolo").font(.subheadline.weight(.medium))
                            Text("A little collection of places.").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 8)
                        Text(Self.version).font(.caption.monospacedDigit()).foregroundStyle(.tertiary)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        // The sheet sits outside the app's root, so it takes the chosen appearance itself.
        .preferredColorScheme(settings.appearance.scheme)
    }
}
