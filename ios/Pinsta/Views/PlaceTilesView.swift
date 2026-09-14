import SwiftUI

/// The Instagram profile grid: three across, edge to edge, portrait crops,
/// hairline gaps, no words. The name lives in the PeekCard a tap opens.
/// No photo → a quiet tile with the category glyph.
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
        }
    }

    @ViewBuilder
    private func tile(_ place: Place) -> some View {
        if let data = place.imageData, let image = UIImage(data: data) {
            Color.clear.overlay {
                Image(uiImage: image).resizable().scaledToFill()
            }
        } else {
            Color(.secondarySystemFill).overlay {
                Text(place.category.emoji).font(.system(size: 30))
            }
        }
    }
}
