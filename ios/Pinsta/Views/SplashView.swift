import SwiftUI
import UIKit

/// Whether the splash is over, so the app's own screen can start asking for
/// things (the location question waits for this).
@Observable
final class Launch {
    static let shared = Launch()
    var splashDone = !SplashView.shouldShow
}

/// The splash: a still (Sarp, 2026-10-05; the Take 1 movie is gone). The system
/// launch screen shows `VicoloSplashPoster` (LaunchScreen.storyboard); this view
/// draws the same picture over the app, holds it a moment, and fades out.
///
/// Light or dark is the phone's appearance at launch and stays fixed, like the
/// launch screen, so an opposite in-app Appearance can't flash.
struct SplashView: View {
    let onFinish: () -> Void

    /// Fixed once: UIScreen's style is the system's, untouched by the app's preferredColorScheme.
    private static let dark = UIScreen.main.traitCollection.userInterfaceStyle == .dark

    var body: some View {
        SplashStill(dark: Self.dark, onFinish: onFinish)
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    /// Not when the app opens straight into a save (`-addURL`, like a share).
    static var shouldShow: Bool {
        UserDefaults.standard.string(forKey: "addURL") == nil
    }
}

private struct SplashStill: UIViewRepresentable {
    let dark: Bool
    let onFinish: () -> Void

    func makeUIView(context: Context) -> SplashUIView {
        SplashUIView(dark: dark, onFinish: onFinish)
    }

    func updateUIView(_ view: SplashUIView, context: Context) {}

    static func dismantleUIView(_ view: SplashUIView, coordinator: ()) { view.stop() }
}

/// The poster, aspect fill to the screen edges exactly as the launch screen lays it
/// out, so the hand-off doesn't move.
final class SplashUIView: UIView {
    private let poster = UIImageView()
    private var timer: Timer?
    private var observer: NSObjectProtocol?
    private var onFinish: (() -> Void)?

    /// Long enough to read, short enough not to wait for.
    private static let hold: TimeInterval = 1.2

    init(dark: Bool, onFinish: @escaping () -> Void) {
        self.onFinish = onFinish
        super.init(frame: .zero)
        let traits = UITraitCollection(userInterfaceStyle: dark ? .dark : .light)
        backgroundColor = UIColor(named: "SplashBackground")?.resolvedColor(with: traits)
        poster.image = UIImage(named: "VicoloSplashPoster", in: nil, compatibleWith: traits)
        poster.contentMode = .scaleAspectFill
        poster.clipsToBounds = true
        addSubview(poster)

        // Testing (CLAUDE.md, "Splash assets"): keep the still up to compare with the launch screen.
        if ProcessInfo.processInfo.arguments.contains("-splashHold") { return }
        timer = Timer.scheduledTimer(withTimeInterval: Self.hold, repeats: false) { [weak self] _ in self?.finish() }
        // Sent to the background meanwhile: don't come back to it.
        observer = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.finish() }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func layoutSubviews() {
        super.layoutSubviews()
        poster.frame = bounds
    }

    /// Once only. The fade happens here, in UIKit: SwiftUI's removal transition never
    /// animated this view (measured with the movie, 2026-10-05).
    private func finish() {
        guard let done = onFinish else { return }
        onFinish = nil
        stop()
        guard window != nil else { DispatchQueue.main.async(execute: done); return }
        UIView.animate(withDuration: 0.45, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            self.alpha = 0
        } completion: { _ in done() }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
    }
}
