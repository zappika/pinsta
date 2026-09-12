import SwiftUI

/// Swipe right-to-left: the card slides over two round buttons, change and
/// remove. Keep going, all the way, and the card flies off — removed.
struct SwipeCard<Content: View>: View {
    let isOpen: Bool
    let onOpen: () -> Void
    let onClose: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    @ViewBuilder let content: () -> Content

    private let rail: CGFloat = 128   // two 48pt buttons + gaps
    private let full: CGFloat = 0.6   // past this fraction of the width, the swipe itself removes

    @State private var offset: CGFloat = 0
    @State private var dragging = false
    @State private var gone = false

    @State private var width: CGFloat = 360

    var body: some View {
        ZStack(alignment: .trailing) {
            HStack(spacing: 12) {
                roundButton("pencil", tint: Color(.secondarySystemFill), foreground: .primary, action: onEdit)
                roundButton("trash", tint: .red, foreground: .white) { fly() }
            }
            .padding(.trailing, 16)
            .frame(width: rail, alignment: .trailing)
            .opacity(min(1, -offset / (rail * 0.6)))

            // Hit-testing must travel with the card: gestures go on before the offset,
            // otherwise the card's original full-width frame keeps covering the buttons.
            content()
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                .contentShape(Rectangle())
                .onTapGesture { if isOpen { close() } }
                .gesture(
                    DragGesture(minimumDistance: 14, coordinateSpace: .local)
                        .onChanged { v in
                            // Vertical drags belong to the scroll view.
                            guard dragging || abs(v.translation.width) > abs(v.translation.height) else { return }
                            dragging = true
                            let base: CGFloat = isOpen ? -rail : 0
                            let raw = base + v.translation.width
                            offset = raw > 0 ? raw / 4 : max(raw, -width)
                        }
                        .onEnded { _ in
                            guard dragging else { return }
                            dragging = false
                            if offset < -width * full {
                                fly()
                            } else if offset < -rail / 2 {
                                withAnimation(.snappy) { offset = -rail }
                                onOpen()
                            } else {
                                close()
                            }
                        }
                )
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
                .offset(x: offset)
        }
        .frame(maxHeight: gone ? 0 : nil)
        .opacity(gone ? 0 : 1)
        .clipped()
        .onChange(of: isOpen) { _, open in
            if !dragging { withAnimation(.snappy) { offset = open ? -rail : 0 } }
        }
    }

    private func close() {
        withAnimation(.snappy) { offset = 0 }
        onClose()
    }

    private func fly() {
        withAnimation(.easeIn(duration: 0.2)) { offset = -width * 1.2 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.snappy) { gone = true }
            onDelete()
        }
    }

    private func roundButton(_ symbol: String, tint: Color, foreground: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.medium))
                .foregroundStyle(foreground)
                .frame(width: 48, height: 48)
                .background(tint, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!isOpen)
    }
}
