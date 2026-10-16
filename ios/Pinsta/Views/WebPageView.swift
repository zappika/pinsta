import SafariServices
import SwiftUI

/// Pages on vicolo.space the buddy menu opens in Safari's own view, so they stay in the
/// app and have their own Done button. What's new is built from changelog.md; Help and
/// Privacy are the App Store's support and privacy URLs (docs/app-store.md).
enum WebPage: String, Identifiable {
    case changelog, support, privacy

    var id: String { rawValue }
    var url: URL { URL(string: "https://www.vicolo.space/\(rawValue)")! }
}

struct WebPageView: UIViewControllerRepresentable {
    let page: WebPage

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: page.url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}
