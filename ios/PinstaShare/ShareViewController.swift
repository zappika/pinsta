import UIKit
import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Instagram → Share → Pinsta. Pulls the shared URL out of the extension
/// context and hosts the same SwiftUI save flow the app uses, on the same store.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // The system already dims the host app; we draw only a small card at the bottom.
        view.backgroundColor = .clear
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(cancel)))
        Task { await present(url: await sharedURL()) }
    }

    @objc private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: "se.sarper.pinsta", code: 0))
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
        host.view.layer.cornerRadius = 20
        host.view.layer.cornerCurve = .continuous
        host.view.clipsToBounds = true
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            host.view.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -12),
            host.view.heightAnchor.constraint(equalToConstant: AddPlaceView.sheetHeight),
        ])
        host.didMove(toParent: self)
    }
}
