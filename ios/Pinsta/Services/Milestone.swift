import Foundation

/// The line above the name on the success card, from the list as it was before this save
/// (Sarp, 2026-10-09): new towns and new types only (the very first save is a new town).
/// The town wins over the type; nothing otherwise. Same rules as the web's `lib/milestone.ts`.
enum Milestone {
    static func line(for saved: Place, among all: [Place]) -> String? {
        let others = all.filter { $0.id != saved.id }
        if let town = saved.city?.trimmingCharacters(in: .whitespaces), !town.isEmpty,
           !others.contains(where: { $0.city?.trimmingCharacters(in: .whitespaces).lowercased() == town.lowercased() }) {
            return "Your first save in \(town)"
        }
        let type = saved.category
        if type != .other, !others.contains(where: { $0.category == type }) {
            return "Your first \(singular(type))"
        }
        return nil
    }

    private static func singular(_ c: PlaceCategory) -> String {
        switch c {
        case .cafe: return "café"
        case .nature: return "nature spot"
        default: return c.rawValue.lowercased()
        }
    }
}
