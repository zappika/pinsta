import SwiftUI

/// How the current Where·What selection is shown. Remembered across launches.
enum PlacesView: String, CaseIterable {
    /// Cards went 2026-11-24 (Sarp): the map card and the list cover it.
    case map, list, tiles

    var title: String { rawValue.capitalized }
    /// Simple glyphs, not words (same set as the web pill).
    var symbol: String {
        switch self {
        case .map: return "map"
        case .list: return "list.bullet"
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
    /// The map's Want to go / Been there filter, on a long press of the map icon (Sarp, 2026-11-24:
    /// the segmented row at the top of the map was boring and took a band of the map).
    @Binding var been: BeenFilter
    @Namespace private var ns

    private var glass: Bool {
        if #available(iOS 26, *) { return true }
        return false
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(PlacesView.allCases, id: \.self) { v in
                let active = v == view
                // No withAnimation here: it animated the whole content swap, so the
                // list slid and resized into the map. Only the lozenge animates
                // (the .animation below); the view itself changes in one frame.
                Button {
                    if v != view { Uses.count("pick.\(v.rawValue)") }
                    view = v
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
                .overlay(alignment: .topTrailing) {
                    if v == .map, let badge = been.badge {
                        Image(systemName: badge)
                            .font(.system(size: 8, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(width: 16, height: 16)
                            .background(Circle().fill(been.tint))
                            .offset(x: -6, y: 6)
                            .allowsHitTesting(false)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .contextMenu {
                    if v == .map {
                        Picker("Show on the map", selection: Binding(get: { been }, set: { b in
                            withAnimation(.snappy) { been = b }
                            view = .map
                        })) {
                            ForEach(BeenFilter.allCases, id: \.self) { Label($0.label, systemImage: $0.symbol).tag($0) }
                        }
                        .pickerStyle(.inline)
                    }
                }
                .accessibilityLabel(v == .map && been != .all ? "Map, \(been.label)" : v.title)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .animation(.snappy(duration: 0.25), value: view)
        .animation(.snappy, value: been)
        .padding(4)
        .modifier(GlassPill())
    }
}

/// 56pt tall, the same as the round + beside it.
private struct GlassPill: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.glassEffect(.regular.interactive(), in: .capsule)
        } else {
            content.background(.regularMaterial, in: Capsule())
        }
    }
}
