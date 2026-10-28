# Build and test Android

Use JDK 17 or 21, Android SDK platform/build-tools 35, and `ANDROID_HOME` pointing to that SDK. The pinned wrapper is Gradle 8.11.1; Android Gradle Plugin is 8.9.2. Android Studio can open the `android` directory. Package `local.goodground.training`, versionCode 12, versionName 1.7.1; minSdk 26, targetSdk 35. No architecture-specific native libraries are used.

```sh
npm ci
npx playwright install chromium
npm test
npm run check
npm run test:android
npm run test:ui
npm run test:bridge
npm run test:updates
npm run test:edges
npm run test:handoff
npm run test:curriculum
bash scripts/build-android.sh debug
```

The debug APK is `build/android/GoodGround-Android-Test.apk`, package `local.goodground.training.debug`, with isolated storage. Release uses `bash scripts/build-android.sh release`. Every build runs the corresponding Android lint task. Release requires the existing private signing key: local `android/.signing/goodground.jks` and `android/.signing/password`, or `GG_ANDROID_KEYSTORE`, `GG_ANDROID_STORE_PASSWORD`, `GG_ANDROID_KEY_PASSWORD`, optional `GG_ANDROID_KEY_ALIAS` (default `goodground`). Never commit or put credentials in a source archive. Source ZIP recipients need their own signing setup for release; debug builds need none. A new key cannot update the original signed personal app.

## Actual Android runtime checks

Use a disposable Android emulator, never a personal phone. The script refuses non-emulator serials and only clears the separate debug package:

```sh
export ANDROID_SERIAL=emulator-5560
bash scripts/android-smoke.sh
node tests/android-runtime.cjs
```

The smoke launch exercises the Java bridge, lesson navigation, backup parsing, ten native store checks and process restart. The runtime script uses WebView's debug-only local DevTools socket and actual touch events/hardware Back, verifies native saves/history/settings, measures marker signal, checks the document picker and captures a screenshot. It seeds only emulator debug records and uses temporary localhost port 9223. Node 22+ is required for this runtime script. Reports are under `build/android-validation`; browser-only reports explicitly mark their mocked bridge.

## Content and packaging

Edit content inputs under `research/` and `scripts/advanced-content.py`/`extend-content.py`; run `python3 scripts/extend-content.py`, then checks. Preserve stable step IDs and historical records. The full prerequisite audit uses bundled historical baselines without needing Git. Keep this Android curriculum synchronized deliberately with iPhone; there is no shared writable source folder.

```sh
python3 scripts/package-source.py /path/to/GoodGround-1.3.0-Android-Source.zip
```

Packaging excludes Git, dependencies, build outputs, test reports, local SDK paths, private signing material and saved progress. Do not copy the whole archive or private signing folder into a public release. Native assets are allowlisted in `MainActivity.java`; adding a new runtime web file requires updating that list and bridge checks.

## Curriculum 7 / 1.4.0 additions

`curriculum-expansion.py` authors the 50 additions; `prerequisite-review.py` revises existing gates after the older generator stages. Run `python3 scripts/extend-content.py` for both data bundles. `research/prerequisite-review.json` records each active step’s reviewed dependencies; audit checks all four historical baselines and the exact 104 → 154 expansion. Read `docs/archive/DEVELOPMENT_REPORT_1.4.0.md` for editorial reasons.

`dailyPractice` selects learned maintained skills per selected dog. `logPracticeToday` writes idempotent linked journal records atomically, without changing progress or observed completion history. New maintenance-eligible lessons carry `maintenance: true`; existing eligible codes remain supported. Detailed same-day logs count too. Calendar refresh respects unsaved forms and open dialogs.

Run `npm test`, `npm run check`, and `npm run test:expansion` (also with `GG_BROWSER=webkit`). The expansion browser suite opens all 120 new steps and checks the daily queue, correction, local-date rollover, tables and accessibility. Platform-specific tests remain required for transport and native behavior.

## Lesson browsing and current release layout

The Lessons landing page renders the topic directory, never all 154 skill cards. `librarySelection` applies word-prefix search, exact current/archived Step IDs, selected-dog cues, topic and progress filters. `libraryResults` renders at most 12 compact rows and accessible page controls. Category pages have their own search and remembered page. Browse state is temporary UI state and does not change dog records or backup formats. The original topic routes and Fridge task alias remain valid.

Run `npm run test:library` in Chromium and WebKit. It reaches every skill once through topic pagination and checks search, filtering, dog ownership, keyboard focus, text size and accessibility.

