import SwiftUI
import SwiftData
import UIKit

@main
struct PinstaApp: App {
    /// The splash shows once per cold launch; a return from the background
    /// keeps the process, so it never shows again then.
    @State private var splash = SplashView.shouldShow

    var body: some Scene {
        WindowGroup {
            ZStack {
                switch Persistence.opened {
                case .success(let container): PlacesListView().modelContainer(container)
                case .failure: StoreErrorView()
                }
                if splash {
                    // It fades itself out, then goes.
                    SplashView {
                        splash = false
                        Launch.shared.splashDone = true
                    }
                    .zIndex(1)
                }
            }
            // The in-app Appearance applies once the splash is gone: the splash follows
            // the phone (as the launch screen must), and the status bar should match it.
            .preferredColorScheme(splash ? nil : Settings.shared.appearance.scheme)
        }
    }
}
