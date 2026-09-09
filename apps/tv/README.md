# YT Zero TV

Native television client for Apple TV/tvOS, Android TV/Google TV, and Fire TV.
It uses Expo with `react-native-tvos`; Tizen and webOS are intentionally out of
scope.

The current vertical slice supports instance setup, QR/manual device pairing,
secure session storage, a profile-configured TV sidebar, a remote-focusable feed
with native tvOS thumbnail parallax, backend tag filters, channel and Shorts
views, a full remote-first Watch Page with profile actions, related videos and
instance-configured comments, and device settings for sign-out and instance
switching. Native playback behind short-lived media tickets is the next
milestone.

```sh
bun install
bun test src
bun run typecheck
bunx expo prebuild --clean --no-install
bun run tvos
# or
bun run android
```

Expo Go does not support this TV fork, so use a generated development build.
See [`../../docs/tv-app-research.md`](../../docs/tv-app-research.md) for the
architecture, player plan, constraints, and current research.

## Branding assets

The runtime mark and generated launcher, Android TV banner, tvOS icon, and Top
Shelf artwork all use the canonical source in `assets/brand/ytzero-logo.svg`.
After changing that source or the asset generator, rebuild the PNG set before
running Expo prebuild:

```sh
bun run assets
```

## tvOS, CocoaPods, and the simulator

`expo prebuild` generates the ignored `ios/` directory and installs the pods.
The normal flow does not require opening the Podfile or running CocoaPods by
hand:

```sh
cd apps/tv
bun install
bunx expo prebuild --clean
bunx expo run:ios --device "Apple TV 4K (3rd generation)"
```

If `pod --version` works and prebuild prints `Installed CocoaPods`, CocoaPods is
ready. When pod resolution itself fails, regenerate first. Run `pod install
--repo-update` from `apps/tv/ios` only when the error explicitly concerns the
local pod spec repository. Native directories stay generated and must not be
committed.

`No tvOS devices available in Simulator.app` is unrelated to CocoaPods. In
Xcode, install a tvOS runtime under **Xcode → Settings → Components**, then add
an Apple TV simulator under **Window → Devices and Simulators → Simulators**.
The available targets can be checked with:

```sh
xcrun simctl list devices available | rg "Apple TV"
```

On a physical Apple TV, the instance URL must be reachable from the television
over the LAN; `localhost` points at the television itself and will not reach the
development Mac.
