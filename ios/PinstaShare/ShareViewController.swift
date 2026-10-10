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
    /// The card waits for the view to be on screen: its home-indicator room comes from the safe area.
    private var appeared = false
    private var pendingURL: String??

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapOutside)))
        Task {
            let url = await sharedURL()
            if appeared { present(url: url) } else { pendingURL = .some(url) }
        }
    }

    override func viewIsAppearing(_ animated: Bool) {
        super.viewIsAppearing(animated)
        clearSheetBackground()
        appeared = true
        if let url = pendingURL {
            pendingURL = nil
            present(url: url)
        }
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

    @objc private func tapOutside(_ tap: UITapGestureRecognizer) {
        if let card, card.frame.contains(tap.location(in: view)) { return }
        close { $0.cancelRequest(withError: NSError(domain: "se.sarper.vicolo", code: 0)) }
    }

    /// Slide the card away before handing back to the host app.
    private func close(_ finish: @escaping (NSExtensionContext) -> Void) {
        UIView.animate(withDuration: 0.22, animations: {
            self.card?.transform = CGAffineTransform(translationX: 0, y: AddPlaceView.savedHeight + 40)
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
        // A full-width sheet on the bottom edge, not a floating card: the system share sheet
        // stays up behind the extension and showed around and below a smaller card (Sarp, 2026-10-10).
        let bottomInset = max(view.safeAreaInsets.bottom, view.window?.safeAreaInsets.bottom ?? 0)
        // A store that won't open shows why, rather than saving somewhere the app can't see.
        let root: AnyView
        switch Persistence.opened {
        case .success(let container):
            root = AnyView(AddPlaceView(
                initialURL: url,
                onFinish: { [weak self] in
                    self?.close { $0.completeRequest(returningItems: nil) }
                },
                allowsPasteboard: false,
                bottomInset: bottomInset
            )
            .modelContainer(container))
        case .failure:
            root = AnyView(StoreErrorView().onTapGesture { [weak self] in
                self?.close { $0.completeRequest(returningItems: nil) }
            })
        }

        let host = UIHostingController(rootView: root)
        // The card itself follows the keyboard (keyboardLayoutGuide below); without
        // this the hosted view avoided it a second time and its content jumped.
        host.safeAreaRegions = []
        // The sheet sets its own height (taller for the success card); the card follows it.
        host.sizingOptions = .intrinsicContentSize
        addChild(host)
        host.view.layer.cornerRadius = 28
        host.view.layer.cornerCurve = .continuous
        host.view.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        host.view.clipsToBounds = true
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        // On the bottom edge, not above the home indicator (the card makes its own room for it).
        view.keyboardLayoutGuide.usesBottomSafeArea = false
        NSLayoutConstraint.activate([
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
