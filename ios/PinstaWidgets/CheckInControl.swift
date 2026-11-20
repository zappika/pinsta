import AppIntents
import SwiftUI
import WidgetKit

/// The I'm here button for Control Center, the Lock Screen and the Action button (iOS 18):
/// one press opens Vicolo on the places around you (`CheckInIntent`).
@main
struct PinstaWidgets: WidgetBundle {
    var body: some Widget {
        CheckInControl()
    }
}

struct CheckInControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "se.sarper.vicolo.checkin") {
            ControlWidgetButton(action: CheckInIntent()) {
                Label("Check in", systemImage: "hand.wave")
            }
        }
        .displayName("Check in")
        .description("Check in at the place you're at.")
    }
}
