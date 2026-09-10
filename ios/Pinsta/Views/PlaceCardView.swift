import SwiftUI
import MapKit

struct PlaceCardView: View {
    let place: Place
    let onDelete: () -> Void
    @State private var confirmDelete = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let data = place.imageData, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 176)
                    .frame(maxWidth: .infinity)
                    .clipped()
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(place.name).font(.headline).lineLimit(1)
                        Text([place.category.rawValue, place.city].compactMap { $0 }.joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        confirmDelete = true
                    } label: {
                        Image(systemName: "xmark")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                            .padding(8)
                    }
                    .buttonStyle(.plain)
                    .offset(x: 8, y: -6)
                }
                if let address = place.address {
                    Text(address)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            Divider()

            HStack(spacing: 0) {
                actionButton("Google Maps") { openGoogleMaps() }
                Divider().frame(height: 20)
                actionButton("Apple Maps") { openAppleMaps() }
                Divider().frame(height: 20)
                actionButton("Post") { openPost() }
            }
        }
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        .confirmationDialog("Remove \(place.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Remove", role: .destructive, action: onDelete)
        }
    }

    private func actionButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
    }

    private func openAppleMaps() {
        let coordinate = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        item.name = place.name
        item.openInMaps()
    }

    private func openGoogleMaps() {
        let q = place.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? place.name
        let app = URL(string: "comgooglemaps://?q=\(q)&center=\(place.latitude),\(place.longitude)")!
        let web = URL(string: "https://www.google.com/maps/search/?api=1&query=\(q)&query_place_id=\(place.googlePlaceID ?? "")")!
        if UIApplication.shared.canOpenURL(app) {
            UIApplication.shared.open(app)
        } else {
            UIApplication.shared.open(web)
        }
    }

    private func openPost() {
        if let url = URL(string: place.instagramURL) { UIApplication.shared.open(url) }
    }
}
