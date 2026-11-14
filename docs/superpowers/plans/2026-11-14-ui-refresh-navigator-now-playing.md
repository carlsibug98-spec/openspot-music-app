# UI Refresh (Navigator + Now Playing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the bottom navigator as a Material Island bar (4 tabs, Downloads folded into Library, launch on Home) and restyle the full-screen Now Playing view as "Immersive Art v2" — in both `openspot-mobile` and `openspot-desktop`.

**Architecture:** New `IslandTabBar` custom tab bar (Reanimated sliding pill) driven by shared color tokens; `FullScreenPlayer` restyled in place with a deterministic gradient-pair background and a new `NowPlayingMenu` bottom sheet. Downloads screen stays routable but hidden from the bar; Library gains a Downloads card. No playback logic changes.

**Tech Stack:** Expo Router Tabs (custom `tabBar`), react-native-reanimated, existing `TabIcons` SVGs, i18next, expo-sharing / RN `Share` API.

**Spec:** `docs/superpowers/specs/2026-11-14-navigator-redesign-design.md` (Parts 1 & 2 — read together with this plan)

## Global Constraints

- **No test framework exists in this repo and none may be added.** Verification per task = `npx tsc --noEmit` + `npx expo lint` (run inside the app dir), plus the manual checks written in each task.
- **One green per theme:** dark `#1DB954`, light `#167c3a`. The iOS special case (`#038434`) is deleted everywhere.
- **Danger color token:** `#FF3B30` (replaces scattered `#ff4444`/`#FF3B30` where touched).
- All user-facing strings via `t()`; new keys added to **all 10 locales in both apps**: `de, en, es, fr, he, hi, ko, ru, tr, zh, zh-TW` (11 dirs; `he` is RTL — never hardcode direction).
- Tap targets ≥ 44px. No new npm dependencies (reanimated, expo-sharing, expo-haptics already installed).
- Both apps' shared files get the **same** change; mobile/desktop behavioral differences (Tauri imports, `getCurrentWindow().setTheme`) stay untouched.
- The repo has no configured git identity — before Task 1, run `git config user.name "<operator>"` and `git config user.email "<operator email>"` (repo-local, values supplied by operator).
- Commit after every task: conventional commits (`feat:`, `refactor:`), both apps in one commit when both change.

## Review Focus

1. **Offline launch** — airplane-mode launch must still land on Home, then auto-redirect to `/downloads` (hidden route). Test: Task 3 manual check.
2. **Mini player overlap** — with a track playing, mini player must sit fully above the island bar at every window size. Test: Task 3 manual check, Task 8 resize sweep.
3. **Queue sheet stacking** — queue sheet opens above bar + mini player without gap/overlap. Test: Task 8 manual check.
4. **RTL (Hebrew locale)** — island + menu sheet layout must not break when mirrored; icons may flip, layout must not. Test: Task 8 (set `openspot_language_v1` = `he`).
5. **Landscape / 768px tablet breakpoint (desktop resize)** — cover, slider and controls all visible; pill positions correctly with 4 tabs. Test: Task 8 manual check.

---

### Task 1: Shared tokens + layout constants

**Files:**
- Modify: `openspot-desktop/constants/Colors.ts` and `openspot-mobile/constants/Colors.ts` (identical)
- Create: `openspot-desktop/constants/layout.ts` and `openspot-mobile/constants/layout.ts` (identical)

**Interfaces:**
- Produces (used by Tasks 2–7):
  - `Colors.theme.island.barBg`, `.barHairline`, `.pillBg`, `.accent`, `.inactive`, `.label` — each `{ light: string; dark: string }`
  - `Colors.theme.danger` — `{ light: string; dark: string }`
  - `TAB_BAR_HEIGHT: number` (= 74), `MINI_PLAYER_BAR_GAP: number` (= 10) from `@/constants/layout`

Exact token values (from spec):
```
island.barBg     light #fffaf2   dark #0e0e0e
island.barHairline light rgba(45,34,25,0.07)  dark rgba(255,255,255,0.06)
island.pillBg    light rgba(22,124,58,0.14)   dark rgba(29,185,84,0.16)
island.accent    light #167c3a   dark #1DB954
island.inactive  light #7a6251   dark #9a9a9a
island.label     light #7a6251   dark #9a9a9a
danger           light #FF3B30   dark #FF3B30
```

