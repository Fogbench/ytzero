import ExpoModulesCore
import Foundation
#if os(tvOS)
import TVServices
#endif

public final class YtZeroSystemProfilesModule: Module {
  // With Runs as Current User, tvOS isolates UserDefaults and relaunches the
  // process on a user change. No Apple IDs, names, or deprecated user IDs needed.
  private let preferenceKey = "ytzero.tv.preferred-profile.v1"

  public func definition() -> ModuleDefinition {
    Name("YtZeroSystemProfiles")
    AsyncFunction("canRemember") { () -> Bool in
      #if os(tvOS)
      return TVUserManager().shouldStorePreferencesForCurrentUser
      #else
      return false
      #endif
    }.runOnQueue(.main)
    AsyncFunction("readPreference") { () -> String? in
      UserDefaults.standard.string(forKey: self.preferenceKey)
    }
    AsyncFunction("writePreference") { (value: String?) in
      if let value {
        UserDefaults.standard.set(value, forKey: self.preferenceKey)
      } else {
        UserDefaults.standard.removeObject(forKey: self.preferenceKey)
      }
    }
  }
}
