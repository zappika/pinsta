import SwiftUI

/// One place, as a pull-up sheet over the map, list or grid (Apple Maps
/// style; port of the web's PeekCard). Opens short. Drag the handle up (or
/// tap it) for the full card with a big photo and the posts; drag down to go
/// back, then away. The view behind stays live.
struct PeekCardView: View {
    let place: Place
    let onClose: () -> Void
    var onEdit: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil

    @State private var full = false
    @State private var drag: CGFloat = 0

    var body: some View {
        VStack(spacing: 0) {
            // A Button, not onTapGesture: the sheet's drag swallowed plain taps.
            Button { withAnimation(.snappy) { full.toggle() } } label: {
                Capsule()
                    .fill(Color(.tertiaryLabel))
                    .frame(width: 40, height: 5)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // In the full state the sheet's own drag is off (the content scrolls); the handle keeps it.
            .simultaneousGesture(sheetDrag, including: full ? .all : .none)
            .accessibilityLabel(full ? "Show less" : "Show more")

            if full {
                // Embedded posts make the full card taller than the screen.
                // A scroll view lets the photo's fill width leak; pin the card to the sheet's.
                ScrollView { card.containerRelativeFrame(.horizontal) }
                    .scrollBounceBehavior(.basedOnSize)
                    .containerRelativeFrame(.vertical) { h, _ in h * 0.8 }
            } else {
                card
            }
        }
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                .fill(Color(.secondarySystemGroupedBackground))
                .ignoresSafeArea(edges: .bottom)
        )
        .shadow(color: .black.opacity(0.18), radius: 20, y: -4)
        .offset(y: drag)
        // Full: the content scrolls, so only the handle drags the sheet.
        .gesture(sheetDrag, including: full ? .subviews : .all)
        .onChange(of: place.id) { _, _ in full = false }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private var card: some View {
        PlaceCardView(place: place, compact: !full, expanded: full, onEdit: onEdit, onDelete: onDelete)
            // Clear the home indicator; the sheet colour runs to the edge below.
            .padding(.bottom, 20)
    }

    private var sheetDrag: some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { v in
                let d = v.translation.height
                // Resist upward past the stop; follow freely downward.
                drag = d < 0 ? d / 4 : d
            }
            .onEnded { v in
                let d = v.translation.height
                withAnimation(.snappy) {
                    drag = 0
                    if d < -50 { full = true }
                    else if d > 80 { if full { full = false } else { onClose() } }
                }
            }
    }
}
