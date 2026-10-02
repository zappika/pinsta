import Foundation
import SwiftData
import SwiftUI

/// One store, shared by the app and the share extension through an App Group.
/// Local only for now; `cloudKitDatabase: .automatic` later for iCloud backup —
/// still no accounts, no login.
enum Persistence {
    static let appGroup = "group.se.sarper.vicolo"

    /// The shared store, or why it wouldn't open. Never a different store in its
    /// place: an empty stand-in looked like a lost list, and saves made into it
    /// vanished the next time the real one opened. Callers show the error instead.
    static let opened: Result<ModelContainer, Error> = open()

    private static func open() -> Result<ModelContainer, Error> {
        let schema = Schema([Place.self])
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) != nil else {
            // No App Group at all (unsigned dev build): a private store, so the app still runs.
            let local = ModelConfiguration("Pinsta", schema: schema, cloudKitDatabase: .none)
            return Result { try ModelContainer(for: schema, configurations: [local]) }
        }
        let shared = ModelConfiguration("Pinsta", schema: schema, groupContainer: .identifier(appGroup), cloudKitDatabase: .none)
        // Once more on failure: the store can be briefly busy while the extension has it open.
        if let container = try? ModelContainer(for: schema, configurations: [shared]) { return .success(container) }
        let second = Result { try ModelContainer(for: schema, configurations: [shared]) }
        if case .failure(let error) = second { NSLog("Persistence: shared store won't open: \(error)") }
        return second
    }

    /// When the share extension last saved, so the app refreshes only then.
    static var lastWrite: Double {
        UserDefaults(suiteName: appGroup)?.double(forKey: "lastWrite") ?? 0
    }

    /// Call after a save. Only the extension's saves count: the app sees its own.
    static func noteWrite() {
        guard Bundle.main.bundleURL.pathExtension == "appex" else { return }
        UserDefaults(suiteName: appGroup)?.set(Date.now.timeIntervalSince1970, forKey: "lastWrite")
    }
}

/// Shown instead of the list (and in the share card) when the store won't open.
/// Nothing is replaced or deleted, so the places are still there for the next try.
struct StoreErrorView: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 30))
                .foregroundStyle(.secondary)
            Text("Couldn't open your list").font(.headline)
            Text("Your places are still saved. Close Vicolo completely and open it again. If this keeps happening, restart the phone.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}
