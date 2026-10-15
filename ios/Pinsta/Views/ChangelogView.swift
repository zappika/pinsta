import SafariServices
import SwiftUI

/// Buddy menu → What's new: vicolo.space/changelog (built from changelog.md) in Safari's
/// own view, so it stays in the app and has its own Done button.
struct ChangelogView: UIViewControllerRepresentable {
    static let url = URL(string: "https://www.vicolo.space/changelog")!

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: Self.url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
