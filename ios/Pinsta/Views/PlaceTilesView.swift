import SwiftUI

/// The Instagram profile grid: three across, edge to edge, portrait crops,
/// hairline gaps, no words. The name lives in the PeekCard a tap opens.
/// No photo → the type emoji on its tint. Fewer than six places → quiet
/// placeholder tiles fill two rows, the first nudging to share more.
struct PlaceTilesView: View {
    let places: [Place]
    @Binding var selected: Place?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 2) {
            ForEach(places) { place in
                Button {
                    withAnimation(.snappy) { selected = selected?.id == place.id ? nil : place }
                } label: {
                    tile(place)
                        .aspectRatio(3 / 4, contentMode: .fit)
                        .clipped()
                        .overlay {
                            if selected?.id == place.id {
                                Rectangle().strokeBorder(Color.primary, lineWidth: 2)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(place.name)
            }
            ForEach(0..<max(0, 6 - places.count), id: \.self) { i in
                Color(.secondarySystemFill).opacity(0.5)
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .overlay {
                        if i == 0 {
                            Text("Share posts from Instagram to fill your grid")
                                .font(.caption).foregroundStyle(.tertiary)
                                .multilineTextAlignment(.center).padding(10)
                        }
                    }
                    .accessibilityHidden(true)
            }
        }
    }

    @ViewBuilder
    private func tile(_ place: Place) -> some View {
        if place.imageData != nil {
            PlacePhoto(place: place, points: 200)
        } else {
            place.category.tint.overlay {
                Text(place.category.emoji).font(.system(size: 30))
            }
        }
    }
}
