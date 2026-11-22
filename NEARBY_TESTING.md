# Good Ground Android 1.8 — collaboration status

This version adds the same stable local trainer identity, independent progress model, household rules, authored Training Notes, conflict-preserving records and Familiar Skills **Skip for Now** as the iPhone version. Existing dog profiles, progress, history, journals, cues and settings are preserved. A name is optional for solo training; there is no trainer switch.

**Android nearby wireless is not implemented.** The experimental native transport currently exists in the iPhone repository only, and still requires physical iPhone/LiveContainer validation. Android explicitly reports that no wireless discovery or synchronization is running. Browser simulations test data exchange logic, not Android radios, sockets or device-to-device connectivity. Android cannot pair with another Android or iPhone in this build. This is a documented platform limitation, not a completed Android synchronization feature.

Household rules are under each dog's profile. Authored notes are inside a lesson's Extra Information → Your notes. Rules and notes are stored locally here. The underlying versioned exchange model is ready for eventual Android transport: per-trainer step records, immutable causal operations, preserved concurrent edits, tombstones, packet checksums and durable-save acknowledgements. Future compatibility depends on protocol major/minor and required capabilities, rather than exact app-version equality. Private journals, step notes, cues, priorities and device settings are not part of dog exchange packets.

Skip for Now rotates today's eligible familiar dog/skill to the back of a temporary queue. It records no practice, changes no grade, and creates no journal entry. Practiced today retains the existing actual practice-recording behavior. Rotation resets for a new local day, changed dog selection or a new app opening.

Backups use version 4, accepting versions 1–3. Restore keeps this installation's trainer identity and original note authorship. An old shared removal is retained for matching shared-dog history. Restore is recovery, not two-way sync; it replaces local dog records. Keep a pre-update backup for rollback: older apps reject new saves/exports rather than silently dropping new metadata. Copying an app's private container or using a full backup as a pairing method is unsupported. A lost installation identity does not recover edit ownership of old authored notes.

## Distribution build

The GitHub workflow uses the pinned Gradle wrapper 8.11.1, Android Gradle Plugin 8.9.2, Java 17 and Android SDK/build-tools 35. It runs source/curriculum/unit/package and browser checks, compiles `assembleDebug` plus `lintDebug`, verifies every bundled web asset against source, checks package/version/certificate and uploads a downloadable APK and checksum.

The artifact is **GoodGround-Android-v1.8.0-debug-APK**, containing `GoodGround-Android-v1.8.0-debug.apk`. It is an ordinary installable debug-signed APK for first-time testing, package `local.goodground.training.debug`, version `1.8.0-test`, versionCode 13. It can install alongside the normal `local.goodground.training` application. It does not update production installations. Debug certificates may change on separate runners, so this is not a stable production update channel. Do not uninstall an existing test app merely to overcome a signature mismatch without exporting its records first.

Download the artifact from a successful GitHub Actions run, extract its ZIP, and share the APK (not the artifact ZIP) through Google Drive. No Google Play publication or new production signing identity is required or performed. Production upgrades require the original package identity and original signing key, which are not included in this public repository. Private signing material remains outside publication.

Run locally where an Android toolchain is available:

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
bash scripts/build-android.sh debug
```

Browser tests use a simulated Android bridge/virtual asset origin. Real Android WebView/runtime tests use the existing disposable-emulator scripts documented in DEVELOPING.md. This publication task does not claim a physical Android-device or emulator pass unless separately recorded in its final report.
