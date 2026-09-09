---
name: ytzero-tv-app
description: Build or review the native YT Zero television app in apps/tv for Apple TV, Android/Google TV, and Fire TV, including remote focus, device-code pairing, feed UI, native playback, Expo configuration, and TV-specific testing. Use whenever work touches apps/tv, TV authentication, TV playback, or ten-foot UI behavior.
---

# YT Zero TV app

Build the shared television client with Expo and `react-native-tvos`. Read
`apps/tv/AGENTS.md` and `docs/tv-app-research.md` before changing it.

## Workflow

1. Inspect `apps/tv/src/components` and existing screens before adding UI.
2. Keep scope to Apple TV/tvOS, Android TV/Google TV, and Fire TV.
3. Make every control usable with directional focus, Select, and Back/Menu.
4. Add every new user-facing string to all languages in `apps/tv/src/i18n.ts`.
5. Keep the API origin separate from the bearer credential. Persist both only
   through `src/storage.ts`; never log or place the bearer in URLs.
6. Keep device-flow authorization compatible with the routes in
   `app/src/routes/authRoutes.ts`. Approval always happens in the authenticated
   browser UI at `/tv/pair`.
7. For playback, use a native player abstraction. Do not add an iframe or
   WebView. Require a server-issued short-lived media ticket before connecting
   an HLS or direct-stream source to a TV player.
8. If persistent server state changes, classify it in
   `docs/backup-restore-architecture.md` and add exclusion or round-trip tests.

## Checks

From `apps/tv`, run:

```sh
bun test src
bun run typecheck
bunx expo prebuild --no-install
```

When pairing or browser approval changes, also run the focused backend and UI
checks documented in `docs/tv-app-research.md`. Do not run the repository's
full precommit chain.
