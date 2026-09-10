import Foundation
import SwiftData

/// One store, shared by the app and the share extension through an App Group.
/// Local only for now; `cloudKitDatabase: .automatic` later for iCloud backup —
/// still no accounts, no login.
enum Persistence {
    static let appGroup = "group.se.sarper.pinsta"

    static let container: ModelContainer = {
        let schema = Schema([Place.self])
        // Shared store lives in the App Group so the share extension sees it.
        if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) != nil {
            let shared = ModelConfiguration(
                "Pinsta",
                schema: schema,
                groupContainer: .identifier(appGroup),
                cloudKitDatabase: .none
            )
            if let container = try? ModelContainer(for: schema, configurations: [shared]) {
                return container
            }
        }
        // No App Group available (e.g. unsigned build): private store, app still works.
        let local = ModelConfiguration("Pinsta", schema: schema, cloudKitDatabase: .none)
        do {
            return try ModelContainer(for: schema, configurations: [local])
        } catch {
            fatalError("Could not create model container: \(error)")
        }
    }()
}
