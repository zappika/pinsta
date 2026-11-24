import SwiftUI

/// One place, as a card floating over the map, list or tiles (port of the web's
/// PeekCard, 2026-10-06): the big photo, name and actions, and why it's here.
/// One size; it rises and fades in, follows a swipe down and leaves from there.
/// Tapping the map behind or the × closes it. A swipe left or right goes to the next or previous
/// place, in the order the list shows them (Sarp, 2026-11-24); the next one comes in from that side.
struct PeekCardView: View {
    let place: Place
    let onClose: () -> Void
    var onEdit: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil
    /// Swiped sideways: +1 the next place, -1 the one before. Nil: no sideways swipe.
    var onStep: ((Int) -> Void)? = nil
    /// The side it came in from (+1 from the right, after a swipe left); 0 from below.
    var arrive = 0

    @State private var drag: CGFloat = 0
    @State private var slide: CGFloat = 0
    /// Which way this drag goes, decided on its first move.
    @State private var sideways: Bool?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
        .offset(x: slide, y: drag)
        // The swipe belongs to the photo, the top of the card: the rest scrolls and taps.
        .simultaneousGesture(swipe)
        .transition(reduceMotion ? .opacity : .asymmetric(
            insertion: arrive != 0
                ? .opacity.combined(with: .offset(x: CGFloat(arrive) * 120))
                : .opacity.combined(with: .offset(y: 24)).combined(with: .scale(scale: 0.97, anchor: .bottom)),
            removal: .opacity.combined(with: .offset(y: 24))
        ))
    }

    private var swipe: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { v in
                if sideways == nil { sideways = onStep != nil && abs(v.translation.width) > abs(v.translation.height) }
                if sideways == true {
                    slide = v.translation.width
                    return
                }
                guard v.startLocation.y < 300 else { return }
                let d = v.translation.height
                drag = d < 0 ? d / 5 : d
            }
            .onEnded { v in
                defer { sideways = nil }
                if sideways == true, let onStep {
                    let flung = v.predictedEndTranslation.width
                    if abs(v.translation.width) > 80 || abs(flung) > 240 {
                        let dir = (abs(v.translation.width) > 80 ? v.translation.width : flung) < 0 ? 1 : -1
                        // Off that side, then the next card comes in from the other.
                        withAnimation(reduceMotion ? nil : .easeIn(duration: 0.16)) { slide = CGFloat(-dir) * 500 } completion: {
                            onStep(dir)
                        }
                    } else {
                        withAnimation(.snappy) { slide = 0 }
                    }
                    return
                }
                guard v.startLocation.y < 300 else { return }
                if v.translation.height > 80 {
                    onClose()
                } else {
                    withAnimation(.snappy) { drag = 0 }
                }
            }
    }
}
