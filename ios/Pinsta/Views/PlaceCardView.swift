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
    /// The floating place card: big photo, and the line saying why it's here.
    var expanded = false
    /// Given in the place sheet: a ⋯ button offers Change place and Remove.
    var onEdit: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil

    @State private var showMore = false
    /// Been there with a face: the switch folds into that face among the round
    /// actions; a tap on it opens the switch again (web: PlaceCard).
    @State private var visitOpen = false
    private var folded: Bool { place.visitedAt != nil && place.rating != nil && !visitOpen }

    private var postURLs: [String] { place.allPostURLs.filter { SourceURL.parse($0)?.kind != .google } }

    private var meta: String {
        [hideCategory ? nil : place.category.rawValue, place.priceLabel, hideCity ? nil : place.city, !expanded && postURLs.count > 1 ? "\(postURLs.count) posts" : nil]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if place.imageData != nil {
                // A fixed box the photo fills (PlacePhoto draws it as an overlay, so its
                // natural width never widens the card, and it takes no touches: a tall
                // photo once covered the sheet's handle).
                PlacePhoto(place: place, points: 420)
                    .frame(height: compact ? 128 : expanded ? 300 : 176)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
            }

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.name).font(.headline).lineLimit(1)
                    if !meta.isEmpty {
                        Text(meta).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if expanded, folded, let r = place.rating, (1...3).contains(r) {
                    Button { withAnimation(.snappy) { visitOpen = true } } label: {
                        FaceView(kind: r, size: 24)
                            .foregroundStyle(.primary)
                            .frame(width: 40, height: 40)
                            .background(Color(.tertiarySystemFill), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Been there: \(FaceView.labels[r - 1]). Change")
                }
                roundAction(.directions, label: "Directions") { Settings.shared.directions(to: place) }
                // The floating card has no round post button: beside Directions it read as the venue's
                // own Instagram (Sarp, 2026-11-22); its source block opens the post instead.
                if !expanded, postURLs.count == 1, let url = postURLs.first {
                    roundAction(.post, label: "Post") { open(url) }
                } else if !expanded, postURLs.count > 1 {
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

            // Why it's on your list, as a short story: you and the place, then where it came from
            // (Sarp, 2026-11-22; web: PlaceCard's You and Source, designed on backoffice /card).
            // While the switch is open with no visits it says Been there itself.
            if expanded, place.visitCount > 0, folded || !place.visits.isEmpty { visitsRow }
            if expanded { source }

            // Many visits: the row above says it; the switch would undo them all with one tap.
            if expanded && !folded && place.visitCount <= 1 {
                VisitSwitch(place: place, onPicked: { visitOpen = false })
            }

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
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// You and the place: "Been there" (no day known), "Been 3 times · last 12 Nov", your notes' latest, and your photos (I'm here): the post's photo stays the
    /// card's, yours sit under it (Sarp's "hybrid", 2026-11-20).
    private var visitsRow: some View {
        let n = place.visitCount
        let last = place.lastVisit.map { " · last \($0.formatted(.dateTime.day().month(.abbreviated)))" } ?? ""
        let note = place.visits.last(where: { $0.note != nil })?.note
        let photos = place.visitPhotos
        return VStack(alignment: .leading, spacing: 8) {
            Text(place.lastVisit == nil && n == 1 ? "Been there" : (n == 1 ? "Been once" : "Been \(n) times") + last)
                .font(.subheadline.weight(.medium))
            if let note {
                Text("“\(note)”").font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }
            if !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(photos, id: \.self) { VisitPhotoView(name: $0, size: 72) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.top, -6)
        .padding(.bottom, 12)
    }

    /// Where it came from: "Saved from @x on Instagram · 14 Sep", then what the post said in quotes. For a
    /// post the whole block opens it (a chevron says so); lists, typed names and Maps links are the sentence
    /// alone. Under it: "+1 more post" and the venue's own site, left out when it is the poster's own Instagram.
    private var source: some View {
        let why = WhyHere.line(for: place)
        let quote = postURLs.isEmpty ? nil : WhyHere.captionSnippet(place.caption)
        let label = WhyHere.websiteLabel(place.website)
        let own = place.ownerUsername.map { "@" + $0.trimmingCharacters(in: CharacterSet(charactersIn: "@")).lowercased() }
        let site = label.flatMap { $0.lowercased() == own ? nil : $0 }
        let text = VStack(alignment: .leading, spacing: 2) {
            Text(why).foregroundStyle(.secondary)
            if let quote { Text("“\(quote)”").foregroundStyle(.primary).lineLimit(2) }
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
        return VStack(alignment: .leading, spacing: 6) {
            if let url = postURLs.first {
                Button { open(url) } label: {
                    HStack(spacing: 12) {
                        text
                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(why). Open the post")
            } else {
                text
            }
            if postURLs.count > 1 || site != nil {
                HStack(spacing: 12) {
                    if postURLs.count > 1 {
                        Menu {
                            ForEach(Array(postURLs.enumerated()), id: \.offset) { i, url in
                                Button("Post \(i + 1) · \(SourceURL.parse(url)?.kind == .tiktok ? "TikTok" : "Instagram")") { open(url) }
                            }
                        } label: {
                            Text("+\(postURLs.count - 1) more post\(postURLs.count > 2 ? "s" : "")").fontWeight(.medium).foregroundStyle(.primary)
                        }
                    }
                    if let site, let link = place.website, let url = URL(string: link) {
                        Link(site, destination: url).foregroundStyle(.secondary).underline(color: Color(.tertiaryLabel))
                    }
                }
                .font(.subheadline)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, -4)
        .padding(.bottom, 14)
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
        Uses.count("post.open")
        if let url = URL(string: link) { UIApplication.shared.open(url) }
    }
}
