# Changelog

All notable changes to the **Hydra Blocker** extension will be documented in this file.

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
