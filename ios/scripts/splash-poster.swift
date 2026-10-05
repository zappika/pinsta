// Make the splash posters match the movie on screen.
//
//   swift ios/scripts/splash-poster.swift ios/Pinsta/Resources/Assets.xcassets/VicoloSplashPoster.imageset
//
// The poster is the movie's first decoded frame. The video renderer (AVPlayerLayer) shows those decoded
// values as they are, but the launch screen and UIImageView honour a PNG's colour profile, and the
// exported posters carried an "HDTV" (Rec. 709) profile: they showed up brighter than the movie, a
// visible dim at the hand-off (measured 2026-10-05). So: same pixels, labelled sRGB. No conversion.
// Check afterwards with -splashPosterOnly / -splashFrozen screenshots (CLAUDE.md, "Splash assets").
import AppKit

let dir = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
for name in ["light.png", "dark.png"] {
    let url = dir.appendingPathComponent(name)
    guard let data = try? Data(contentsOf: url), let rep = NSBitmapImageRep(data: data) else {
        print("skip \(name): not found"); continue
    }
    let before = rep.colorSpace.localizedName ?? "untagged"
    guard let out = rep.retagging(with: .sRGB), let png = out.representation(using: .png, properties: [:]) else {
        print("fail \(name)"); exit(1)
    }
    try! png.write(to: url)
    print("\(name): \(before) → sRGB (pixels unchanged)")
}
