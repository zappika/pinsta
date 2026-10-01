import SwiftUI

/// The Where / What picker, as the web has it (`Filters.tsx: Picker`): a dimmed
/// backdrop and a card 12pt off the bottom edge. Small caps title, one row per
/// option with its count on the right, a check on the chosen one. Replaces the
/// system Menu, which Sarp found worse than the web's (2026-10-01).
struct FilterPicker: View {
    struct Option: Identifiable {
        let id: String
        let label: String
        let count: Int?
        var locate = false
        let selected: Bool
        let pick: () -> Void
    }

    let title: String
    let options: [Option]
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)
                .transition(.opacity)
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel("Close")

            VStack(alignment: .leading, spacing: 0) {
                Text(title.uppercased())
                    .font(.caption.weight(.medium))
                    .tracking(0.6)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 4)
                // A long Where list scrolls; a short one sizes to its rows.
                ViewThatFits(in: .vertical) {
                    rows
                    ScrollView { rows }
                }
            }
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.top, 80)
            .padding(.bottom, 12)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(Array(options.enumerated()), id: \.element.id) { i, o in
                if i > 0 { Divider().padding(.leading, 16) }
                Button(action: o.pick) {
                    HStack(spacing: 8) {
                        if o.locate { Image(systemName: "location.fill").font(.subheadline) }
                        Text(o.label)
                            .fontWeight(o.selected ? .semibold : .medium)
                            .lineLimit(1)
                        Spacer(minLength: 12)
                        if let count = o.count {
                            Text("\(count)")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.tertiary)
                        }
                        if o.selected {
                            Image(systemName: "checkmark")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color(.label))
                        }
                    }
                    .foregroundStyle(Color(.label))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(RowPress())
            }
        }
    }
}

/// The web row's `active:bg-stone-50`: a faint fill while pressed.
private struct RowPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color(.tertiarySystemFill) : .clear)
    }
}
