import SwiftUI
import MapKit

/// The card says only what the header doesn't: under a city row the town
/// goes, under a type the category goes. No address — the maps buttons are it.
struct PlaceCardView: View {
    let place: Place
    var hideCategory = false
    var hideCity = false
    /// Shorter photo — for the PeekCard floating over the map or the grid.
    var compact = false

    private var meta: String {
        [hideCategory ? nil : place.category.rawValue, hideCity ? nil : place.city]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let data = place.imageData, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(height: compact ? 128 : 176)
                    .frame(maxWidth: .infinity)
                    .clipped()
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(place.name).font(.headline).lineLimit(1)
                if !meta.isEmpty {
                    Text(meta).font(.subheadline).foregroundStyle(.secondary)
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
        .clipShape(RoundedRectangle(cornerRadius: 16))
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
