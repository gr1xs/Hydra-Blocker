# Changelog

All notable changes to the **Hydra Blocker** extension will be documented in this file.

## [1.0.1] - 2026-05-22

### Added
- **Non-Destructive Player Recovery**:
  - Implemented `findTwitchPlayer()` to traverse React Fiber and interact with Twitch's live `MediaPlayer` container.
  - Implemented a multi-layered reload recovery sequence (`player.reload()`, `player.refresh()`, or `player.core.reload()`) to cleanly re-initiate stream playback.
  - Added a quality-reset fallback (`player.setQuality(currentQuality)`) which forces Amazon IVS player SDK to update the HLS manifest without tearing down decoder states.
  - Added a non-destructive video playback kick fallback (seek back `0.2s` and resume play) to force buffer segment re-fetching on the HTML5 video element directly without clearing `.src`.

### Fixed
- **Fatal Error #4000 (MediaSource Detach)**:
  - Eliminated the destructive `videoEl.src = ''` assignment during stream recovery transitions, preventing browser-level MSE crashes.
- **Ad Blocker Coexistence**:
  - Fully resolved playback conflicts, freeze loops, and fatal exceptions when running concurrently with other active ad blocker extensions.

## [1.0.0] - 2026-05-21

### Changed
- **Anti-Spam Console Logging**:
  - Commented out the repeating HLS media playlist interception logging to clean up Chrome DevTools.
  - Debounced the ad-shielding status channel to log transitions (ad start, ad end, method swap) instead of every 2-second segment reload.
- **Fallback Client ID**: Added inline documentation to the fallback Twitch Web Client ID, detailing its public nature and dynamic override behavior.

### Fixed
- **Stream Buffering & Ad Loop**:
  - Implemented a state machine in `sanitizeManifest` to track ad segments using `#EXT-X-DISCONTINUITY` boundaries and `CLASS="twitch-maf-ad"` tags.
  - Selective filtering of `#EXT-X-TWITCH-PREFETCH:` and `#EXT-X-PRELOAD-HINT:` URLs during active ads. This prevents playlist starvation, stream buffering, and runaway ad-count indicators.
- **Extension Coexistence**:
  - Implemented a recursion-guarded `window.Worker` JS Proxy that allows other active blockers (e.g. *TwitchNoSub* or *Enhancer*) to chain-link hooks concurrently without triggering stack overflows or initialization loops.
