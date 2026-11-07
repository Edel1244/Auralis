# AURALIS for Android

A small native app (Java, no third-party libraries) that opens an AURALIS server
in a WebView: first-run server setup, origin-locked navigation, file uploads,
downloads, back button, and update notifications from GitHub Releases.

## Build

The APK is built by GitHub Actions (`.github/workflows/android-release.yml`), so
no Android SDK is needed locally. To build on your own machine you need JDK 21,
the Android SDK (platform 36) and Gradle 9.9:

```bash
cd android
gradle assembleRelease   # unsigned unless ANDROID_KEYSTORE_FILE etc. are set
```

Icons are generated from `src/app/icon.svg`: `node android/scripts/make-icons.mjs`.

## Signing

Release APKs must always be signed with the same key, or installed apps can't be
updated. The key lives outside the repository; the workflow reads it from three
repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the PKCS#12 key store, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | its password (also the key password) |
| `ANDROID_KEY_ALIAS` | the key alias (`auralis`) |

**Keep a backup of the key store.** If it's lost, existing installs can't receive updates.

## Releasing a new version

1. In `android/app/build.gradle.kts`, raise `versionCode` by one and set `versionName` (e.g. `1.1.0`).
2. Add release notes at `docs/releases/android-v1.1.0.md`.
3. Commit, then tag and push: `git tag android-v1.1.0 && git push origin android-v1.1.0`.

The workflow publishes **AURALIS v1.1.0 (Android)**. Desktop releases use `vX.Y.Z` tags
and are titled **(Desktop)**.
