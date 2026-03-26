---
name: "@rune/mobile"
description: Mobile development patterns — React Native, Flutter, deep linking, push notifications, OTA updates, app store preparation, native bridge integration, iOS build pipeline, and App Store Connect automation.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$15"
  target: Mobile developers
  format: split
---

# @rune/mobile

## Purpose

Mobile development has platform-specific pitfalls that web developers hit repeatedly: navigation stacks that leak memory, FlatList rendering that drops frames, New Architecture migration that silently breaks third-party libraries, deep links that work in dev but fail in production, push notifications that never arrive on iOS, OTA updates that crash on bytecode mismatch, and app store rejections for missing privacy manifests. This pack provides patterns for React Native and Flutter — detect the framework, audit for mobile-specific anti-patterns, and emit fixes that pass platform review.

## Triggers

- Auto-trigger: when `react-native`, `expo`, `flutter`, `android/`, `ios/`, `app.json` (Expo) detected
- `/rune react-native` — audit React Native architecture and performance
- `/rune flutter` — audit Flutter architecture and state management
- `/rune deep-linking` — set up or audit deep linking (Universal Links, App Links)
- `/rune push-notifications` — set up or audit push notification pipeline
- `/rune ota-updates` — set up or audit OTA update strategy
- `/rune app-store-prep` — prepare app store submission
- `/rune native-bridge` — audit or create native module bridges
- `/rune ios-build` — end-to-end iOS build, sign, archive, upload pipeline
- `/rune app-store-connect` — App Store Connect API operations (versions, screenshots, localization, IAPs)
- Called by `cook` (L1) when mobile task detected
- Called by `team` (L1) when porting web to mobile

## Skills Included

| Skill | Model | Description |
|-------|-------|-------------|
| [react-native](skills/react-native.md) | sonnet | New Architecture migration, navigation, state management, performance optimization |
| [flutter](skills/flutter.md) | sonnet | Widget composition, Riverpod/BLoC state, platform channels, adaptive layouts |
| [deep-linking](skills/deep-linking.md) | sonnet | Universal Links (iOS), App Links (Android), auth + deep link race condition |
| [push-notifications](skills/push-notifications.md) | sonnet | FCM v1, APNs, Expo Notifications, permission handling, delivery debugging |
| [ota-updates](skills/ota-updates.md) | sonnet | EAS Update, runtime version management, rollback, bytecode compatibility |
| [app-store-prep](skills/app-store-prep.md) | sonnet | Screenshots, metadata, privacy manifests, submission checklist |
| [native-bridge](skills/native-bridge.md) | sonnet | Expo Modules API, TurboModules, Swift/Kotlin interop, background tasks |
| [ios-build-pipeline](skills/ios-build-pipeline.md) | sonnet | Certificate generation, provisioning, Xcode archive, IPA export, TestFlight upload |
| [app-store-connect](skills/app-store-connect.md) | sonnet | Version management, localization, screenshot upload, IAP, review submission |

Skill files: `skills/<skill-name>.md`

## Connections

```
Calls → browser-pilot (L3): device testing and screenshot automation
Calls → asset-creator (L3): generate app icons and splash screens
Calls → sentinel (L2): audit push notification security, deep link validation
Calls → verification (L3): run mobile-specific checks (build, lint, type-check)
Calls → @rune/ui (L4): design system tokens, palette, typography for mobile UI consistency
Calls → @rune/backend (L4): API patterns for mobile backend integration (auth, push server)
Calls → @rune/security (L4): code signing audit, API key management, certificate validation
Called By ← cook (L1): when mobile task detected
Called By ← team (L1): when porting web to mobile
Called By ← launch (L1): app store submission flow
Called By ← deploy (L2): mobile-specific deployment (EAS Build, Fastlane)
Inter-skill: ios-build-pipeline → app-store-prep (pipeline feeds into submission checklist)
Inter-skill: app-store-connect → app-store-prep (API automation completes manual checklist items)
Inter-skill: ios-build-pipeline → app-store-connect (upload build → attach to version → submit)
```

## Tech Stack Support

| Framework | State Management | Navigation | Build | OTA |
|-----------|-----------------|------------|-------|-----|
| React Native (bare) | Zustand / Redux | React Navigation v7 | Metro + Gradle/Xcode | CodePush |
| Expo (managed) | Zustand | Expo Router v4 | EAS Build | EAS Update |
| Flutter | Riverpod / BLoC | GoRouter | Flutter CLI | Shorebird |
| Native iOS (Swift) | SwiftUI @Observable | NavigationStack | xcodebuild | — |

## Sharp Edges

Critical failures to know before using this pack:

- **New Architecture** silently breaks legacy `NativeModules.X` and `setNativeProps` — audit all native deps against `reactnative.directory` before upgrading
- **OTA bytecode mismatch** crashes on launch — never deploy OTA update across React Native version boundaries; use `fingerprintExperimental` runtime version
- **Universal Links** silently break when AASA endpoint redirects (HTTP→HTTPS) — serve at exact path, verify with `curl -I`
- **Firebase Dynamic Links** shut down August 2025 — all `page.link` URLs dead; migrate to Branch.io or standard App Links
- **PrivacyInfo.xcprivacy** absence triggers auto-rejection on App Store (mandatory since April 2025)
- **FCM Legacy API** fully shut down June 2024 — must use FCM v1 with service account JSON
- **OpenSSL 3.x** `.p12` export silently fails without `-legacy` flag on macOS 14+
- **ASC API rate limit**: 200 req/min; JWT expires in 20 min — implement auto-refresh and exponential backoff

Full sharp edges table: see individual skill files.

## Done When

- React Native/Flutter codebase audited for New Architecture compatibility with migration plan
- Deep links working on both platforms with authentication integration and real device verification
- Push notifications delivering reliably via FCM v1 with proper permission handling
- OTA update strategy configured with runtime version management and rollback procedure
- App store metadata generated with correct dimensions, privacy manifest, and platform-specific requirements
- Native bridges typed and error-handled for both platforms using modern APIs
- iOS build pipeline producing signed IPA with idempotent signing state
- App Store Connect operations automated — version, localization, screenshots, IAP, submission

## Cost Profile

~16,000–32,000 tokens per full pack run (all 9 skills). Individual skill: ~2,000–5,000 tokens. Sonnet default. Use haiku for config detection; escalate to sonnet for code generation, build pipeline, and ASC API patterns.
