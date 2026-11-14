# Navigator Redesign — Design Doc

Date: 2026-11-14
Status: Draft for approval
Scope: Both apps (`openspot-mobile/` and `openspot-desktop/` — near-identical Expo Router tab layouts)

## Intent & why

The bottom navigator feels dated and heavy: flat full-width bar, hard 1px border,
five icon+label pairs at all times, and a mini player colliding with it. A mockup
review (browser companion, 4 directions) picked **C · Material Island** — the
active tab grows into a soft green-tinted island containing its label; inactive
tabs are icons only. The user also chose to **fold Downloads into Library**
(4 tabs), Spotify-style.

## Goals

1. **Material Island tab bar** in both apps, matching the approved mockups:
   - Active tab: rounded pill, tinted background, icon + bold label in the accent color.
   - Inactive tabs: icon only, muted color.
   - Bar: full-width, ~74px + safe area, no hard top border — hairline separation
     instead (`rgba(255,255,255,0.06)` dark / `rgba(45,34,25,0.07)` light).
   - Colors (single source, not per-file inline hex):
     - Dark: pill bg `rgba(29,185,84,0.16)`, accent `#1DB954`, bar bg `#0e0e0e`, inactive `#9a9a9a`
     - Light: pill bg `rgba(22,124,58,0.14)`, accent `#167c3a`, bar bg `#fffaf2`, inactive `#7a6251`
   - Kill the iOS-only green special case (`#038434`) — one green per theme.
2. **4 tabs**: Home, Search, Library, Settings.
   - Downloads becomes a card inside Library ("Downloads · N songs · available offline")
     that navigates to the existing `/downloads` screen.
   - The `/downloads` route stays (hidden from the tab bar) so existing deep links,
     the download button flows, and the offline logic keep working.
   - Offline auto-redirect: when connectivity drops outside `/downloads`, route to
     `/downloads` as today (behavior preserved; it just no longer is a visible tab).
3. **Open on Home**: remove `initialRouteName="downloads"` in the desktop layout
   (mobile doesn't have it). App launches on the Home tab like a music app should.
4. **Mini player spacing**: mini player bottom offset must track the new bar height
   (74px + insets) so it floats above the island bar without overlap.

## Non-goals

- Restyling every other screen (that's the separate token-system cleanup).
- Redesigning the full-screen player, Library content, or Download screen internals.
- Any playback/downloading behavior changes.

## Anti-goals

- Breaking offline listening flows.
- Losing haptic feedback on tab taps (existing `HapticTab` stays as `tabBarButton`).
- Breaking i18n: tab titles come from `t('tabs.*')`; the Library Downloads card
  gets a new i18n key (en + all 10 existing locales).

## Approaches considered

- **A · Floating dock** (detached glass pill) — most modern look, but blur + safe-area
  handling is the riskiest build in React Native here. Rejected on build cost.
- **B · Quiet icons** (icon-only, glow dot, floating tag) — calm, but depends on icon
  recognition; user hesitated between B and C and settled on C. Rejected.
- **C · Material Island** — chosen. Familiar pattern, accessible, cheapest to build
  cleanly with `react-native-reanimated` layout animation on the active pill.

## Decided details

- Pill animation: layout animation (e.g., `LayoutAnimation`/Reanimated layout) so the
  pill moves between tabs smoothly; no new gesture surfaces.
- Labels: only the active tab shows a label (inside the island). Inactive = icon only.
- Tap targets stay ≥44px (full tab area remains tappable, not just the pill).
- Bar height and mini-player offset live in one shared constant per app (no magic
  numbers repeated).
- Desktop `initialRouteName` removed; offline-start behavior: land on Home, then the
  existing offline effect redirects to `/downloads` if connectivity is down at launch.

## Left to the builder

- Exact animation implementation (Reanimated shared-value pill vs layout animation).
- Library Downloads card placement/styling within the existing Library screen
  (top of "Your music" section, matching mockup).
- Final tint values if contrast checks demand tweaks (within the chosen hue).

## Risks

- Bar height change shifts mini player & queue sheet positioning — verify all three
  surfaces stack correctly in both orientations (desktop is resizable; tablet
  breakpoint 768px exists in the player).
- Downloads tab removal: verify no navigation code still links to the tab index
  positionally (grep for `downloads` routes after the change).
