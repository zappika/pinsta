import SwiftUI
import SwiftData

@main
struct PinstaApp: App {
    var body: some Scene {
        WindowGroup {
            PlacesListView()
        }
        .modelContainer(Persistence.container)
    }
}
