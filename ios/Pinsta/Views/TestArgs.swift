import Foundation

/// Launch arguments for testing (CLAUDE.md, "Testing iOS"): `-addURL`, `-importURL`,
/// `-slowNotices`, `-splashHold`. Debug builds only; a release build ignores them.
enum TestArgs {
    /// A flag like `-slowNotices`.
    static func has(_ flag: String) -> Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains(flag)
        #else
        false
        #endif
    }

    /// A value like `-addURL <link>` (launch arguments land in UserDefaults).
    static func string(_ key: String) -> String? {
        #if DEBUG
        UserDefaults.standard.string(forKey: key)
        #else
        nil
        #endif
    }
}
