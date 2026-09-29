import SwiftUI
import MapKit

/// The card says only what the header doesn't: under a city row the town
/// goes, under a type the category goes. No address: Directions is it.
struct PlaceCardView: View {
    let place: Place
    var hideCategory = false
    var hideCity = false
    /// Shorter photo — for the PeekCard floating over the map or the grid.
    var compact = false

    private var postURLs: [String] { place.allPostURLs.filter { SourceURL.parse($0)?.kind != .google } }

    private var meta: String {
        [hideCategory ? nil : place.category.rawValue, hideCity ? nil : place.city, postURLs.count > 1 ? "\(postURLs.count) posts" : nil]
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

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.name).font(.headline).lineLimit(1)
                    if !meta.isEmpty {
                        HStack(spacing: 6) {
                            if !hideCategory { Circle().fill(place.category.dot).frame(width: 8, height: 8) }
                            Text(meta).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 0)
                roundAction("arrow.triangle.turn.up.right.diamond", label: "Directions") { Settings.shared.directions(to: place) }
                if postURLs.count == 1, let url = postURLs.first {
                    roundAction("camera", label: "Post") { open(url) }
                } else if postURLs.count > 1 {
                    Menu {
                        ForEach(Array(postURLs.enumerated()), id: \.offset) { i, url in
                            Button("Post \(i + 1) · \(SourceURL.parse(url)?.kind == .tiktok ? "TikTok" : "Instagram")") { open(url) }
                        }
                    } label: {
                        roundIcon("camera")
                    }
                    .accessibilityLabel("Posts")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func roundIcon(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(.primary)
            .frame(width: 40, height: 40)
            .background(Color(.tertiarySystemFill), in: Circle())
    }

    private func roundAction(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { roundIcon(symbol) }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func open(_ link: String) {
        if let url = URL(string: link) { UIApplication.shared.open(url) }
    }
}
