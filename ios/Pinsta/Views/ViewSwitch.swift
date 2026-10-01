import SwiftUI

/// How the current Where·What selection is shown. Remembered across launches.
enum PlacesView: String, CaseIterable {
    case map, list, cards, tiles

    var title: String { rawValue.capitalized }
    /// Simple glyphs, not words (same set as the web pill).
    var symbol: String {
        switch self {
        case .map: return "map"
        case .list: return "list.bullet"
        case .cards: return "rectangle.portrait"
        case .tiles: return "square.grid.2x2"
        }
    }
}

/// The segmented pill at the bottom. On iOS 26 it is Liquid Glass like the
/// system tab bar (Sarp, 2026-10-01): the pill itself is glass and the chosen
/// view sits in a soft lozenge. Below 26 it keeps the web's look, a material
/// pill with a solid lozenge.
struct ViewSwitch: View {
    @Binding var view: PlacesView
    @Namespace private var ns

    private var glass: Bool {
        if #available(iOS 26, *) { return true }
        return false
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(PlacesView.allCases, id: \.self) { v in
                let active = v == view
                Button {
                    withAnimation(.snappy(duration: 0.25)) { view = v }
                } label: {
                    Image(systemName: v.symbol)
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(active ? (glass ? Color(.label) : Color(.systemBackground)) : .secondary)
                        .frame(width: 52, height: 48)
                        .background {
                            if active {
                                // A solid lozenge under glass refracts into a grey smudge,
                                // so on glass it is a faint fill, the tab bar's highlight.
                                Capsule().fill(glass ? Color(.label).opacity(0.1) : Color.primary)
                                    .matchedGeometryEffect(id: "selected", in: ns)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(v.title)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(4)
        .modifier(GlassPill())
    }
}

/// 56pt tall, the same as the round + beside it.
private struct GlassPill: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(), in: .capsule)
        } else {
            content.background(.regularMaterial, in: Capsule())
        }
    }
}
