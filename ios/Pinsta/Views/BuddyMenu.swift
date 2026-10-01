import SwiftUI

/// The round "you" button, top right: a short menu, like the web's. Settings
/// open as their own sheet; Import from Google is a roadmap placeholder
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
            Button {} label: {
                Label("Import from Google", systemImage: "square.and.arrow.down")
                Text("Soon")
            }
            .disabled(true)
        } label: {
            // Explicit colour: a Menu label otherwise takes the tint, which vanished in dark.
            Image(systemName: "person")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color(.secondaryLabel))
                .frame(width: 36, height: 36)
                .background(Color(.tertiarySystemFill), in: Circle())
        }
        .accessibilityLabel("Menu")
    }
}

/// Per-device settings: the web's SettingsSheet, as a native half sheet.
/// Presented from the list's root (the header redraws, and took the sheet with it).
struct SettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    private let settings = Settings.shared

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
