import SwiftUI
import SwiftData

/// Want to go ↔ Been there, then how it was (port of the web's `Visit` in
/// PlaceCard.tsx, 2026-10-06). Two buttons acting as one switch; every place
/// starts as Want to go. Been there stamps `visitedAt` as a flag only, no visit and no day
/// (Sarp, 2026-11-22: tapping it doesn't mean you were there today; only Check in says when),
/// and asks for a face. Back to Want to go
/// clears the date and keeps the face, so a slip loses nothing.
struct VisitSwitch: View {
    let place: Place
    /// A face was picked: the card folds all this into it.
    var onPicked: () -> Void = {}
    @Environment(\.modelContext) private var context

    var body: some View {
        let been = place.visitedAt != nil
        VStack(alignment: .leading, spacing: 0) {
            // One track, one lit half: it reads as a switch, not two actions (Sarp, 2026-10-19).
            HStack(spacing: 4) {
                segment(on: !been, "Want to go") { if been { place.unvisit(); save() } }
                // Been there, no day: only Check in records when (VisitAskSheet's Yes does the same).
                segment(on: been, been ? "🙋🏻‍♀️ Been there" : "Been there") { if !been { place.visitedAt = .now; save(); Uses.count("visited") } }
            }
            .padding(4)
            .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                            if var last = place.visits.last { last.rating = kind; place.update(last) }
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

    /// Been there gains its 🙋🏻‍♀️ only once picked (Sarp, 2026-10-19: a grey hand read as a stop sign).
    private func segment(on: Bool, _ title: String, action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(on ? Color.primary : Color.secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background {
                    if on {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color(.systemBackground))
                            .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
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

/// Buddy menu → Been there: your check-ins as a timeline, or the places with how often (Sarp,
/// 2026-11-20, with I'm here). Grouped by day with the day's town, so "where did you go in Italy?"
/// is a scroll. Places marked Been there before check-ins existed have only the day they were
/// marked, not the day of the visit: they sit at the end, undated (as the old list had no dates).
struct BeenThereSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(filter: #Predicate<Place> { $0.visitedAt != nil }, sort: \Place.visitedAt, order: .reverse)
    private var been: [Place]
    @State private var mode: Mode = .timeline
    private enum Mode: String, CaseIterable { case timeline = "Timeline", places = "Places" }

    /// One check-in, with the place it was at.
    private struct Entry: Identifiable {
        let place: Place
        let visit: Visit
        var id: UUID { visit.id }
    }

    private struct Day: Identifiable {
        let date: Date
        let entries: [Entry]
        var id: Date { date }
        /// The town most of the day's check-ins were in.
        var town: String? {
            let towns = entries.compactMap(\.place.city)
            return Dictionary(grouping: towns, by: { $0 }).max { $0.value.count < $1.value.count }?.key
        }
    }

    private var entries: [Entry] {
        been.flatMap { p in p.visits.filter(\.dated).map { Entry(place: p, visit: $0) } }
            .sorted { $0.visit.at > $1.visit.at }
    }

    private var days: [Day] {
        let cal = Calendar.current
        return Dictionary(grouping: entries) { cal.startOfDay(for: $0.visit.at) }
            .map { Day(date: $0.key, entries: $0.value.sorted { $0.visit.at > $1.visit.at }) }
            .sorted { $0.date > $1.date }
    }

    /// Been there with no visit (marked before check-ins, or a Yes to "Been to any of these?" for a place
    /// not saved on the spot): the day isn't known.
    private var undated: [Place] { been.filter { $0.visits.isEmpty || $0.visits.contains { !$0.dated } } }

    private var summary: String {
        let checkIns = entries.count
        let towns = Set(been.compactMap(\.city)).count
        return [
            checkIns > 0 ? "\(checkIns) check-in\(checkIns == 1 ? "" : "s")" : nil,
            "\(been.count) place\(been.count == 1 ? "" : "s")",
            towns > 1 ? "\(towns) towns" : nil,
        ].compactMap { $0 }.joined(separator: " · ")
    }

    var body: some View {
        NavigationStack {
            Group {
                if been.isEmpty {
                    Text("Nothing yet. Tap + → Check in when you're at a place.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .padding(24)
                } else {
                    List {
                        Section {
                            Picker("Show", selection: $mode) {
                                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
                            }
                            .pickerStyle(.segmented)
                            .listRowSeparator(.hidden)
                            Text(summary)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .listRowSeparator(.hidden)
                        }
                        if mode == .timeline { timeline } else { placesList }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Been there")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(Settings.shared.appearance.scheme)
    }

    // MARK: Timeline

    @ViewBuilder
    private var timeline: some View {
        ForEach(days) { day in
            Section {
                ForEach(day.entries) { e in
                    open(e.place) { checkInRow(e) }
                        // A wrong check-in goes; the place stays (Want to go again if it was the only one).
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button("Delete", role: .destructive) {
                                withAnimation { e.place.removeVisit(e.visit.id) }
                                try? context.save()
                            }
                        }
                }
            } header: {
                dayHeader(day.date, town: day.town)
            }
        }
        if !undated.isEmpty {
            Section {
                ForEach(undated) { p in
                    open(p) { placeRow(p) }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button("Not been", role: .destructive) {
                                // With dated check-ins too, only the undated one goes.
                                withAnimation {
                                    if let u = p.visits.first(where: { !$0.dated }), p.visits.count > 1 { p.removeVisit(u.id) } else { p.unvisit() }
                                }
                                try? context.save()
                            }
                        }
                }
            } header: {
                Text("No date").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary).textCase(nil)
            }
        }
    }

    /// "Today · Paris", "Saturday 15 Nov · Bologna", "3 Mar 2025 · Lisbon".
    private func dayHeader(_ date: Date, town: String?) -> some View {
        let cal = Calendar.current
        let label: String
        if cal.isDateInToday(date) { label = "Today" }
        else if cal.isDateInYesterday(date) { label = "Yesterday" }
        else if cal.isDate(date, equalTo: .now, toGranularity: .year) { label = date.formatted(.dateTime.weekday(.wide).day().month(.abbreviated)) }
        else { label = date.formatted(.dateTime.day().month(.abbreviated).year()) }
        return Text([label, town].compactMap { $0 }.joined(separator: " · "))
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.primary)
            .textCase(nil)
    }

    private func checkInRow(_ e: Entry) -> some View {
        HStack(alignment: .top, spacing: 12) {
            thumb(e.place)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(e.place.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                    Spacer(minLength: 4)
                    Text(e.visit.at.formatted(date: .omitted, time: .shortened))
                        .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
                HStack(spacing: 6) {
                    if let r = e.visit.rating, (1...3).contains(r) {
                        FaceView(kind: r, size: 16).foregroundStyle(.primary.opacity(0.8))
                            .accessibilityLabel(FaceView.labels[r - 1])
                    }
                    Text(e.place.category.rawValue).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                if let note = e.visit.note {
                    Text("“\(note)”").font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
                }
                if !e.visit.photos.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(e.visit.photos, id: \.self) { VisitPhotoView(name: $0, size: 64) }
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    // MARK: Places

    @ViewBuilder
    private var placesList: some View {
        // Most visited first, then the latest.
        let sorted = been.sorted { ($0.visitCount, $0.lastVisit ?? .distantPast) > ($1.visitCount, $1.lastVisit ?? .distantPast) }
        ForEach(sorted) { p in open(p) { placeRow(p) } }
    }

    private func placeRow(_ p: Place) -> some View {
        HStack(spacing: 12) {
            thumb(p)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text([p.category.rawValue, p.city].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if p.visitCount > 1 {
                Text("\(p.visitCount)×").font(.subheadline.weight(.medium)).foregroundStyle(.secondary).monospacedDigit()
            }
            if let r = p.rating, (1...3).contains(r) {
                FaceView(kind: r, size: 24)
                    .foregroundStyle(.primary.opacity(0.8))
                    .accessibilityLabel(FaceView.labels[r - 1])
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// A row that opens its place's card on the map behind (the sheet closes first).
    private func open<Row: View>(_ p: Place, @ViewBuilder row: () -> Row) -> some View {
        Button {
            Settings.shared.openPlace = p
            dismiss()
        } label: { row().contentShape(Rectangle()) }
        .buttonStyle(.plain)
    }

    /// The place's photo, or its type icon on its tint.
    @ViewBuilder
    private func thumb(_ p: Place) -> some View {
        if p.imageData != nil {
            PlacePhoto(place: p, points: 40).frame(width: 40, height: 40).clipShape(Circle())
        } else {
            p.icon
                .resizable()
                .scaledToFit()
                .frame(width: 24, height: 24)
                .frame(width: 40, height: 40)
                .background(p.category.tint, in: Circle())
        }
    }
}
