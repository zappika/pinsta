import SwiftUI

/// The round "you" button, top right: appearance and the directions app today;
/// a home for account things later (accounts belong to the Social package).
struct BuddyMenu: View {
    private let settings = Settings.shared

    var body: some View {
        Menu {
            Picker("Appearance", selection: Bindable(settings).appearance) {
                ForEach(Settings.Appearance.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.menu)
            Button {
                settings.chooseAgain()
            } label: {
                Label("Directions: \(settings.mapsApp?.label ?? "Ask each time")", systemImage: "location.north")
            }
        } label: {
            Image(systemName: "person")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 36, height: 36)
                .background(Color(.tertiarySystemFill), in: Circle())
        }
        .accessibilityLabel("Menu")
    }
}
