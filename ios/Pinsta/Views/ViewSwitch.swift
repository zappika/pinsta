import SwiftUI

/// How the current Where·What selection is shown. Remembered across launches.
enum PlacesView: String, CaseIterable {
    case map, cards, tiles

    var title: String { rawValue.capitalized }
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
                    Text(v.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(active ? Color(.systemBackground) : .primary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background {
                            if active {
                                Capsule().fill(Color.primary)
                                    .matchedGeometryEffect(id: "selected", in: ns)
                            }
                        }
                }
                .buttonStyle(.plain)
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
