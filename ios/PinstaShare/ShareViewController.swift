import UIKit
import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Instagram → Share → Pinsta. Pulls the shared URL out of the extension
/// context and hosts the same SwiftUI save flow the app uses, on the same store.
final class ShareViewController: UIViewController {
    // Asks for full screen so the card floats over the app that shared. iOS 26+
    // ignores this and shows a full-height sheet anyway; see clearSheetBackground.
    override init(nibName: String?, bundle: Bundle?) {
        super.init(nibName: nibName, bundle: bundle)
        modalPresentationStyle = .overFullScreen
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        modalPresentationStyle = .overFullScreen
    }

    private weak var card: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        Task { await present(url: await sharedURL()) }
    }

    override func viewIsAppearing(_ animated: Bool) {
        super.viewIsAppearing(animated)
        clearSheetBackground()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        clearSheetBackground()
    }

    /// The system's share sheet paints an opaque white page behind the extension
    /// (Apple forums 806117, FB20934974). Build 3 dimmed that page, which showed
    /// as a big grey sheet on Sarp's phone. Clearing every view up the chain makes
    /// the page see-through, so only the card shows over the host app, which the
    /// system already dims. No dim of our own: it would draw the sheet's outline.
    private func clearSheetBackground() {
        var v: UIView? = view
        while let current = v {
            current.backgroundColor = .clear
            v = current.superview
        }
        view.window?.backgroundColor = .clear
    }

    private func cancel() {
        close { $0.cancelRequest(withError: NSError(domain: "se.sarper.vicolo", code: 0)) }
    }

    /// Slide the card away before handing back to the host app.
    private func close(_ finish: @escaping (NSExtensionContext) -> Void) {
        UIView.animate(withDuration: 0.22, animations: {
            self.card?.transform = CGAffineTransform(translationX: 0, y: self.view.bounds.height)
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
        // A store that won't open shows why, rather than saving somewhere the app can't see.
        let root: AnyView
        switch Persistence.opened {
        case .success(let container):
            root = AnyView(AddPlaceView(
                initialURL: url,
                onFinish: { [weak self] in
                    self?.close { $0.completeRequest(returningItems: nil) }
                },
                allowsPasteboard: false
            )
            .modelContainer(container))
        case .failure:
            root = AnyView(StoreErrorView().onTapGesture { [weak self] in
                self?.close { $0.completeRequest(returningItems: nil) }
            })
        }

        let host = UIHostingController(rootView: ShareStage(card: root, onOutside: { [weak self] in self?.cancel() }))
        // The card itself follows the keyboard (keyboardLayoutGuide below); without
        // this the hosted view avoided it a second time and its content jumped.
        host.safeAreaRegions = .container
        // The host fills the screen and SwiftUI places the card: its height changes then
        // animate with the sheet's steps. Sized by UIKit (intrinsic size) the card snapped
        // to each new height, which Sarp saw as jumps between steps (2026-10-10).
        addChild(host)
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
        host.didMove(toParent: self)
        card = host.view
        // Rise in from the bottom edge, like the app's own sheet.
        host.view.transform = CGAffineTransform(translationX: 0, y: AddPlaceView.savedHeight + 40)
        UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0) {
            host.view.transform = .identity
        }
    }
}

/// The card at the bottom; a tap above it cancels. The system already dims the host app.
private struct ShareStage: View {
    let card: AnyView
    let onOutside: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.contentShape(Rectangle()).onTapGesture(perform: onOutside)
            card
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
        }
    }
}
