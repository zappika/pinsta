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

/// The segmented pill at the bottom. Liquid Glass on iOS 26; a material below.
struct ViewSwitch: View {
    @Binding var view: PlacesView
    @Namespace private var ns

    var body: some View {
        HStack(spacing: 2) {
            ForEach(PlacesView.allCases, id: \.self) { v in
                let active = v == view
                Button {
                    withAnimation(.snappy(duration: 0.25)) { view = v }
                } label: {
                    Image(systemName: v.symbol)
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(active ? Color(.systemBackground) : .secondary)
                        .frame(width: 48, height: 40)
                        .background {
                            if active {
                                Capsule().fill(Color.primary)
                                    .matchedGeometryEffect(id: "selected", in: ns)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(v.title)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(4)
        // The glass is a layer behind the labels, not around them — otherwise the
        // selected lozenge gets refracted into a grey smudge.
        .background { GlassPill() }
    }
}

private struct GlassPill: View {
    var body: some View {
        if #available(iOS 26, *) {
            Color.clear.glassEffect(.regular, in: .capsule)
        } else {
            Capsule().fill(.regularMaterial)
        }
    }
}