Keep one current installer and one current source ZIP per platform outside the active Git checkouts. Put superseded releases, old generated builds and old validation into the central Archives folder, with versioned subfolders where known. Historical design notes inside a checkout belong in `docs/archive`. Keep generator inputs and compatibility fixtures in place. New verification belongs in `validation/v1.6.0`; current `build` and `test-results` folders are generated and ignored. Never move or reset the active `.git`, `.signing` or personal app records as part of cleanup.


## Current lesson and preparation architecture — 1.6.0

`step.setup` is required on every active step. The 154-skill/384-step review lives in `research/step-setups.json`, with a readable report in `research/SETUP_REVIEW.md`. `scripts/review-setups.py` applies it after curriculum generation and checks original teaching/criterion/prerequisite fingerprints. Changes to an exercise require reviewing its preparation. `python3 scripts/extend-content.py` must reproduce both data bundles exactly. Archived original guides remain intact.

Lessons have one layout. `settings.lessonMode`, `settings.lessonSections`, their API helpers and their UI are retired. Validation strips the old keys on load/import; later saves and exports contain only active settings. New fields are not required in personal records. Marker, theme, text size and reminder preferences retain their behavior.

`lesson-controls.js` owns only viewport/docking geometry for the single existing control group. A measured placeholder reserves its flow space. The group is fixed above the measured navigation while the slot lies below the usable viewport, then becomes static inside that slot. Its height updates scroll padding. It does not duplicate buttons or change training records; extremely cramped visual viewports use in-page controls rather than consuming the entire reading area. Android must allow every script referenced by the bundled HTML; `npm run check` verifies that contract.

Settings submission reads the same fields for ordinary Save and Save and Exit. Exit waits for storage success or the matching native saved revision. Busy controls block duplicate actions; stale acknowledgements cannot finish the save, and error/timeout leaves the form and choices available. Failed staged settings are rolled back in memory while the draft stays in the form. Android Back delegates to the same dialog and retains its route stack.

`npm test` includes setup coverage/fingerprints and old-preference migration. Run all nine browser suites in both Chromium and WebKit, including `test:redesign`, for relevant changes. Logs belong in `validation/v1.6.0`; do not overwrite earlier validation or personal records. The redesign suite checks every step's setup through fresh deep-linked documents to avoid WebKit's synthetic hash-navigation rate limit.

A complete source handoff includes the new web module, review JSON/script, setup tests and the hidden `.github` directory. Upload the active checkout contents as the GitHub repository root, rather than nesting the platform folders or uploading just previously tracked files. Portable source ZIPs include all required inputs and exclude build output, dependencies, private signing and office lock files.

## Curriculum 8 / 1.7.0 correction layer

`scripts/curriculum-review.py` applies the authored `research/curriculum-corrections-8.json` after historical authoring stages and before reviewed setups. Edit that layer for current corrections. `curriculum-review-8.json` fingerprints all current skill and step fields; re-review the actual instruction and preparation before updating its hashes. `scripts/audit-content-review.cjs` rejects unreviewed changes and checks source annotations, shared guidance and nine explicit retirements. `npm run check` includes this audit.

The 1.6.0 fixture preserves exactly what was current before this review. Retired appliance step IDs remain historical, not aliases for new exercises. Do not add `replaces` links that credit appliance history to prop contexts. Current and archived guide pages can share a skill code; individual step IDs must stay unique. Earlier progress history is never recomputed from the revised denominator.

Regenerate both data bundles with `python3 scripts/extend-content.py`, run checks and unit suites, and run all nine browser suites in Chromium and WebKit for both platforms. Current reports belong in `validation/v1.7.0`; preserve older validation. The current lesson count is 386, archived count 45, and setup revision 2. Source access scope is part of the content, not permission to claim every full paper was read. Software checks do not establish training efficacy.

## Version 1.7.1 / build 12

Current public-facing copy uses standard platform help and backup instructions. Keep private build tooling and signing details out of the app's user flows. The unsigned iPhone build/repackaging tools remain development artifacts and are not a signed distribution archive. No store release is performed by source packaging. Android release builds retain the existing package identity and signing key.

Curriculum 8, setup revision 2 and all training-data fingerprints remain unchanged from 1.7.0. Keep current validation in `validation/v1.7.1`; preserve previous results. Run existing checks and browser coverage after modifying shared help pages.

## Shared research and historical files

The workspace's active evidence library is `Research/Sources and Verification`, outside the platform checkout. It is not required to regenerate the bundled curriculum: all required app research inputs remain under this project's own `research/` directory. The original workbook is historical under `Archives/Research/Original Workbook`. Older versioned validation and old generated output were moved out of the active checkout; build tools recreate their local output directories when needed. Current validation remains under `validation/v1.7.1`.
