# Good Ground 1.7.1 validation

Current results are in `validation/v1.7.1`; earlier reports are retained.

- 104 existing unit tests pass per platform. Complete curriculum, source, prerequisite and historical-record audits pass.
- The training-data bundles and shared state/backup logic are byte-identical to 1.7.0, and generation reproduces them exactly.
- All nine existing browser suites pass in Chromium and WebKit on each platform: 36 suite runs, with 118 grouped checks per engine/platform. About reports 1.7.1; About and Backup have no container or alternate-installation advice. Screenshots of both pages were captured; the iPhone pages were visually checked.
- Current app web assets, native strings and current user documentation pass the distribution-workaround wording scan.
- Android's seven mocked transport checks pass. Release build and lint pass; build 12/version 1.7.1, all bundled web files and the unchanged signing certificate are verified.
- The iPhone package retains its previous native executable and verifies every updated bundled file. It remains unsigned; no fresh Xcode build or App Store signing is claimed on this Linux host.
- Five iPhone portable-source integration tests pass. Clean extracted source packages are also checked for deterministic generation and local/private-file exclusions.

No native emulator, physical phone or assistive-technology run was repeated for this wording/version update. No personal-device records were accessed or reset, live feedback sent, store submission made, or app published.
