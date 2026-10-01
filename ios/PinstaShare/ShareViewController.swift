import UIKit
import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Instagram → Share → Pinsta. Pulls the shared URL out of the extension
/// context and hosts the same SwiftUI save flow the app uses, on the same store.
final class ShareViewController: UIViewController {
    // Without this the system presents the extension as a full-height sheet and
    // the card sits at the bottom of a big empty page. Over full screen, the card
    // floats over the app that shared, like the in-app save sheet.
    override init(nibName: String?, bundle: Bundle?) {
        super.init(nibName: nibName, bundle: bundle)
        modalPresentationStyle = .overFullScreen
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        modalPresentationStyle = .overFullScreen
    }

    private let dim = UIColor.black.withAlphaComponent(0.4)
    private weak var card: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapOutside)))
        Task { await present(url: await sharedURL()) }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        UIView.animate(withDuration: 0.25) { self.view.backgroundColor = self.dim }
    }

    @objc private func tapOutside(_ tap: UITapGestureRecognizer) {
        if let card, card.frame.contains(tap.location(in: view)) { return }
        close { $0.cancelRequest(withError: NSError(domain: "se.sarper.vicolo", code: 0)) }
    }

    /// Slide the card away and lift the dim before handing back to the host app.
    private func close(_ finish: @escaping (NSExtensionContext) -> Void) {
        UIView.animate(withDuration: 0.22, animations: {
            self.view.backgroundColor = .clear
            self.card?.transform = CGAffineTransform(translationX: 0, y: AddPlaceView.sheetHeight + 40)
        }, completion: { _ in
            if let context = self.extensionContext { finish(context) }
        })
    }

    private func sharedURL() async -> String? {
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        for item in items {
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
                   let source = SourceURL.parse(url.absoluteString) {
                    return source.url
                }
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                   let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
                   let source = SourceURL.parse(text) {
                    return source.url
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
                self?.close { $0.completeRequest(returningItems: nil) }
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
        card = host.view
        // Rise in from the bottom edge, like the app's own sheet.
        host.view.transform = CGAffineTransform(translationX: 0, y: AddPlaceView.sheetHeight + 40)
        UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0) {
            host.view.transform = .identity
        }
    }
}
