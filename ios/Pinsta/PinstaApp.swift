import SwiftUI
import SwiftData
import UIKit

@main
struct PinstaApp: App {
    /// The system launch screen disappears on the first frame, too fast to read.
    /// The same art is drawn again on top, held a moment, then fades out.
    @State private var splash = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                PlacesListView()
                if splash {
                    SplashView()
                        .transition(.opacity.combined(with: .scale(scale: 1.06)))
                        .zIndex(1)
                }
            }
            .preferredColorScheme(Settings.shared.appearance.scheme)
            .task {
                try? await Task.sleep(for: .seconds(1.2))
                withAnimation(.easeOut(duration: 0.55)) { splash = false }
            }
        }
        .modelContainer(Persistence.container)
    }
}

/**
 * A copy of the launch screen (Info.plist `UILaunchScreen`): `Splash` at its own
 * size, centred over `SplashBackground`, edges cropped on smaller phones. It
 * follows the phone's appearance like the launch screen does, not the in-app
 * Appearance choice, so the hand-off doesn't flip from light to dark.
 */
private struct SplashView: View {
    private let system: ColorScheme = UIScreen.main.traitCollection.userInterfaceStyle == .dark ? .dark : .light

    var body: some View {
        ZStack {
            Color("SplashBackground")
            Image("Splash")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .ignoresSafeArea()
        .environment(\.colorScheme, system)
        .allowsHitTesting(false)
    }
}
