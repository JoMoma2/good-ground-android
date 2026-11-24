# Good Ground 1.8.1 — build 14

Syncing now has its own **More → Syncing** page with a dog selector and trainer connections/progress. Household Rules appear at the top of **Journal**, with a separate dog selector and Manage rules. They are no longer buried in dog profiles. Selecting a dog here does not change the training group or record practice.

On iPhone, automatic discovery now uses LiveContainer's permitted `_http._tcp` service with Good Ground TXT/name filtering and a real, bounded HTTP Upgrade endpoint, followed by the existing signed, mutually approved encrypted protocol. This addresses 1.8.0's `_goodground._tcp` / `NoAuth -65555` service restriction. Both phones should use the fresh 1.8.1 native build for automatic discovery. Manual-address binary framing remains compatible with 1.8's wire protocol. No host app modification or central server is introduced. Physical LiveContainer testing remains required; native macOS loopback tests are distinct from phone discovery.

Android receives the navigation changes and retains its explicitly unavailable wireless status. Version 1.8.1 / build 14 retains the reviewed curriculum and backup format 4. Existing dog records, trainer identities and remembered peers remain intact. New GitHub artifacts are an unsigned iPhone IPA and a separate debug-signed Android test APK.

---

# Good Ground Android 1.8.0 — build 13

Adds one local trainer identity, independent trainer progress structures, dog-specific household rules, authored Training Notes under Extra Information, and Familiar Skills Skip for Now. Existing training data, journals, history, cues and settings are preserved. Skip changes order only, not progress or practice records. Curriculum 8 is unchanged: 154 skills, 386 active steps, 45 historical steps and 87 source records.

Backups are format 4 and accept formats 1–3. New saves/exports require the new app; retain a pre-update backup for rollback. Android retains its native document picker, private atomic file storage, sound instructions and hardware Back behavior. All new web resources are explicitly allowed by its native resource boundary.

The experimental native nearby transport belongs to the iPhone version. **Android wireless is not implemented in this release**; the Android interface truthfully reports that limitation. Local rules/notes and the tested exchange model are available, without claiming Android device connectivity. See [NEARBY_TESTING.md](NEARBY_TESTING.md).

GitHub builds a downloadable debug APK for direct testing. It uses the separate `.debug` application identity and is not an update for production installations. No production signing key is included or replaced. Existing debug apps may also require a matching debug certificate for an in-place update; export records before changing installations. Nothing is published to an app store.

---

# Good Ground 1.7.1 — build 12

The iPhone About and Backup screens now use ordinary platform guidance. Current user documentation no longer directs users through third-party app containers, alternate installers or installation-permission workarounds. Android's recovery message now describes an app update rather than a manual package installation.

Version metadata is 1.7.1 / build 12 on both platforms. Curriculum 8 and setup revision 2 are unchanged: 154 skills, 386 current steps, 45 historical steps and 87 reference records. Existing profiles, progress, notes, cues, history and backups keep their current formats.

The full curriculum review remains in [CURRICULUM_REVIEW_2026-10-28.md](research/CURRICULUM_REVIEW_2026-10-28.md). Earlier release documentation is preserved in the central Archives folder. Store signing, submission and approval are separate from preparing these local release files.