- [ ] **Step 1:** Extend `Colors.ts` with a `theme` export holding exactly the keys above (keep existing `light`/`dark` exports untouched — other files still read them).
- [ ] **Step 2:** Create `constants/layout.ts` exporting `TAB_BAR_HEIGHT = 74` and `MINI_PLAYER_BAR_GAP = 10` with a one-line comment referencing the spec.
- [ ] **Step 3:** Verify in both app dirs: `npx tsc --noEmit` → no errors; `npx expo lint` → no new warnings.
- [ ] **Step 4:** Commit: `feat: add shared theme tokens and navigator layout constants`

### Task 2: IslandTabBar component

**Files:**
- Create: `openspot-desktop/components/ui/IslandTabBar.tsx` and `openspot-mobile/components/ui/IslandTabBar.tsx` (identical code)
- Reuse: `@/components/TabIcons` (HomeTabIcon, SearchTabIcon, LibraryTabIcon, SettingsTabIcon), `@/hooks/useThemeMode` / `useColorScheme`, `TAB_BAR_HEIGHT`

**Interfaces:**
- Consumes: `Colors.theme.island`, `TAB_BAR_HEIGHT` (Task 1)
- Produces: `IslandTabBar({ state, descriptors, navigation }: BottomTabBarProps)` — a default-export component conforming to react-navigation's `tabBar` prop contract (type imported as `BottomTabBarProps` from `@react-navigation/bottom-tabs`).

