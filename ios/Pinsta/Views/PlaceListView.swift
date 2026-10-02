import SwiftUI
import CoreLocation

/// The directory list (port of the web's PlaceList): rounded square photo,
/// name, type, town. Tap a row → the place sheet, like Tiles. What the header
/// already says is left out.
struct PlaceListView: View {
    let places: [Place]
    @Binding var selected: Place?
    var hideCategory = false
    var hideCity: (Place) -> Bool = { _ in false }
    var here: CLLocation? = nil

    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(places) { place in
                Button {
                    withAnimation(.snappy) { selected = selected?.id == place.id ? nil : place }
                } label: {
                    row(place)
                }
                .buttonStyle(.plain)
                Divider().padding(.leading, 116)
            }
        }
    }

    private func row(_ p: Place) -> some View {
        HStack(spacing: 16) {
            Group {
                if let data = p.imageData, let image = UIImage(data: data) {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Text(p.category.emoji).font(.title2)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(p.category.tint)
                }
            }
            .frame(width: 80, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(p.name).font(.headline).lineLimit(1)
                let kind = [hideCategory ? nil : p.category.rawValue, p.priceLabel].compactMap { $0 }.joined(separator: " · ")
                if !kind.isEmpty { Text(kind).font(.subheadline).foregroundStyle(.secondary).lineLimit(1) }
                let km = here.map { $0.distance(from: CLLocation(latitude: p.latitude, longitude: p.longitude)) / 1000 }
                let whereText = [km.map { $0 < 10 ? String(format: "%.1f km", $0) : "\(Int($0.rounded())) km" }, hideCity(p) ? nil : p.city]
                    .compactMap { $0 }.joined(separator: " · ")
                if !whereText.isEmpty { Text(whereText).font(.subheadline).foregroundStyle(.secondary).lineLimit(1) }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .background(selected?.id == p.id ? Color(.tertiarySystemFill) : .clear)
    }
}
