import SwiftUI

/// Before the system's location question (Sarp, 2026-10-15): one page in the tutorial's
/// look that says why, shown once the list has `NearMe.askAfter` places and location was
/// never asked. One button, always on to the system's question: App Review rejects a
/// pre-permission screen that lets you skip it (5.1.1); "Don't Allow" is the system's.
struct LocationPrimer: View {
    /// Two of their own places, drawn as pins on the picture.
    let places: [Place]
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            TutorialPage(
                title: "Open on your town",
                subtitle: "Wherever you are, your places nearby come first.",
                caption: "Next, your iPhone asks to share your location while you use Vicolo. It stays on your phone.",
                spoken: "Next, your iPhone asks to share your location while you use Vicolo. It stays on your phone.",
                art: { NearbyArt(places: places) }
            )

            Button(action: onContinue) {
                Text("Continue")
                    .font(.headline)
                    .foregroundStyle(Tutorial.actionText)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Tutorial.action, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows the iPhone's question about sharing your location.")
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
        .padding(.top, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tutorial.background)
    }
}

/// A drawn town (not MapKit: works offline, never shows a "you" in the wrong place):
/// streets, a park, water, two of your pins and the blue dot between them.
private struct NearbyArt: View {
    let places: [Place]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    private static let land = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.17, alpha: 1) : UIColor(red: 0.96, green: 0.94, blue: 0.90, alpha: 1) })
    private static let street = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.26, alpha: 1) : .white })
    private static let park = Color(red: 0.70, green: 0.85, blue: 0.66).opacity(0.7)
    private static let water = Color(red: 0.62, green: 0.80, blue: 0.94).opacity(0.8)
    private static let blue = Color(red: 0.10, green: 0.45, blue: 0.91)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                Self.land
                // Water along the bottom-left, a park top-right.
                Path { p in
                    p.move(to: CGPoint(x: 0, y: h * 0.72))
                    p.addCurve(to: CGPoint(x: w * 0.55, y: h), control1: CGPoint(x: w * 0.2, y: h * 0.7), control2: CGPoint(x: w * 0.35, y: h * 0.95))
                    p.addLine(to: CGPoint(x: 0, y: h))
                    p.closeSubpath()
                }
                .fill(Self.water)
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Self.park)
                    .frame(width: w * 0.3, height: h * 0.22)
                    .position(x: w * 0.8, y: h * 0.16)
                // Streets.
                Path { p in
                    p.move(to: CGPoint(x: 0, y: h * 0.38)); p.addLine(to: CGPoint(x: w, y: h * 0.30))
                    p.move(to: CGPoint(x: w * 0.32, y: 0)); p.addLine(to: CGPoint(x: w * 0.42, y: h))
                    p.move(to: CGPoint(x: w * 0.62, y: h * 0.32)); p.addLine(to: CGPoint(x: w, y: h * 0.78))
                }
                .stroke(Self.street, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                Path { p in
                    p.move(to: CGPoint(x: 0, y: h * 0.12)); p.addLine(to: CGPoint(x: w * 0.6, y: h * 0.06))
                    p.move(to: CGPoint(x: w * 0.42, y: h * 0.6)); p.addLine(to: CGPoint(x: w, y: h * 0.56))
                    p.move(to: CGPoint(x: w * 0.12, y: h * 0.38)); p.addLine(to: CGPoint(x: w * 0.16, y: h * 0.7))
                }
                .stroke(Self.street, style: StrokeStyle(lineWidth: 5, lineCap: .round))

                pin(places.first).position(x: w * 0.22, y: h * 0.24)
                pin(places.dropFirst().first).position(x: w * 0.76, y: h * 0.62)
                here.position(x: w * 0.5, y: h * 0.44)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 14, y: 4)
        .aspectRatio(0.95, contentMode: .fit)
        .onAppear { if !reduceMotion { pulse = true } }
    }

    private var here: some View {
        ZStack {
            Circle()
                .fill(Self.blue.opacity(0.3))
                .frame(width: 96, height: 96)
                .scaleEffect(pulse ? 1 : 0.55)
                .opacity(pulse ? 0.2 : 1)
                .animation(.easeOut(duration: 1.8).repeatForever(autoreverses: false), value: pulse)
            Circle().fill(.white).frame(width: 26, height: 26).shadow(color: .black.opacity(0.2), radius: 3, y: 1)
            Circle().fill(Self.blue).frame(width: 18, height: 18)
        }
    }

    /// The map's own pin: the place's icon on its type tint (`PlacesMapView`).
    private func pin(_ place: Place?) -> some View {
        let category = place?.category ?? .restaurant
        return (place?.icon ?? category.icon).resizable().scaledToFit()
            .frame(width: 30, height: 30)
            .frame(width: 48, height: 48)
            .background(category.tint, in: Circle())
            .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 3))
            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
    }
}
