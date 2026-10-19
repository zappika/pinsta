import SwiftUI
import UIKit
import UserNotifications

/// "We'll let you know" for a list import (Sarp, 2026-10-19): notification permission is asked
/// when someone starts an import, the moment it makes sense, never before. The APNs device
/// token goes into the App Group (`ListImport.pushToken`), so the share extension can send it
/// with a job too. The server sends one push when the job is ready and then forgets the token.
/// Here, not in Services: it needs `UIApplication`, which the extension can't use.
enum Push {
    private static var defaults: UserDefaults? { UserDefaults(suiteName: Persistence.appGroup) }

    /// Asks once (iOS shows its question only the first time), registers, and waits briefly
    /// for the token so the import that's starting can carry it. Refused: the import still
    /// runs, and the pill and the next launch find the result.
    @MainActor
    static func ask() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let allowed: Bool
        switch settings.authorizationStatus {
        case .notDetermined: allowed = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        case .authorized, .provisional, .ephemeral: allowed = true
        default: allowed = false
        }
        guard allowed else { return }
        UIApplication.shared.registerForRemoteNotifications()
        // The token usually arrives within a moment; an import doesn't wait longer than this for it.
        for _ in 0..<15 where ListImport.pushToken == nil {
            try? await Task.sleep(for: .milliseconds(100))
        }
    }

    /// Notifications on and a token kept: the import screen can say "we'll let you know".
    static func willTell() async -> Bool {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        return ListImport.pushToken != nil && (status == .authorized || status == .provisional || status == .ephemeral)
    }

    static func keep(_ token: Data) {
        defaults?.set(token.map { String(format: "%02x", $0) }.joined(), forKey: "pushToken")
    }

    /// Already allowed (an earlier import): refresh the token on launch, as Apple asks; it can change.
    @MainActor
    static func refresh() async {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        if status == .authorized { UIApplication.shared.registerForRemoteNotifications() }
    }
}

/// The app's delegate, for what SwiftUI has no hook for: the push token and a tapped push.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { await Push.refresh() }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        Push.keep(token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("push: no token", error.localizedDescription)
    }

    /// "Your list is ready" tapped: the review opens.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.notification.request.content.userInfo["importJob"] != nil else { return }
        await MainActor.run { Settings.shared.showingImport = true }
    }

    /// Open already: the pill has turned to "ready"; the banner still shows, briefly.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
