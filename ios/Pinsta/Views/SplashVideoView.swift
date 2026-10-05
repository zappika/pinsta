import SwiftUI
import AVFoundation
import UIKit

/// The animated splash (Take 1, ~4 s). The system launch screen shows the movie's
/// first frame (LaunchScreen.storyboard); this view takes over with that same frame,
/// plays the movie over it once, silently, and calls `onFinish` at the end.
///
/// Light or dark is the phone's appearance at launch and stays fixed for the whole
/// movie, like the launch screen, so an opposite in-app Appearance can't flash.
/// Anything that goes wrong (no file, a failed or stalled movie) finishes at once,
/// and a hard timeout means the splash can never keep you out of the app.
/// Whether the splash is over, so the app's own screen can start asking for
/// things (the location question waits for this).
@Observable
final class Launch {
    static let shared = Launch()
    var splashDone = !SplashVideoView.shouldPlay
}

struct SplashVideoView: View {
    let onFinish: () -> Void

    /// Fixed once: UIScreen's style is the system's, untouched by the app's preferredColorScheme.
    private static let dark = UIScreen.main.traitCollection.userInterfaceStyle == .dark

    var body: some View {
        SplashPlayer(dark: Self.dark, onFinish: onFinish)
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    /// Play only when it makes sense: not with Reduce Motion, not when the app opens
    /// straight into a save (`-addURL`, like a share), and only if the movie is there.
    static var shouldPlay: Bool {
        !UIAccessibility.isReduceMotionEnabled
            && UserDefaults.standard.string(forKey: "addURL") == nil
            && movieURL(dark: dark) != nil
    }

    static func movieURL(dark: Bool) -> URL? {
        Bundle.main.url(forResource: dark ? "vicolo-splash-dark" : "vicolo-splash-light", withExtension: "mp4")
    }
}

private struct SplashPlayer: UIViewRepresentable {
    let dark: Bool
    let onFinish: () -> Void

    func makeUIView(context: Context) -> SplashUIView {
        SplashUIView(dark: dark, onFinish: onFinish)
    }

    func updateUIView(_ view: SplashUIView, context: Context) {}

    static func dismantleUIView(_ view: SplashUIView, coordinator: ()) { view.stop() }
}

/// The poster (the movie's first frame, as on the launch screen) with the movie's
/// layer above it, both aspect fill to the screen edges so the hand-off doesn't move.
final class SplashUIView: UIView {
    private let poster = UIImageView()
    private let player = AVPlayer()
    private let movieLayer = AVPlayerLayer()
    private var observers: [NSObjectProtocol] = []
    private var readyWatch: NSKeyValueObservation?
    private var statusWatch: NSKeyValueObservation?
    private var timeout: Timer?
    private var onFinish: (() -> Void)?

    /// How long the poster may wait for the movie's first frame before the app opens
    /// without it, and how long the 4.04 s movie may then run. Two limits, so a slow
    /// first frame (a cold first launch) can't cut the movie off halfway.
    private static let firstFrameLimit: TimeInterval = 4
    private static let playLimit: TimeInterval = 6

    init(dark: Bool, onFinish: @escaping () -> Void) {
        self.onFinish = onFinish
        super.init(frame: .zero)
        backgroundColor = UIColor(named: "SplashBackground")?.resolvedColor(with: UITraitCollection(userInterfaceStyle: dark ? .dark : .light))

        poster.image = UIImage(named: "VicoloSplashPoster", in: nil, compatibleWith: UITraitCollection(userInterfaceStyle: dark ? .dark : .light))
        poster.contentMode = .scaleAspectFill
        poster.clipsToBounds = true
        addSubview(poster)

        movieLayer.player = player
        movieLayer.videoGravity = .resizeAspectFill
        movieLayer.opacity = 0
        layer.addSublayer(movieLayer)

        guard let url = SplashVideoView.movieURL(dark: dark) else { finish(); return }
        // Silent and polite: never pause the music someone is listening to.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers)
        player.isMuted = true
        player.preventsDisplaySleepDuringVideoPlayback = false
        player.actionAtItemEnd = .pause
        let item = AVPlayerItem(url: url)
        player.replaceCurrentItem(with: item)

        // The poster stays until the movie has a frame to show; then they swap in place.
        readyWatch = movieLayer.observe(\.isReadyForDisplay, options: [.initial, .new]) { [weak self] layer, _ in
            guard layer.isReadyForDisplay else { return }
            DispatchQueue.main.async { self?.start() }
        }
        statusWatch = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            if item.status == .failed { DispatchQueue.main.async { self?.finish() } }
        }
        let center = NotificationCenter.default
        for name in [AVPlayerItem.didPlayToEndTimeNotification, AVPlayerItem.failedToPlayToEndTimeNotification] {
            observers.append(center.addObserver(forName: name, object: item, queue: .main) { [weak self] _ in self?.finish() })
        }
        // Sent to the background mid-movie (a call, the home gesture): don't come back to it.
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.finish() })
        timeout = Timer.scheduledTimer(withTimeInterval: Self.firstFrameLimit, repeats: false) { [weak self] _ in self?.finish() }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    override func layoutSubviews() {
        super.layoutSubviews()
        poster.frame = bounds
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        movieLayer.frame = bounds
        CATransaction.commit()
    }

    private var started = false

    private static func testing(_ flag: String) -> Bool { ProcessInfo.processInfo.arguments.contains(flag) }

    private func start() {
        guard !started, onFinish != nil else { return }
        // Testing the colour match (CLAUDE.md, "Splash assets"): hold the poster, or the movie's first frame.
        if Self.testing("-splashPosterOnly") { timeout?.invalidate(); return }
        started = true
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        movieLayer.opacity = 1
        CATransaction.commit()
        if Self.testing("-splashFrozen") { timeout?.invalidate(); return }
        player.play()
        timeout?.invalidate()
        timeout = Timer.scheduledTimer(withTimeInterval: Self.playLimit, repeats: false) { [weak self] _ in self?.finish() }
    }

    /// Once only, whatever calls it first (end, failure, background, timeout).
    /// The fade happens here, in UIKit: SwiftUI's removal transition never animated
    /// this view, so the movie cut to the app in one frame (measured, 2026-10-05).
    private func finish() {
        guard let done = onFinish else { return }
        onFinish = nil
        stop()
        // Nothing on screen yet (no movie file, called from init): no fade to show.
        guard window != nil, started else { DispatchQueue.main.async(execute: done); return }
        UIView.animate(withDuration: 0.45, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            self.alpha = 0
        } completion: { _ in done() }
    }

    func stop() {
        timeout?.invalidate()
        timeout = nil
        readyWatch = nil
        statusWatch = nil
        observers.forEach(NotificationCenter.default.removeObserver)
        observers = []
        player.pause()
    }
}
