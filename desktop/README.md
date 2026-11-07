# AURALIS Desktop

A small Electron shell that opens an AURALIS server in its own window: no
browser tabs, a taskbar icon, media keys, and update notifications. Accounts,
music and the community stay on the server.

## Use

Download `AURALIS-Setup-<version>.exe` from
[GitHub Releases](https://github.com/Edel1244/Auralis/releases), install it, and
enter your server address on first launch (for local development:
`http://localhost:3000`). Change it later from the menu: **AURALIS → Change server…**
(press <kbd>Alt</kbd> to show the menu).

## Develop

```bash
cd desktop
npm install
npm start            # runs against the server you enter on first launch
npm run dist         # builds dist/AURALIS-Setup-<version>.exe
```

`build/icon.png` is generated from `src/app/icon.svg` with
`node desktop/scripts/make-icon.mjs` (run from the repository root).

## Security

- `contextIsolation`, `sandbox` and no Node.js in pages; device permissions are denied.
- Only the configured server origin and the local setup page load in the window;
  every other link opens in the default browser.
- The preload bridge (`window.auralisDesktop`) exists only on the local setup page.

## Releasing a new version

1. Bump `"version"` in `desktop/package.json` (for example `1.1.0`).
2. Add release notes at `docs/releases/v1.1.0.md`.
3. Commit, then tag and push: `git tag v1.1.0 && git push origin v1.1.0`.

The **Desktop release** workflow builds the installer on Windows and publishes the
GitHub Release with the notes. Installed apps notice the new version on their next start.
