import SwiftUI
import SwiftData

@main
struct PinstaApp: App {
    let container: ModelContainer = {
        let schema = Schema([Place.self])
        // Local only for now. When the developer account exists, switch to
        // `cloudKitDatabase: .automatic` for iCloud backup — no accounts, no login.
        let config = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create model container: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            PlacesListView()
        }
        .modelContainer(container)
    }
}
