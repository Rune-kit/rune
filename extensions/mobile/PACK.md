---
name: "@rune/mobile"
description: Mobile development patterns — React Native, Flutter, app store preparation, and native bridge integration.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$15"
  target: Mobile developers
---

# @rune/mobile

## Purpose

Mobile development has platform-specific pitfalls that web developers hit repeatedly: navigation stacks that leak memory, FlatList rendering that drops frames, state management that triggers unnecessary re-renders, native module bridges that crash on type mismatches, and app store rejections for metadata violations. This pack provides patterns for both React Native and Flutter — detect the framework, audit the codebase for mobile-specific anti-patterns, and emit fixes that pass platform review.

## Triggers

- Auto-trigger: when `react-native`, `expo`, `flutter`, `android/`, `ios/`, `app.json` (Expo) detected
- `/rune react-native` — audit React Native architecture and performance
- `/rune flutter` — audit Flutter architecture and state management
- `/rune app-store-prep` — prepare app store submission
- `/rune native-bridge` — audit or create native module bridges
- Called by `cook` (L1) when mobile task detected
- Called by `team` (L1) when porting web to mobile

## Skills Included

### react-native

React Native patterns — navigation, state management, native modules, performance optimization, Expo vs bare workflow decisions.

#### Workflow

**Step 1 — Detect React Native setup**
Use Grep to find framework markers: `react-native` in package.json, `expo` config, navigation library (`@react-navigation`, `expo-router`), state management (`zustand`, `redux`, `jotai`), and native module usage. Read `app.json`/`app.config.js` for Expo configuration.

**Step 2 — Audit performance patterns**
Check for: FlatList without `keyExtractor` or with inline `renderItem` (re-renders), images without caching (`FastImage` or `expo-image`), heavy re-renders from context (missing `useMemo`/`useCallback`), navigation listeners not cleaned up, large JS bundle without lazy loading (`React.lazy` + `Suspense`).

**Step 3 — Emit optimized patterns**
For each issue, emit the fix: memoized FlatList item components, proper image caching setup, navigation with typed routes, optimized state selectors, and Hermes engine configuration.

#### Example

```tsx
// BEFORE: FlatList anti-patterns — re-renders every item on any state change
<FlatList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} onPress={() => nav.navigate('Detail', { id: item.id })} />}
/>

// AFTER: memoized components, stable callbacks, proper key extraction
const MemoizedCard = React.memo(({ item, onPress }) => (
  <ItemCard item={item} onPress={onPress} />
));

const renderItem = useCallback(({ item }) => (
  <MemoizedCard item={item} onPress={() => nav.navigate('Detail', { id: item.id })} />
), [nav]);

<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

---

### flutter

Flutter patterns — widget composition, state management (Riverpod, BLoC), platform channels, adaptive layouts.

#### Workflow

**Step 1 — Detect Flutter architecture**
Use Grep to find state management (`riverpod`, `flutter_bloc`, `provider`, `get_it`), routing (`go_router`, `auto_route`), and platform channel usage. Read `pubspec.yaml` for dependencies and `lib/` structure for architecture pattern (feature-first, layer-first).

**Step 2 — Audit widget tree and state**
Check for: `setState` in complex widgets (should use state management), deeply nested widget trees (extract widgets), `BuildContext` passed through many layers (use InheritedWidget or Riverpod), missing `const` constructors (unnecessary rebuilds), platform-specific code without adaptive checks.

**Step 3 — Emit refactored patterns**
For each issue, emit: extracted widget with const constructor, Riverpod provider for state, proper error handling with `AsyncValue`, and adaptive layout using `LayoutBuilder` + breakpoints.

#### Example

```dart
// BEFORE: setState in complex widget, no separation
class HomeScreen extends StatefulWidget { ... }
class _HomeScreenState extends State<HomeScreen> {
  List<Item> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    fetchItems().then((data) => setState(() { items = data; loading = false; }));
  }
}

// AFTER: Riverpod with AsyncValue, separated concerns
@riverpod
Future<List<Item>> items(Ref ref) async {
  final repo = ref.watch(itemRepositoryProvider);
  return repo.fetchAll();
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(itemsProvider);
    return itemsAsync.when(
      data: (items) => ItemList(items: items),
      loading: () => const ShimmerList(),
      error: (err, stack) => ErrorView(message: err.toString(), onRetry: () => ref.invalidate(itemsProvider)),
    );
  }
}
```

---

### app-store-prep

App store submission preparation — screenshots, metadata, privacy policy, review guidelines compliance, TestFlight/internal testing.

#### Workflow

**Step 1 — Audit submission readiness**
Check for: app icon (1024x1024 for iOS, adaptive for Android), splash screen, privacy policy URL in app config, required permissions with usage descriptions (`NSCameraUsageDescription`, etc.), minimum SDK versions, and build configuration (release signing).

**Step 2 — Generate metadata**
From README and app config, generate: app title (30 chars max), subtitle (30 chars), description (4000 chars), keywords (100 chars), category selection, age rating questionnaire answers, and screenshot specifications per device size.

**Step 3 — Emit submission checklist**
Output a structured checklist covering both platforms: Apple App Store (TestFlight build, privacy declarations, review notes) and Google Play (internal testing track, data safety form, content rating questionnaire).

#### Example

```markdown
## App Store Submission Checklist

