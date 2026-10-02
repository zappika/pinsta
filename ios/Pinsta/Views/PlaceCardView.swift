import SwiftUI
import MapKit

/// The card says only what the header doesn't: under a city row the town
/// goes, under a type the category goes. No address: Directions is it.
struct PlaceCardView: View {
    let place: Place
    var hideCategory = false
    var hideCity = false
    /// Shorter photo — for the place sheet in its short state.
    var compact = false
    /// The place sheet at full height: big photo, every post listed.
    var expanded = false
    /// Given in the place sheet: a ⋯ button offers Change place and Remove.
    var onEdit: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil

    @State private var showMore = false

    private var postURLs: [String] { place.allPostURLs.filter { SourceURL.parse($0)?.kind != .google } }

    private var meta: String {
        [hideCategory ? nil : place.category.rawValue, place.priceLabel, hideCity ? nil : place.city, postURLs.count > 1 ? "\(postURLs.count) posts" : nil]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let data = place.imageData, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(height: compact ? 128 : expanded ? 300 : 176)
                    .frame(maxWidth: .infinity)
                    .clipped()
            }

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.name).font(.headline).lineLimit(1)
                    if !meta.isEmpty {
                        Text(meta).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                roundAction(.directions, label: "Directions") { Settings.shared.directions(to: place) }
                if postURLs.count == 1, let url = postURLs.first {
                    roundAction(.post, label: "Post") { open(url) }
                } else if postURLs.count > 1 {
                    Menu {
                        ForEach(Array(postURLs.enumerated()), id: \.offset) { i, url in
                            Button("Post \(i + 1) · \(SourceURL.parse(url)?.kind == .tiktok ? "TikTok" : "Instagram")") { open(url) }
                        }
                    } label: {
                        roundIcon(.post)
                    }
                    .accessibilityLabel("Posts")
                }
                if onEdit != nil || onDelete != nil {
                    Button { withAnimation(.snappy) { showMore.toggle() } } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(showMore ? Color(.systemBackground) : .primary)
                            .frame(width: 40, height: 40)
                            .background(showMore ? Color.primary : Color(.tertiarySystemFill), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Change or remove")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

            if showMore {
                HStack(spacing: 8) {
                    if let onEdit {
                        Button(action: onEdit) {
                            Text("Change place")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    if let onDelete {
                        Button(action: onDelete) {
                            Text("Remove")
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                }
                .font(.subheadline.weight(.medium))
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.bottom, 14)
            }

            if expanded && !postURLs.isEmpty {
                Divider()
                ForEach(Array(postURLs.enumerated()), id: \.offset) { i, url in
                    Button { open(url) } label: {
                        HStack {
                            if SourceURL.parse(url)?.kind == .tiktok {
                                Image(systemName: "play.rectangle")
                            } else {
                                Glyph.post.view(size: 17)
                            }
                            Text(postURLs.count > 1 ? "Post \(i + 1)" : "Open the post")
                            Spacer()
                            Image(systemName: "arrow.up.right").foregroundStyle(.tertiary)
                        }
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 16).padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 24)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func roundIcon(_ glyph: Glyph) -> some View {
        glyph.view()
            .foregroundStyle(.primary)
            .frame(width: 40, height: 40)
            .background(Color(.tertiarySystemFill), in: Circle())
    }

    private func roundAction(_ glyph: Glyph, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { roundIcon(glyph) }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func open(_ link: String) {
        if let url = URL(string: link) { UIApplication.shared.open(url) }
    }
}
