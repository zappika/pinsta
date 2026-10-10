import SwiftUI

/// Restaurants get a food icon instead of one icon for all (Sarp, 2026-10-09). MapKit has
/// no cuisine, so iOS reads the name and caption ("Trattoria …", "#ramen"); a plain name
/// keeps the Restaurant icon. Same words, same order as `lib/food.ts` (the web also reads
/// Google's type). Icons in Assets.xcassets/Food.
enum Food {
    // The first kind whose word appears wins.
    private static let kinds: [(icon: String, words: [String])] = [
        ("fine-dining", ["fine dining", "tasting menu"]),
        ("ramen", ["ramen"]),
        ("salmon-nigiri", ["sushi", "izakaya", "omakase", "japanese"]),
        ("pizza", ["pizzeria", "pizza", "trattoria", "osteria", "ristorante", "italian"]),
        ("burger", ["burger"]),
        ("steak", ["steak", "asador", "grill", "churrasc", "bbq"]),
        ("thai-noodles", ["thai", "pho", "vietnam"]),
        ("indian-curry", ["indian", "curry", "tandoor", "masala"]),
        ("hummus", ["falafel", "hummus", "meze", "mezze", "lebanese"]),
        ("souvlaki", ["souvlaki", "gyros", "greek"]),
        ("avocado-toast", ["brunch", "breakfast"]),
        ("sardine-tin", ["seafood", "marisquer", "oyster", "fish"]),
        ("gilda", ["tapas", "pintxo", "bodega", "taberna"]),
    ]

    /// The asset name ("Food/pizza"), or nil.
    static func icon(name: String, caption: String?, handle: String? = nil) -> String? {
        let text = " " + (name + " " + (caption ?? "")).lowercased()
        for kind in kinds {
            for w in kind.words where text.range(of: "(^|[^a-z])" + NSRegularExpression.escapedPattern(for: w), options: .regularExpression) != nil {
                return "Food/" + kind.icon
            }
        }
        // The account's handle is glued ("hundredburgers_"), so there a word counts anywhere
        // in it (Sarp, 2026-10-10: a burger place's name and caption never said burger).
        if let handle = handle?.lowercased(), !handle.isEmpty {
            for kind in kinds {
                for w in kind.words where !w.contains(" ") && w.count >= 4 && handle.contains(w) {
                    return "Food/" + kind.icon
                }
            }
        }
        return nil
    }
}

extension Place {
    /// The food icon for a restaurant we can read, else the type's icon.
    var icon: Image {
        if category == .restaurant, let food = Food.icon(name: name, caption: caption, handle: ownerUsername) { return Image(food) }
        return category.icon
    }
}
