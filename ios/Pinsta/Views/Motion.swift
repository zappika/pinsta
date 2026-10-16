import SwiftUI

/// Reduce Motion (Settings → Accessibility → Motion): what slides, springs or flies becomes a
/// fade or a jump. Short state changes (.snappy on a value) stay; they don't travel.
extension AnyTransition {
    /// Up from the bottom edge, or a fade.
    static func fromBottom(reduceMotion: Bool) -> AnyTransition {
        reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity)
    }
}

extension Animation {
    /// `animation`, or a plain short fade-length curve when Reduce Motion is on.
    static func motion(_ animation: Animation, reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.15) : animation
    }
}