### iOS (Apple App Store Connect)
- [ ] App icon: 1024x1024 PNG, no alpha, no rounded corners
- [ ] Screenshots: 6.7" (1290x2796), 6.5" (1242x2688), 5.5" (1242x2208)
- [ ] Privacy policy URL: https://example.com/privacy
- [ ] NSCameraUsageDescription: "Used to scan QR codes for quick login"
- [ ] NSLocationWhenInUseUsageDescription: "Used to show nearby stores"
- [ ] TestFlight build uploaded and tested
- [ ] Export compliance: Uses HTTPS only (no custom encryption) → select "No"

### Android (Google Play Console)
- [ ] Adaptive icon: foreground (108dp) + background layer
- [ ] Feature graphic: 1024x500 PNG
- [ ] Data safety form: camera (optional), location (optional)
- [ ] Content rating: IARC questionnaire completed
- [ ] Internal testing track: at least 1 build tested
- [ ] Signing: upload key + app signing by Google Play enabled
```

---

### native-bridge

Native bridge patterns — platform-specific code, native module creation, Swift/Kotlin interop, background tasks.

#### Workflow

**Step 1 — Detect bridge requirements**
Use Grep to find platform-specific code: `Platform.OS`, `Platform.select`, `NativeModules`, `MethodChannel`, Turbo Modules (`TurboModule`), or Expo modules (`expo-modules-core`). Read existing native code in `ios/` and `android/` directories.

**Step 2 — Audit bridge safety**
Check for: type mismatches between JS/Dart and native (string expected, int sent), missing error handling on native side, synchronous bridge calls blocking UI thread, missing null checks on platform-specific returns, and hardcoded platform assumptions.

**Step 3 — Emit type-safe bridge**
For React Native: emit Turbo Module with codegen types or Expo Module with TypeScript interface. For Flutter: emit MethodChannel with proper error handling, type-safe serialization, and platform-specific implementations for both iOS (Swift) and Android (Kotlin).

#### Example

```typescript
// React Native — Expo Module (type-safe, modern approach)
// modules/haptics/index.ts
import { NativeModule, requireNativeModule } from 'expo-modules-core';

interface HapticsModule extends NativeModule {
  impact(style: 'light' | 'medium' | 'heavy'): void;
  notification(type: 'success' | 'warning' | 'error'): void;
}

const HapticsNative = requireNativeModule<HapticsModule>('Haptics');

export function impact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  HapticsNative.impact(style);
}

// modules/haptics/ios/HapticsModule.swift
import ExpoModulesCore
import UIKit

public class HapticsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Haptics")
    Function("impact") { (style: String) in
      let generator: UIImpactFeedbackGenerator
      switch style {
      case "light": generator = UIImpactFeedbackGenerator(style: .light)
      case "heavy": generator = UIImpactFeedbackGenerator(style: .heavy)
      default: generator = UIImpactFeedbackGenerator(style: .medium)
      }
      generator.impactOccurred()
    }
  }
}
```

---

## Connections

```
Calls → browser-pilot (L3): device testing and screenshot automation
Calls → asset-creator (L3): generate app icons and splash screens
Called By ← cook (L1): when mobile task detected
Called By ← team (L1): when porting web to mobile
Called By ← launch (L1): app store submission flow
```

## Tech Stack Support

| Framework | State Management | Navigation | Build |
|-----------|-----------------|------------|-------|
| React Native (bare) | Zustand / Redux | React Navigation v7 | Metro + Gradle/Xcode |
| Expo (managed) | Zustand | Expo Router v4 | EAS Build |
| Flutter | Riverpod / BLoC | GoRouter | Flutter CLI |

## Constraints

1. MUST test on both iOS and Android — never assume cross-platform behavior is identical.
2. MUST NOT ship with debug configurations (Flipper, dev menu, debug signing) in production builds.
3. MUST include usage descriptions for every permission requested — empty descriptions cause instant rejection.
4. MUST use platform-adaptive components (Material on Android, Cupertino on iOS) or declare a unified design system.
5. MUST handle offline gracefully — mobile apps lose connectivity; show cached data or clear offline state.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| FlatList optimization causes blank cells on fast scroll (windowSize too small) | HIGH | Default windowSize=5, test with 1000+ items before declaring optimized |
| Native bridge type mismatch crashes app instead of returning error | CRITICAL | Always wrap native calls in try-catch; validate types before bridge call |
| Expo managed workflow limits native module access | MEDIUM | Detect Expo vs bare in Step 1; suggest `expo prebuild` for native module needs |
| App store rejection for missing privacy declaration | HIGH | Cross-reference every permission in Info.plist/AndroidManifest with usage description |
| Flutter hot reload masks state bugs that appear in release mode | MEDIUM | Test with `flutter run --release` before declaring state management correct |
| Screenshots generated at wrong device size fail store review | LOW | Use exact pixel dimensions from current App Store/Play Store requirements |

## Done When

- React Native/Flutter codebase audited for performance anti-patterns with specific fixes
- FlatList/ListView optimized with memoization, key extraction, and window sizing
- State management uses proper patterns (no `setState` in complex widgets)
- App store metadata generated with correct dimensions, descriptions, and permissions
- Native bridge typed and error-handled for both platforms
- Structured report emitted for each skill invoked

## Cost Profile

~8,000–16,000 tokens per full pack run (all 4 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for config detection; escalate to sonnet for code generation and platform-specific patterns.
