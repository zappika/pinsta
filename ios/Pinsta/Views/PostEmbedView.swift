import SwiftUI
import WebKit

/// A saved post shown inside the full place sheet, as the web does with
/// Instagram's and TikTok's embed.js. Here the platforms' own embed pages load
/// in a web view (no token, no script of ours); the view grows to the page's
/// height, and a tap on anything in it opens the real app or Safari.
struct PostEmbedView: View {
    let url: String
    @State private var height: CGFloat = 480

    /// The platform's embed page for a saved post link, or nil (Maps links).
    static func embedURL(for link: String) -> URL? {
        guard let source = SourceURL.parse(link) else { return nil }
        switch source.kind {
        case .instagram:
            // Canonical form is instagram.com/{p|reel|tv}/CODE/; /p/ embeds all three.
            guard let code = URL(string: source.url)?.pathComponents.dropFirst(2).first else { return nil }
            return URL(string: "https://www.instagram.com/p/\(code)/embed/captioned/")
        case .tiktok:
            guard let id = source.url.firstMatch(of: /video\/(\d+)/)?.1 else { return nil }
            return URL(string: "https://www.tiktok.com/embed/v2/\(id)")
        case .google:
            return nil
        }
    }

    var body: some View {
        if let embed = Self.embedURL(for: url) {
            EmbedWebView(url: embed, height: $height)
                .frame(height: height)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
}

private struct EmbedWebView: UIViewRepresentable {
    let url: URL
    @Binding var height: CGFloat

    func makeCoordinator() -> Coordinator { Coordinator(height: $height) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // Nothing to keep between embeds; don't fill a cookie jar for them.
        config.websiteDataStore = .nonPersistent()
        // Let the page be as tall as its content, not the view: scrollHeight never
        // drops below the view's own height, so measuring it only ever grew.
        let fit = "var s=document.createElement('style');s.textContent='html,body{height:auto!important;min-height:0!important;overflow:hidden}';document.documentElement.appendChild(s);"
        config.userContentController.addUserScript(WKUserScript(source: fit, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.scrollView.isScrollEnabled = false
        web.isOpaque = false
        web.backgroundColor = .clear
        web.load(URLRequest(url: url))
        context.coordinator.home = url
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        coordinator.stop()
        web.stopLoading()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private var height: Binding<CGFloat>
        var home: URL?
        private var timer: Timer?

        init(height: Binding<CGFloat>) { self.height = height }

        func stop() { timer?.invalidate(); timer = nil }

        /// The content's height and the page's width, in CSS pixels. The embed
        /// pages lay out wider than the view and are shown scaled down.
        static let contentSize = "[document.body.scrollHeight, window.innerWidth]"

        /// Taps inside the embed leave for the real app, never navigate here.
        func webView(_ web: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
            if action.navigationType == .linkActivated, let url = action.request.url {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }

        /// target=_blank links ask for a new window: open them outside instead.
        func webView(_ web: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url { UIApplication.shared.open(url) }
            return nil
        }

        /// The embed lays itself out after load (images, caption), so measure a
        /// few times rather than once.
        func webView(_ web: WKWebView, didFinish navigation: WKNavigation!) {
            var ticks = 0
            stop()
            timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self, weak web] t in
                ticks += 1
                if ticks > 8 { t.invalidate() }
                web?.evaluateJavaScript(Self.contentSize) { value, _ in
                    guard let self, let web, let size = (value as? [Double])?.map { CGFloat($0) }, size.count == 2,
                          size[0] > 100, size[1] > 0 else { return }
                    let clamped = min(size[0] * web.bounds.width / size[1], 900)
                    if abs(clamped - self.height.wrappedValue) > 4 { self.height.wrappedValue = clamped }
                }
            }
        }
    }
}
