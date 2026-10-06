import SwiftUI

/// One place, as a card floating over the map, list or tiles (port of the web's
/// PeekCard, 2026-10-06): the big photo, name and actions, and why it's here.
/// One size; it rises and fades in, follows a swipe down and leaves from there.
/// Tapping the map behind or the × closes it.
struct PeekCardView: View {
    let place: Place
    let onClose: () -> Void
    var onEdit: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil

    @State private var drag: CGFloat = 0

    var body: some View {
        PlaceCardView(place: place, expanded: true, onEdit: onEdit, onDelete: onDelete)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(alignment: .topTrailing) {
            // On the photo; a place without one (a Maps save on iOS) has its ⋯ there.
            if place.imageData != nil { Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(.black.opacity(0.35), in: Circle())
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .padding(6) }
        }
        .shadow(color: .black.opacity(0.18), radius: 20, y: 8)
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .offset(y: drag)
        // The swipe belongs to the photo, the top of the card: the rest scrolls and taps.
        .simultaneousGesture(swipe)
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .offset(y: 24)).combined(with: .scale(scale: 0.97, anchor: .bottom)),
            removal: .opacity.combined(with: .offset(y: 24))
        ))
    }

    private var swipe: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { v in
                guard v.startLocation.y < 300 else { return }
                let d = v.translation.height
                drag = d < 0 ? d / 5 : d
            }
            .onEnded { v in
                guard v.startLocation.y < 300 else { return }
                if v.translation.height > 80 {
                    onClose()
                } else {
                    withAnimation(.snappy) { drag = 0 }
                }
            }
    }
}
