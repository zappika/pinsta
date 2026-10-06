import SwiftUI

/// The round elephant button, top right: a short menu, like the web's. Settings
/// and Been there open as their own sheets; Import from Google is a roadmap placeholder
/// (plan.md: Menu, Settings and Imports). Accounts belong to the Social package.
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
                Label("Been there", systemImage: "checkmark.circle")
            }
            Button {
                settings.showingTutorial = true
            } label: {
                Label("How to save", systemImage: "questionmark.circle")
            }
            Button {} label: {
                Label("Import from Google", systemImage: "square.and.arrow.down")
                Text("Soon")
            }
            .disabled(true)
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
        .presentationDetents([.medium])
        // The sheet sits outside the app's root, so it takes the chosen appearance itself.
        .preferredColorScheme(settings.appearance.scheme)
    }
}