Behavior (spec-fixed):
- Full-width bar, height `TAB_BAR_HEIGHT + insets.bottom` (padding-bottom = `insets.bottom`), bg `island.barBg`, top hairline `island.barHairline` (1px), no hard border.
- 4 tabs expected: `index` (Home), `search`, `library`, `settings`. Icons from `TabIcons` mapped by route name; size 24.
- Active tab: rounded pill (`borderRadius: 999`, bg `island.pillBg`) behind icon + bold label (11.5, weight 800, color `island.accent`). Pill slides between tabs with Reanimated: `translateX = withSpring(index * itemWidth, { damping: 18, stiffness: 180 })`, `itemWidth = windowWidth / routes.length`.
- Inactive tabs: icon only, color `island.inactive`.
- Press handler: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` then `navigation.navigate(route.name)`; whole item tappable (≥44px tall).
- Labels via `descriptors[state.routes[i].key].options.title ?? route.name` (existing i18n titles).

- [ ] **Step 1:** Implement the component per the behavior list (single file, no exports beyond the component).
- [ ] **Step 2:** Verify both apps: `npx tsc --noEmit` (component is unused yet — must still typecheck against `BottomTabBarProps`).
- [ ] **Step 3:** Commit: `feat: add IslandTabBar (Material Island custom tab bar)`

### Task 3: Wire the navigator in both apps

**Files:**
- Modify: `openspot-desktop/app/(tabs)/_layout.tsx` and `openspot-mobile/app/(tabs)/_layout.tsx`
- Reference read-only: `components/Player.tsx` position (mini player), `components/QueueDisplay.tsx`

**Interfaces:**
- Consumes: `IslandTabBar` (Task 2), `Colors.theme.island`, `TAB_BAR_HEIGHT`, `MINI_PLAYER_BAR_GAP` (Task 1)
- Produces: tab set = Home/Search/Library/Settings; `/downloads` hidden-but-routable.

- [ ] **Step 1:** On `<Tabs>`: remove `initialRouteName="downloads"` (desktop) and add `tabBar={(props) => <IslandTabBar {...props} />}`.
- [ ] **Step 2:** Replace the `downloads` Tabs.Screen options with `{ href: null }` (same pattern as `media/[type]/[id]`). Delete the now-unused `tabTheme` object, `TabBarBackground` import usage, `borderTopWidth` styling, and the iOS green special case.
- [ ] **Step 3:** Mini player container position: change `bottom: 50 + insets.bottom` → `bottom: TAB_BAR_HEIGHT + MINI_PLAYER_BAR_GAP + insets.bottom`. Check `QueueDisplay` for any hardcoded bar-height assumptions and apply the same constant if found.
- [ ] **Step 4:** Verify both apps: `npx tsc --noEmit`; `npx expo lint`.
- [ ] **Step 5:** Manual (desktop): `npx tauri:dev` — app launches on **Home**; bar shows 4 tabs; active pill on Home; mini player (play any track) floats above the bar without overlap; offline simulation (disable network with app running) still redirects to the Downloads screen. Repeat visual pass in dark **and** light mode.
- [ ] **Step 6:** Commit: `feat: material island tab bar with 4 tabs and Home launch`

### Task 4: Library Downloads card + i18n

**Files:**
- Modify: `openspot-desktop/app/(tabs)/library.tsx`, `openspot-mobile/app/(tabs)/library.tsx`
- Modify: all 11 locale files in both apps (`locales/*.json`)

**Interfaces:**
- Consumes: `Colors.theme` tokens (Task 1), existing playlist count source in library screen
- Produces: i18n keys `library.downloads_title`, `library.downloads_subtitle` (subtitle uses `{{count}}`)

- [ ] **Step 1:** Add the card at the top of Library's content, above existing sections, using the mockup structure: 44px rounded-squared icon tile (download icon, `island.pillBg` bg / `island.accent` icon), title `t('library.downloads_title')`, subtitle `t('library.downloads_subtitle', { count })` where count = downloaded tracks count (reuse the same AsyncStorage/offline source the downloads screen uses — read `downloads.tsx` first and reuse its counting logic verbatim), chevron right. Whole card `TouchableOpacity` → `router.push('/downloads')`; radius 14, bg surface token already used by that screen, border = existing `theme.border` value from that file.
- [ ] **Step 2:** Add keys to all 11 locale files in both apps. Exact strings:

| key | en |
|---|---|
| `library.downloads_title` | Downloads |
| `library.downloads_subtitle` | `{{count}} songs · available offline` |

| locale | downloads_title | downloads_subtitle |
|---|---|---|
| de | Downloads | `{{count}} Titel · offline verfügbar` |
| es | Descargas | `{{count}} canciones · disponibles sin conexión` |
| fr | Téléchargements | `{{count}} titres · disponibles hors ligne` |
| he | הורדות | `{{count}} שירים · זמינים במצב לא מקוון` |
| hi | डाउनलोड | `{{count}} गाने · ऑफ़लाइन उपलब्ध` |
| ko | 다운로드 | `{{count}}곡 · 오프라인에서 사용 가능` |
| ru | Загрузки | `{{count}} треков · доступны офлайн` |
| tr | İndirilenler | `{{count}} şarkı · çevrimdışı kullanılabilir` |
| zh | 下载 | `{{count}} 首歌曲 · 可离线播放` |
| zh-TW | 下載 | `{{count}} 首歌曲 · 可離線播放` |

- [ ] **Step 3:** Verify: `npx tsc --noEmit` both apps; manually open Library in both themes, tap card → Downloads screen opens; switch locale to `ko` and confirm strings render.
- [ ] **Step 4:** Commit: `feat: downloads card in library with localized strings`

### Task 5: Now Playing — background, header, title block

**Files:**
- Create: `openspot-desktop/lib/now-playing-theme.ts` and `openspot-mobile/lib/now-playing-theme.ts` (identical)
- Modify: `openspot-desktop/components/FullScreenPlayer.tsx`, `openspot-mobile/components/FullScreenPlayer.tsx`

**Interfaces:**
- Consumes: `Colors.theme.danger`, `island.accent` (Task 1)
- Produces: `gradientPairFor(id: string | number): { colors: [string, string, string]; ring: string }` — deterministic: index = `hash(id) % GRADIENT_PAIRS.length`, `hash` = FNV-1a over `String(id)`. Export `GRADIENT_PAIRS`.

`GRADIENT_PAIRS` (six pairs, `[top, mid, bottom]` + pill/ring tint):
```
['#7b2ff7', '#3a1a8f', '#0a0514']  ring rgba(123,47,247,0.35)
['#ff512f', '#8f1d3f', '#140508']  ring rgba(255,81,47,0.3)
['#396afc', '#1a2f8f', '#050a14']  ring rgba(57,106,252,0.3)
['#f7971e', '#8f5a0e', '#140b02']  ring rgba(247,151,30,0.3)
['#00c2a8', '#0a6b5f', '#02120f']  ring rgba(0,194,168,0.3)
['#dd2476', '#6b1240', '#14030a']  ring rgba(221,36,118,0.3)
```

- [ ] **Step 1:** Implement `gradientPairFor` (FNV-1a over `String(id)`, modulo 6; no crypto import).
- [ ] **Step 2:** In `FullScreenPlayer`: replace the blurred `Image` + `BlurView` background stack with a `LinearGradient` using `gradientPairFor(track.id)` colors (`['top','mid','bottom']` as `colors` prop) — keep the existing bottom fade to `#050505` by appending it as the gradient's final stop via the pair's third color (already near-black). Keep `theme.base` as fallback while loading.
- [ ] **Step 3:** Header row → `close chevron (left) | eyebrow text (center) | 3-dot button (right, 36px circular hit area, ≥44px)`. Eyebrow = `t('player.now_playing')`, styled 10px/700/letterSpacing 1.2/uppercase/`rgba(255,255,255,0.55)`. The 3-dot button renders but is inert until Task 7.
- [ ] **Step 4:** Title block → left-aligned title (22/800, letterSpacing -0.4) + artist (12/600, `island.accent`, existing artist-press handler unchanged); right side horizontally: download toggle then heart (existing `handleLike`/like-scale animation preserved, download button = existing `DownloadButton` restyled to 21px icon, gray `rgba(255,255,255,0.75)` when not downloaded).
- [ ] **Step 5:** Update the component's inline `theme` object: `accent` → `island.accent[token]`, `danger` → `Colors.theme.danger[token]`; delete the hardcoded `'#1DB954'` and `'#FF3B30'` literals.
- [ ] **Step 6:** Verify both apps: `npx tsc --noEmit`; manual: open player — background gradient differs per track and is stable per track; header/eyebrow/3-dot visible; dark **and** light mode pass (light mode: eyebrow/status colors flip to dark-on-cream per existing `isDark` logic).
- [ ] **Step 7:** Commit: `feat: immersive art now-playing background and header layout`

### Task 6: Now Playing — transport rows

**Files:**
- Modify: `openspot-desktop/components/FullScreenPlayer.tsx`, `openspot-mobile/components/FullScreenPlayer.tsx`

**Interfaces:**
- Consumes: nothing new; uses existing props (`onShuffle/onNext/onPrevious/onSeek...`, `repeatMode` state).

- [ ] **Step 1:** Transport row → `shuffle · previous · play/pause · next · repeat` where play/pause is a 58px white circle with black icon (existing handlers/haptics unchanged; icon switches per existing `isPlaying`). Shuffle/repeat keep their active-state coloring (accent when engaged, `rgba(255,255,255,0.75)` idle; light mode: `rgba(0,0,0,0.65)` idle). The existing desktop volume row (slider + mute, `volume/onVolumeChange/isMuted/onMuteToggle` props) stays unchanged below the transport row.
- [ ] **Step 2:** Secondary row under transport, right-aligned to sit under the repeat button: queue toggle icon (existing `onQueueToggle` handler + haptics), 18px, `rgba(255,255,255,0.45)` idle.
- [ ] **Step 3:** Remove the old bottom action-row placements of like/download/queue that Tasks 5/6 relocated (leave no dead handlers).
- [ ] **Step 4:** Verify both apps: `npx tsc --noEmit`; manual: play/pause toggles, shuffle/repeat states color correctly, queue opens via the new icon, seek slider unaffected; landscape (resize desktop) keeps all controls visible.
- [ ] **Step 5:** Commit: `feat: restyle now-playing transport controls`

### Task 7: NowPlayingMenu bottom sheet

**Files:**
- Create: `openspot-desktop/components/NowPlayingMenu.tsx` and `openspot-mobile/components/NowPlayingMenu.tsx` (identical)
- Modify: `FullScreenPlayer.tsx` (both apps), all 11 locale files (both apps)
- Modify: `openspot-desktop/app/(tabs)/settings.tsx` style-usage only if it references the old toast color literal — **no**, skip; toast colors already tokenized in Task 5's file scope.

**Interfaces:**
- Consumes: `Track` (has `albumId: string`, `artistId: number`), existing `openPlaylistModal` flow in FullScreenPlayer
- Produces: `NowPlayingMenu({ visible, onClose, onAddToPlaylist, track }: { visible: boolean; onClose: () => void; onAddToPlaylist: () => void; track: Track | null })`

Behavior:
- Bottom sheet: rounded 22 top corners, bg `#1b1b1b` dark / `#fffaf2` light, grab handle, header row (38px thumb + title/artist), then items: **Add to playlist** → `onAddToPlaylist()` (existing modal flow); **Go to album** → `router.push({ pathname: '/media/[type]/[id]', params: { type: 'album', id: track.albumId } })` then `onClose()`; **Go to artist** → existing proven pattern `router.push({ pathname: '/search', params: { q: track.artist, type: 'artist' } })` then `onClose()`; **Share song** → `Share.share({ message: `${track.title} — ${track.artist} · via OpenSpot` })` then `onClose()`.
- Slide-up + fade (Animated.timing 220ms, Easing.out(Easing.quad)); dim overlay `rgba(0,0,0,0.55)`; dismissed by tapping the dim overlay (or Android back) — **no visible Close button** (user decision).
- Wire the 3-dot button from Task 5 to open it.
- i18n keys `player.go_to_album`, `player.go_to_artist`, `player.share_song`, `player.more_options` — en: `Go to album`, `Go to artist`, `Share song`, `More options`; de: `Zum Album`, `Zum Künstler`, `Song teilen`, `Weitere Optionen`; es: `Ir al álbum`, `Ir al artista`, `Compartir canción`, `Más opciones`; fr: `Voir l'album`, `Voir l'artiste`, `Partager le titre`, `Plus d'options`; he: `לעבור לאלבום`, `לעבור לאמן`, `שיתוף שיר`, `אפשרויות נוספות`; hi: `एल्बम पर जाएँ`, `कलाकार पर जाएँ`, `गाना साझा करें`, `और विकल्प`; ko: `앨범으로 이동`, `아티스트로 이동`, `곡 공유`, `더 보기`; ru: `Перейти к альбому`, `Перейти к исполнителю`, `Поделиться треком`, `Ещё`; tr: `Albüme git`, `Sanatçıya git`, `Şarkıyı paylaş`, `Diğer seçenekler`; zh: `查看专辑`, `查看歌手`, `分享歌曲`, `更多选项`; zh-TW: `查看專輯`, `查看歌手`, `分享歌曲`, `更多選項`. Reuse existing `add_to_playlist` key.

- [ ] **Step 1:** Implement the component with the exact props/behavior above.
- [ ] **Step 2:** Wire into `FullScreenPlayer` (state `menuVisible`, 3-dot opens, `openPlaylistModal` passed as `onAddToPlaylist`).
- [ ] **Step 3:** Add the four keys to all 11 locale files in both apps (table above).
- [ ] **Step 4:** Verify both apps: `npx tsc --noEmit`; manual: each menu action navigates/shares/dismisses correctly; `he` locale renders RTL without layout breakage.
- [ ] **Step 5:** Commit: `feat: now-playing overflow menu with album/artist/share actions`

### Task 8: Expand animation + polish + QA sweep

**Files:**
- Modify: `openspot-desktop/components/FullScreenPlayer.tsx`, `openspot-mobile/components/FullScreenPlayer.tsx`, `openspot-desktop/components/Player.tsx`, `openspot-mobile/components/Player.tsx`

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1:** Cover entrance: on open, cover scales 0.92 → 1 with `withSpring({ damping: 20, stiffness: 200 })` + opacity 0 → 1 (200ms) — the approximated morph per spec (Modal keeps `slide` animationType). The existing rotating-cover spin setting stays attached to the restyled cover.
- [ ] **Step 2:** Apply the `impeccable` / `emil-design-eng` polish pass to the touched surfaces only: consistent 8px spacing rhythm around player rows, 44px+ hit targets verified, motion only on opacity/transform, no spring on text layout, interrupted-animation behavior sane (re-open mid-animation doesn't stick).
- [ ] **Step 3:** Full manual QA (both apps, both themes, and with a track playing):
  - airplane-mode launch → Home then auto-redirect to Downloads (Review Focus 1)
  - resize desktop window from min to wide → mini player never overlaps bar; queue sheet stacks cleanly (Review Focus 2, 3)
  - locale `he` → navigator + menu sheet usable mirrored (Review Focus 4)
  - landscape + ≥768px → cover/slider/controls visible, pill positions right (Review Focus 5)
- [ ] **Step 4:** Final gates both apps: `npx tsc --noEmit`, `npx expo lint`.
- [ ] **Step 5:** Commit: `feat: player entrance animation and design polish pass`
