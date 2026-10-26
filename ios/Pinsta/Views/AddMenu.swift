import SwiftUI

/// The + fans out what can be added, Path style but straight up from the button: a radial
/// fan from a corner loses half its circle off screen (Sarp, 2026-10-16). Labelled pills,
/// staggered, the + turning into × beneath them; tap outside closes. Same as the web's AddMenu.
struct AddMenu: View {
    let open: Bool
    let onClose: () -> Void
    let onPick: (AddPlaceView.AddMode) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Item: Identifiable {
        let mode: AddPlaceView.AddMode
        let label: String
        let hint: String
        let icon: String
        var id: String { label }
    }

    private let items = [
        Item(mode: .here, label: "Where I am", hint: "The place you're at", icon: "storefront"),
        Item(mode: .google, label: "Google Maps", hint: "A place or a shared list", icon: "mappin.and.ellipse"),
        Item(mode: .post, label: "Instagram post", hint: "Paste its link", icon: "camera"),
    ]

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.black.opacity(open ? 0.25 : 0)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onClose)
                .allowsHitTesting(open)
                .animation(.easeOut(duration: 0.2), value: open)

            VStack(alignment: .trailing, spacing: 12) {
                ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                    // The one nearest the + comes out first and goes back last.
                    let order = items.count - 1 - i
                    pill(item)
                        .opacity(open ? 1 : 0)
                        // Reduce Motion: they fade in where they stand.
                        .scaleEffect(open || reduceMotion ? 1 : 0.6, anchor: .bottomTrailing)
                        .offset(y: open || reduceMotion ? 0 : CGFloat(order + 1) * 24)
                        .animation(.motion(.spring(response: 0.38, dampingFraction: 0.68).delay(Double(open ? order : i) * 0.045), reduceMotion: reduceMotion), value: open)
                        .allowsHitTesting(open)
                }
            }
            // Above the + (56pt, 8pt off the bottom) with a little air.
            .padding(.trailing, 20)
            .padding(.bottom, 8 + 56 + 16)
        }
        .accessibilityHidden(!open)
    }

    private func pill(_ item: Item) -> some View {
        Button { onPick(item.mode) } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.label).font(.subheadline.weight(.semibold)).foregroundStyle(Color(.label))
                    Text(item.hint).font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: item.icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Color(.label))
                    .frame(width: 40, height: 40)
                    .background(Color(.tertiarySystemFill), in: Circle())
            }
            .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 8)
            .frame(width: 224)
            .background(Color(.secondarySystemGroupedBackground), in: Capsule())
            .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
        }
        .buttonStyle(.plain)
    }
}
