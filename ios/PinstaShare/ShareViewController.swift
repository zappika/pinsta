import UIKit
import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Instagram → Share → Pinsta. Pulls the shared URL out of the extension
/// context and hosts the same SwiftUI save flow the app uses, on the same store.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        Task { await present(url: await sharedURL()) }
    }

    private func sharedURL() async -> String? {
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        for item in items {
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    return url.absoluteString
                }
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                   let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
                   InstagramURL.normalize(text) != nil {
                    return text
                }
            }
        }
        return nil
    }

    @MainActor
    private func present(url: String?) {
        let root = AddPlaceView(
            initialURL: url,
            onFinish: { [weak self] in
                self?.extensionContext?.completeRequest(returningItems: nil)
            },
            allowsPasteboard: false
        )
        .modelContainer(Persistence.container)

        let host = UIHostingController(rootView: root)
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }
}
