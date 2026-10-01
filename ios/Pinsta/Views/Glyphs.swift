import SwiftUI

/// The web card's two round-button icons, drawn from the same 24×24 SVG paths
/// (`PlaceCard.tsx`) so both apps show the same outline arrow and Instagram
/// mark. SF Symbols had no match for either (Sarp preferred the web's, 2026-10-01).
enum Glyph {
    case directions, post

    @ViewBuilder
    func view(size: CGFloat = 18) -> some View {
        // stroke-width 1.75 in a 24-unit box, round caps and joins.
        let style = StrokeStyle(lineWidth: 1.75 * size / 24, lineCap: .round, lineJoin: .round)
        switch self {
        case .directions:
            DirectionsArrow().stroke(style: style).frame(width: size, height: size)
        case .post:
            ZStack {
                InstagramOutline().stroke(style: style)
                InstagramDot().fill()
            }
            .frame(width: size, height: size)
        }
    }
}

/// `M21 3 3 10.5l7.5 3L13.5 21 21 3Z`
private struct DirectionsArrow: Shape {
    func path(in rect: CGRect) -> Path {
        let u = rect.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 21 * u, y: 3 * u))
        p.addLine(to: CGPoint(x: 3 * u, y: 10.5 * u))
        p.addLine(to: CGPoint(x: 10.5 * u, y: 13.5 * u))
        p.addLine(to: CGPoint(x: 13.5 * u, y: 21 * u))
        p.closeSubpath()
        return p.offsetBy(dx: rect.minX, dy: rect.minY)
    }
}

/// `rect 3.5,3.5 17×17 rx 5` and `circle 12,12 r 4`.
private struct InstagramOutline: Shape {
    func path(in rect: CGRect) -> Path {
        let u = rect.width / 24
        var p = Path()
        p.addRoundedRect(in: CGRect(x: 3.5 * u, y: 3.5 * u, width: 17 * u, height: 17 * u),
                         cornerSize: CGSize(width: 5 * u, height: 5 * u), style: .continuous)
        p.addEllipse(in: CGRect(x: 8 * u, y: 8 * u, width: 8 * u, height: 8 * u))
        return p.offsetBy(dx: rect.minX, dy: rect.minY)
    }
}

/// `circle 17.2,6.8 r 0.9`, filled.
private struct InstagramDot: Shape {
    func path(in rect: CGRect) -> Path {
        let u = rect.width / 24
        return Path(ellipseIn: CGRect(x: 16.3 * u, y: 5.9 * u, width: 1.8 * u, height: 1.8 * u))
            .offsetBy(dx: rect.minX, dy: rect.minY)
    }
}
