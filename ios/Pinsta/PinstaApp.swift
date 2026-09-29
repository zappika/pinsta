import SwiftUI
import SwiftData

@main
struct PinstaApp: App {
    var body: some Scene {
        WindowGroup {
            PlacesListView()
                .preferredColorScheme(Settings.shared.appearance.scheme)
        }
        .modelContainer(Persistence.container)
    }
}
