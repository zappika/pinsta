import SwiftUI

/// The empty list: three static pages that teach the share from Instagram
/// (approved design, `exports/vicolo-onboarding-handoff`, 2026-10-05). Shown while
/// there is nothing to show and gone with the first save, so no "seen" flag: an
/// empty list always gets the guidance. Trattoria Lina is artwork, never a place.
struct EmptyTutorial: View {
    @Binding var page: Int
    let onPaste: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                TutorialPage(
                    title: "Found a place?",
                    subtitle: "Save it from Instagram.",
                    caption: "1. Tap Share on a post",
                    spoken: "Step 1 of 3. In Instagram, tap Share on a post of a place.",
                    art: { InstagramPostArt() }
                )
                .tag(0)
                TutorialPage(
                    title: "Send it to Vicolo",
                    subtitle: "Keep it for your next outing.",
                    caption: "2. Choose Vicolo",
                    spoken: "Step 2 of 3. In the share sheet, choose Vicolo.",
                    art: { ShareSheetArt() },
                    footer: { FavoritesHelp() }
                )
                .tag(1)
                TutorialPage(
                    title: "Your next favorite, saved.",
                    subtitle: "A little collection of places.",
                    caption: "3. Find your saved places here",
                    spoken: "Step 3 of 3. Find your saved places here.",
                    art: { SavedCardArt() }
                )
                .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            PageDots(page: $page, count: 3, animated: !reduceMotion)
                .padding(.top, 4)

            Button(action: onPaste) {
                Text("Paste a link")
                    .font(.headline)
                    .foregroundStyle(Tutorial.actionText)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Tutorial.action, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the save sheet, where you can paste a post or map link.")
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
    }
}

/// Tutorial-local colours from the approved design. Light only was approved; dark
/// falls back to the app's own dark surfaces with the same accents, toned down.
/// The same three pages from the buddy menu, over a list that isn't empty:
/// for showing a friend how to save, and for testing the first run on a full phone.
struct TutorialCover: View {
    let onPaste: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var page = 0

    var body: some View {
        EmptyTutorial(page: $page, onPaste: onPaste)
            // Clear of the × (the empty list has its header there instead).
            .padding(.top, 48)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Tutorial.background)
            .overlay(alignment: .topTrailing) {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 36, height: 36)
                        .background(Color(.tertiarySystemFill), in: Circle())
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .padding(.trailing, 12)
            }
    }
}

enum Tutorial {
    static let background = dynamic(light: 0xFAF7F2, dark: nil)
    static let surface = dynamic(light: 0xFFFFFF, dark: 0x1C1C1E)
    static let blush = dynamic(light: 0xFBECE7, dark: 0x2B1F21)
    static let orange = dynamic(light: 0xFF6B2B, dark: 0xFF8550)
    static let pink = dynamic(light: 0xFF4F8B, dark: 0xFF6A9C)
    static let action = dynamic(light: 0x171717, dark: 0xF2F2F2)
    static let actionText = dynamic(light: 0xFFFFFF, dark: 0x111111)

    /// `dark: nil` keeps the app's grouped background in dark.
    private static func dynamic(light: UInt32, dark: UInt32?) -> Color {
        Color(UIColor { traits in
            if traits.userInterfaceStyle == .dark {
                return dark.map(rgb) ?? .systemGroupedBackground
            }
            return rgb(light)
        })
    }

    private static func rgb(_ hex: UInt32) -> UIColor {
        UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}

// MARK: - Page

/// Title, picture, caption. The picture takes what height the words leave (between
/// `minArt` and `maxArt`); past that — small phones, large text — the page scrolls.
private struct TutorialPage<Art: View, Footer: View>: View {
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey
    let caption: LocalizedStringKey
    /// What VoiceOver reads for the picture and caption together.
    let spoken: String
    @ViewBuilder let art: () -> Art
    @ViewBuilder let footer: () -> Footer

    @State private var top: CGFloat = 0
    @State private var bottom: CGFloat = 0

    private let minArt: CGFloat = 230
    private let maxArt: CGFloat = 420
    private let gap: CGFloat = 20

