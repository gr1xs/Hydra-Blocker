# Contributing to Hydra Blocker

Thank you for your interest in improving Hydra Blocker! As an open-source project, we welcome contributions from developers, testers, and designers.

## How to Contribute

### 1. Reporting Bugs & Issues
If you encounter streaming issues, infinite buffering, or missed advertisements:
1. Search the open issues list to see if the bug has already been reported.
2. If not, open a new issue. Provide:
   - Your browser version and OS.
   - Other active browser extensions (especially other ad blockers).
   - Chrome console output logs (press F12 -> Console tab).
   - The Twitch channel name where the issue occurred.

### 2. Submitting Pull Requests
1. Fork the repository and create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Make your changes.
3. Verify your JavaScript files contain no syntax errors:
   ```bash
   node -c inject.js
   node -c background.js
   ```
4. Test the unpacked extension in Chrome developer mode.
5. Commit your changes with clear, descriptive commit messages.
6. Push to your branch and submit a Pull Request.

## Code Style & Guidelines
- Keep scripts lightweight and telemetry-free.
- Maintain the recursion guard and compatibility layers on `window.Worker` to ensure coexistence with other extensions.
- Format JavaScript code cleanly with standard 4-space indentation.
- Document any helper functions or complex state logic inside `inject.js`.
