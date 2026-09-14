import SwiftUI

/// One place, floated above the map or the grid. The × or a tap elsewhere dismisses.
struct PeekCardView: View {
    let place: Place
    let onClose: () -> Void

    var body: some View {
        PlaceCardView(place: place, compact: true)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            .overlay(alignment: .topTrailing) {
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.primary)
                        .frame(width: 32, height: 32)
                        .background(.regularMaterial, in: Circle())
                }
                .buttonStyle(.plain)
                .padding(8)
                .accessibilityLabel("Close")
            }
            .shadow(color: .black.opacity(0.15), radius: 16, y: 6)
            .padding(.horizontal, 20)
            .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