    var body: some View {
        GeometryReader { geo in
            let art = min(maxArt, max(minArt, geo.size.height - top - bottom - gap * 2))
            ScrollView {
                VStack(spacing: gap) {
                    VStack(spacing: 6) {
                        Text(title)
                            .font(.title.bold())
                            .accessibilityAddTraits(.isHeader)
                        Text(subtitle)
                            .font(.title3)
                    }
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { top = $0 }

                    // A picture: its labels stay picture-sized; the words around it scale.
                    self.art()
                        .dynamicTypeSize(...DynamicTypeSize.large)
                        .frame(maxWidth: 380, maxHeight: art)
                        .accessibilityHidden(true)

                    VStack(spacing: 16) {
                        Text(caption)
                            .font(.callout)
                            .multilineTextAlignment(.center)
                            .accessibilityLabel(spoken)
                        footer()
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 8)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { bottom = $0 }
                }
                .padding(.horizontal, 20)
                .frame(maxWidth: .infinity, minHeight: geo.size.height, alignment: .top)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }
}

extension TutorialPage where Footer == EmptyView {
    init(title: LocalizedStringKey, subtitle: LocalizedStringKey, caption: LocalizedStringKey, spoken: String, @ViewBuilder art: @escaping () -> Art) {
        self.init(title: title, subtitle: subtitle, caption: caption, spoken: spoken, art: art, footer: { EmptyView() })
    }
}

// MARK: - Pictures (decorative; VoiceOver reads the captions)

private struct RestaurantPhoto: View {
    var body: some View {
        Image("OnboardingRestaurant")
            .resizable()
            .scaledToFill()
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .clipped()
    }
}

/// 1: an Instagram post, the share arrow ringed.
private struct InstagramPostArt: View {
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("A")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Color(red: 0.72, green: 0.56, blue: 0.48), in: Circle())
                Text("aroundthecorner").font(.subheadline.weight(.medium)).lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "ellipsis").font(.subheadline.weight(.semibold))
            }
            .padding(.horizontal, 12)
            .frame(height: 52)

            RestaurantPhoto()

            HStack(spacing: 18) {
                Image(systemName: "heart")
                Image(systemName: "message")
                Image(systemName: "paperplane")
                    .background { TapRing(size: 50) }
                Spacer(minLength: 0)
                Image(systemName: "bookmark")
            }
            .font(.system(size: 22))
            .padding(.horizontal, 14)
            .frame(height: 56)
        }
        .background(Tutorial.surface)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 14, y: 4)
        .aspectRatio(0.84, contentMode: .fit)
    }
}

/// 2: the post's photo behind a share sheet with Vicolo in the app row.
private struct ShareSheetArt: View {
    var body: some View {
        ZStack(alignment: .bottom) {
            RestaurantPhoto()
            VStack(spacing: 0) {
                Capsule().fill(Color(.tertiaryLabel)).frame(width: 36, height: 5).padding(.top, 6)
                HStack(alignment: .top) {
                    Image("OnboardingRestaurant")
                        .resizable().scaledToFill()
                        .frame(width: 64, height: 54)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Spacer()
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.secondary)
                        .frame(width: 30, height: 30)
                        .background(Color(.tertiarySystemFill), in: Circle())
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                Divider()
                HStack(alignment: .top, spacing: 0) {
                    ShareApp(label: "AirDrop") { AirDropIcon() }
                    ShareApp(label: "Messages") {
                        Image(systemName: "message.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Color(red: 0.2, green: 0.8, blue: 0.35))
                    }
                    ShareApp(label: "Vicolo", ringed: true) {
                        Image("OnboardingAppIcon").resizable().scaledToFill()
                    }
                    ShareApp(label: "More") {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Color(.label))
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Color(.tertiarySystemFill))
                    }
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 12)
            }
            .background(Tutorial.surface)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22, style: .continuous))
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 14, y: 4)
        .aspectRatio(1.12, contentMode: .fit)
    }
}

private struct ShareApp<Icon: View>: View {
    let label: String
    var ringed = false
    @ViewBuilder let icon: () -> Icon

