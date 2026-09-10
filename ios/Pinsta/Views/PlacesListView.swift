import SwiftUI
import SwiftData

struct PlacesListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Place.createdAt, order: .reverse) private var places: [Place]

    @State private var city: String?
    @State private var category: PlaceCategory?
    @State private var adding = false
    @State private var importing = false

    private var visible: [Place] {
        places.filter { p in
            (city == nil || p.city == city) && (category == nil || p.category == category)
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    header
                        .padding(.bottom, 4)

                    if importing && places.isEmpty {
                        ForEach(0..<3, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color(.secondarySystemGroupedBackground))
                                .frame(height: 112)
                        }
                    } else if places.isEmpty {
                        emptyState
                    } else if visible.isEmpty {
                        Text("No places match.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 48)
                    }

                    ForEach(visible) { place in
                        PlaceCardView(place: place) {
                            context.delete(place)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 120)
            }
            .background(Color(.systemGroupedBackground))

            saveButton
        }
        .sheet(isPresented: $adding) {
            AddPlaceView()
        }
        .task {
            importing = true
            await WebImporter.runIfEmpty(in: context)
            importing = false
        }
        .onChange(of: city) { _, _ in category = nil }
    }

    // MARK: - Header: "Barcelona ▾  Restaurants ▾"

    private var cities: [(String, Int)] {
        var counts: [String: Int] = [:]
        for p in places { if let c = p.city { counts[c, default: 0] += 1 } }
        return counts.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
    }

    private var categories: [(PlaceCategory, Int)] {
        let scoped = city == nil ? places : places.filter { $0.city == city }
        var counts: [PlaceCategory: Int] = [:]
        for p in scoped { counts[p.category, default: 0] += 1 }
        return PlaceCategory.allCases.compactMap { c in counts[c].map { (c, $0) } }
    }

    @ViewBuilder
    private var header: some View {
        if places.isEmpty {
            Text("Pinsta")
                .font(.title.weight(.semibold))
                .padding(.top, 12)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Menu {
                    Picker("Where", selection: $city) {
                        Label("Everywhere · \(places.count)", systemImage: "globe").tag(String?.none)
                        ForEach(cities, id: \.0) { name, count in
                            Text("\(name) · \(count)").tag(String?.some(name))
                        }
                    }
                } label: {
                    headerLabel(city ?? "Everywhere", muted: false)
                }

                Menu {
                    Picker("What", selection: $category) {
                        Text("Everything · \(categories.reduce(0) { $0 + $1.1 })").tag(PlaceCategory?.none)
                        ForEach(categories, id: \.0) { cat, count in
                            Text("\(cat.plural) · \(count)").tag(PlaceCategory?.some(cat))
                        }
                    }
                } label: {
                    headerLabel(category?.plural ?? "Everything", muted: true)
                }
                Spacer(minLength: 0)
            }
            .padding(.top, 12)
        }
    }

    private func headerLabel(_ text: String, muted: Bool) -> some View {
        HStack(spacing: 4) {
            Text(text).lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.footnote.weight(.bold))
                .opacity(0.6)
        }
        .font(.title.weight(.semibold))
        .foregroundStyle(muted ? Color.secondary : Color.primary)
    }

    private var emptyState: some View {
        VStack(spacing: 4) {
            Text("Nothing saved yet").font(.headline)
            Text("Paste an Instagram post and pin the place it shows.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 96)
    }

    private var saveButton: some View {
        Button {
            adding = true
        } label: {
            Text("Save a place")
                .font(.body.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.primary, in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(Color(.systemBackground))
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .background(
            LinearGradient(
                colors: [Color(.systemGroupedBackground).opacity(0), Color(.systemGroupedBackground)],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 96)
            .offset(y: -8),
            alignment: .top
        )
    }
}
