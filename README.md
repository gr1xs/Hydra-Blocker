# Hydra Blocker 🛡️🐍

**Hydra Blocker** is an ultra-lightweight, telemetry-free, premium ad blocker for Twitch. It utilizes dynamic HLS stream swapping and fallbacks to bypass stream-stitched ads in real-time without buffering loops or video freezes.

---

## Key Features
* **Zero-Telemetries**: Completely clean and lightweight. Does not collect, track, or share any personal telemetry.
* **Multi-Headed Stream Swapping**: Dynamically swaps to alternative clean feeds (like heads of a Hydra) when Twitch stitches ads.
* **HLS Segment Stripping Fallback**: If alternative clean streams are temporarily blocked, the parser falls back to a custom manifest state machine that cleanly filters ad frames.
* **Multi-Blocker Coexistence**: Implements a Proxy-based recursion-guarded wrapper over `window.Worker`, preventing conflicts with other active blockers or scripts (like TwitchNoSub or Enhancer).
* **Glassmorphic Status Badge**: A sleek, premium neon-green status badge overlays on the player to inform you of the active block method and the number of ads bypassed.

---

## Installation

> Hydra Blocker is not on the Chrome Web Store. Install manually via **Developer Mode** — you will not receive auto-updates.

### Chromium (Chrome, Edge, Brave, Opera, Vivaldi)

**Stable release** — download `Source code (zip)` from the [latest release](https://github.com/gr1xs/hydra-blocker/releases/latest), extract it, and load the folder as an unpacked extension at `chrome://extensions`.

**Latest (main branch):**
```bash
git clone https://github.com/gr1xs/hydra-blocker.git
# Load the hydra-blocker folder as unpacked
```

---

## Privacy Policy & Data Collection Statement

* **Privacy First**: This extension does not collect, store, or transmit any user data to third-party servers. All processing happens entirely locally in your browser.
* **Authentication Fallback**: The extension intercepts Twitch's GQL fetch requests and local storage variables solely to extract the active session's authentication headers and device ID. This is done strictly inside the browser sandbox to request alternative clean media streams on your behalf. No keys or tokens are ever sent outside your device.

---

## Technical Information & Fallbacks

Twitch's web client ID (`kimne78kx3ncx6brgo4mv6wki5h1ko`) is included in `inject.js` as a static backup token. This is a publicly accessible identifier used by Twitch's official web player. Hydra Blocker dynamically reads and updates this token from active browser page requests in real-time.

---

## Disclaimers & Terms

> [!WARNING]
> This extension is not affiliated with Twitch. Use at your own risk. By using this extension, you acknowledge that it may violate Twitch's Terms of Service.

**Disclaimer**: This extension is an independent, open-source project and is not affiliated with, endorsed by, or sponsored by Twitch Interactive, Inc. It is provided for educational and research purposes. Use of this extension may violate Twitch's Terms of Service. The authors assume no liability for any consequences resulting from its use. By installing and using this extension, you acknowledge full responsibility for your actions.

---

## License

This project is licensed under the [MIT License](LICENSE). Feel free to fork, customize, and modify.