    var body: some View {
        VStack(spacing: 6) {
            icon()
                .frame(width: 54, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .background { if ringed { TapRing(size: 72) } }
            Text(label).font(.caption2).foregroundStyle(Color(.label)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AirDropIcon: View {
    var body: some View {
        ZStack {
            Color.white
            ForEach(0..<3) { i in
                Circle()
                    .stroke(Color(red: 0.1, green: 0.5, blue: 1), lineWidth: 3)
                    .frame(width: CGFloat(14 + i * 11), height: CGFloat(14 + i * 11))
            }
            Circle().fill(Color(red: 0.1, green: 0.5, blue: 1)).frame(width: 6, height: 6)
        }
    }
}

/// 3: the place saved as a card, the resin elephant on its corner.
private struct SavedCardArt: View {
    var body: some View {
        VStack(spacing: 0) {
            RestaurantPhoto()
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Trattoria Lina").font(.title3.bold()).lineLimit(1).minimumScaleFactor(0.8)
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.circle.fill").foregroundStyle(Tutorial.orange)
                        Text("Italian · Copenhagen").foregroundStyle(.secondary).lineLimit(1)
                    }
                    .font(.subheadline)
                }
                Spacer(minLength: 0)
                Label("Saved", systemImage: "checkmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Tutorial.orange)
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .background(Tutorial.blush, in: Capsule())
                    .fixedSize()
            }
            .padding(.horizontal, 16)
            .frame(height: 84)
        }
        .background(Tutorial.surface)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 14, y: 4)
        .overlay(alignment: .topTrailing) {
            Image("ElephantResin")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .rotationEffect(.degrees(8))
                .offset(x: 8, y: -38)
        }
        .padding(.top, 26)
        .aspectRatio(0.86, contentMode: .fit)
    }
}

/// The orange ring with three short tap rays, upper right.
private struct TapRing: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(Tutorial.orange, lineWidth: 2.5)
            ForEach(0..<3) { i in
                Capsule()
                    .fill(Tutorial.orange)
                    .frame(width: 2.5, height: size * 0.16)
                    .offset(y: -size * 0.66)
                    .rotationEffect(.degrees(20 + Double(i) * 30))
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Page 2 help

/// iOS keeps a new share extension under More until it's a favourite. Chips that
/// show the way, not controls; VoiceOver reads the whole path as one sentence.
private struct FavoritesHelp: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Don’t see Vicolo?").font(.headline)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 4) { chips(arrow: "arrow.right", favorites: "Add to\nFavorites") }
                VStack(alignment: .leading, spacing: 6) { chips(arrow: "arrow.down", favorites: "Add to Favorites") }
            }
            Text("First time only")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
        }
        .padding(14)
        .frame(maxWidth: 380, alignment: .leading)
        .background(Tutorial.blush, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Don’t see Vicolo? First time only: in the share sheet, scroll the row of apps to the end and tap More. Then tap Edit, and add Vicolo to Favorites.")
    }

    @ViewBuilder
    private func chips(arrow: String, favorites: LocalizedStringKey) -> some View {
        Chip(text: "More") {
            Image(systemName: "ellipsis").font(.caption.weight(.bold))
                .frame(width: 26, height: 26).background(Color(.tertiarySystemFill), in: Circle())
        }
        Image(systemName: arrow).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
        Chip(text: "Edit") { Image(systemName: "pencil").font(.subheadline) }
        Image(systemName: arrow).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
        Chip(text: favorites) {
            Image("OnboardingAppIcon").resizable().scaledToFill()
                .frame(width: 26, height: 26)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
    }
}

private struct Chip<Icon: View>: View {
    let text: LocalizedStringKey
    @ViewBuilder let icon: () -> Icon

    var body: some View {
        HStack(spacing: 6) {
            icon()
            Text(text).font(.footnote.weight(.medium)).fixedSize()
                .multilineTextAlignment(.leading)
        }
        .padding(.leading, 6).padding(.trailing, 10)
        .frame(minHeight: 38)
        .background(Tutorial.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// MARK: - Dots

/// Three dots, each tappable; VoiceOver hears one adjustable control ("Page 2 of 3",
/// swipe up or down to change), like the system page control.
private struct PageDots: View {
    @Binding var page: Int
    let count: Int
    let animated: Bool

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { i in
                Button { go(i) } label: {
                    Circle()
                        .fill(i == page ? Tutorial.pink : Color(.tertiaryLabel))
                        .frame(width: 9, height: 9)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page")
        .accessibilityValue("\(page + 1) of \(count)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: go(min(page + 1, count - 1))
            case .decrement: go(max(page - 1, 0))
            @unknown default: break
            }
        }
    }

    private func go(_ i: Int) {
        if animated { withAnimation(.snappy) { page = i } } else { page = i }
    }
}

#Preview("Light") {
    EmptyTutorial(page: .constant(1), onPaste: {})
        .background(Tutorial.background)
}

#Preview("Dark") {
    EmptyTutorial(page: .constant(1), onPaste: {})
        .background(Tutorial.background)
        .preferredColorScheme(.dark)
}
