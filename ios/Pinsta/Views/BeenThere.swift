import SwiftUI
import SwiftData

/// Want to go ↔ Been there, then how it was (port of the web's `Visit` in
/// PlaceCard.tsx, 2026-10-06). Two buttons acting as one switch; every place
/// starts as Want to go. Been there stamps `visitedAt` (kept, not shown; a second
/// Been there keeps the first date) and asks for a face. Back to Want to go
/// clears the date and keeps the face, so a slip loses nothing.
struct VisitSwitch: View {
    let place: Place
    /// A face was picked: the card folds all this into it.
    var onPicked: () -> Void = {}
    @Environment(\.modelContext) private var context

    var body: some View {
        let been = place.visitedAt != nil
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                choice(on: !been, height: 48) { Text("Want to go") } action: {
                    if been { place.visitedAt = nil; save() }
                }
                choice(on: been, height: 48) { Text("Been there") } action: {
                    if !been { place.visitedAt = .now; save() }
                }
            }
            if been {
                Text("How was it?")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 16)
                    .padding(.bottom, 8)
                HStack(spacing: 8) {
                    ForEach(1...3, id: \.self) { kind in
                        // The picked face again folds back without a change: Want to go is the way out.
                        choice(on: place.rating == kind, height: 64) { FaceView(kind: kind, size: 30) } action: {
                            place.rating = kind
                            save()
                            onPicked()
                        }
                        .accessibilityLabel(FaceView.labels[kind - 1])
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }

    private func choice<L: View>(on: Bool, height: CGFloat, @ViewBuilder label: () -> L, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy) { action() }
        } label: {
            label()
                .font(.subheadline.weight(.medium))
                .foregroundStyle(on ? Color(.systemBackground) : .primary)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background(on ? AnyShapeStyle(Color.primary) : AnyShapeStyle(Color(.tertiarySystemFill)), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func save() {
        try? context.save()
    }
}

/// 😞 🙂 😃 as a filled face with its features cut out, in the current foreground
/// style, so it reads on light and dark tiles alike (web: `Face` in PlaceCard.tsx,
/// same 24-unit drawing).
struct FaceView: View {
    let kind: Int
    var size: CGFloat = 30
    static let labels = ["Not good", "Good", "Loved it"]

    var body: some View {
        Canvas { ctx, box in
            let s = box.width / 24
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
            ctx.fill(Path(ellipseIn: CGRect(x: 1 * s, y: 1 * s, width: 22 * s, height: 22 * s)), with: .foreground)
            ctx.blendMode = .destinationOut
            if kind == 3 {
                var plus = Path()
                for cx: CGFloat in [8.5, 15.5] {
                    plus.move(to: pt(cx, 6.8)); plus.addLine(to: pt(cx, 10.2))
                    plus.move(to: pt(cx - 1.7, 8.5)); plus.addLine(to: pt(cx + 1.7, 8.5))
                }
                ctx.stroke(plus, with: .color(.black), style: StrokeStyle(lineWidth: 1.6 * s, lineCap: .round))
                var mouth = Path()
                mouth.addArc(center: pt(12, 12.5), radius: 5.5 * s, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false)
                mouth.closeSubpath()
                ctx.fill(mouth, with: .color(.black))
            } else {
                for cx: CGFloat in [8.5, 15.5] {
                    ctx.fill(Path(ellipseIn: CGRect(x: (cx - 1.6) * s, y: 7.9 * s, width: 3.2 * s, height: 3.2 * s)), with: .color(.black))
                }
                var mouth = Path()
                if kind == 1 {
                    mouth.move(to: pt(7.5, 17.5)); mouth.addQuadCurve(to: pt(16.5, 17.5), control: pt(12, 13))
                } else {
                    mouth.move(to: pt(7.5, 14)); mouth.addQuadCurve(to: pt(16.5, 14), control: pt(12, 18.5))
                }
                ctx.stroke(mouth, with: .color(.black), style: StrokeStyle(lineWidth: 1.8 * s, lineCap: .round))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Buddy menu → Been there (web: BeenThereSheet): the places marked Been there,
/// latest marked first, each with its face. No dates and no sorting controls
/// (Sarp, 2026-10-06: today's dates are the day of marking, not of the visit).
struct BeenThereSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Query(filter: #Predicate<Place> { $0.visitedAt != nil }, sort: \Place.visitedAt, order: .reverse)
    private var been: [Place]

    var body: some View {
        NavigationStack {
            Group {
                if been.isEmpty {
                    Text("Nothing yet. Open a place and tap Been there.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .padding(24)
                } else {
                    List(been) { p in
                        HStack(spacing: 12) {
                            p.category.icon
                                .resizable()
                                .scaledToFit()
                                .frame(width: 24, height: 24)
                                .frame(width: 40, height: 40)
                                .background(p.category.tint, in: Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                                Text([p.category.rawValue, p.city].compactMap { $0 }.joined(separator: " · "))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            if let r = p.rating, (1...3).contains(r) {
                                FaceView(kind: r, size: 24)
                                    .foregroundStyle(.primary.opacity(0.8))
                                    .accessibilityLabel(FaceView.labels[r - 1])
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(been.isEmpty ? "Been there" : "Been there · \(been.count)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(Settings.shared.appearance.scheme)
    }
}
