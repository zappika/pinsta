import SwiftUI
import SwiftData

/// "Been to any of these?" on open (Sarp, 2026-10-26; who is asked when: `AskVisit`; web: VisitAsk.tsx).
/// One row a place; Yes folds that row open into the faces, so two questions feel like one. Rows left
/// alone stay Want to go. One button closes it all: nobody answers place by place unless they want to.
struct VisitAskSheet: View {
    let places: [Place]
    let onClose: () -> Void
    @Environment(\.modelContext) private var context
    @State private var yes: Set<UUID> = []
    /// Faces picked in this sheet: undoing a Yes takes those back, not one from before.
    @State private var faced: Set<UUID> = []

    private var label: String { places.count == 1 ? "Been to \(places[0].name)?" : "Been to any of these?" }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label.uppercased())
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 4)
            ForEach(places) { place in
                row(place)
                if place.id != places.last?.id { Divider().padding(.leading, 16) }
            }
            Button(action: onClose) {
                Text(yes.isEmpty ? "Not yet" : "Done")
                    .font(.headline)
                    .foregroundStyle(Color(.systemBackground))
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Color.primary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(16)
        }
        .background(Color(.secondarySystemGroupedBackground))
        .animation(.snappy, value: yes)
    }

    private func row(_ place: Place) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Group {
                    if place.imageData != nil {
                        PlacePhoto(place: place, points: 44)
                    } else {
                        place.icon.resizable().scaledToFit()
                            .frame(width: 28, height: 28)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(place.category.tint)
                    }
                }
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(place.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                    Text([place.category.rawValue, place.city].compactMap { $0 }.joined(separator: " · "))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 0)
                if !yes.contains(place.id) {
                    Button {
                        yes.insert(place.id)
                        if place.visitedAt == nil { place.visitedAt = .now; Uses.count("visited") }
                        try? context.save()
                    } label: {
                        Text("Yes")
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 16).frame(height: 36)
                            .background(Color(.tertiarySystemFill), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            if yes.contains(place.id) {
                // A Yes tapped by mistake folds back: Want to go again, and no face from here.
                HStack {
                    Text("How was it?").font(.subheadline).foregroundStyle(.secondary)
                    Spacer()
                    Button("Not yet") {
                        yes.remove(place.id)
                        place.visitedAt = nil
                        if faced.contains(place.id) { place.rating = nil; faced.remove(place.id) }
                        try? context.save()
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    ForEach(1...3, id: \.self) { kind in
                        let on = place.rating == kind
                        Button {
                            place.rating = kind
                            faced.insert(place.id)
                            try? context.save()
                        } label: {
                            FaceView(kind: kind, size: 26)
                                .foregroundStyle(on ? Color(.systemBackground) : .primary)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(on ? AnyShapeStyle(Color.primary) : AnyShapeStyle(Color(.tertiarySystemFill)), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(FaceView.labels[kind - 1])
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
    }
}
