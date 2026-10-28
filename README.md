> **1.7.1:** Standard platform help and backup guidance, with container-specific and development-installation instructions removed from the current user documentation. Curriculum 8 remains unchanged.

> **Curriculum review, 1.7.0:** All 154 existing skills and all 384 previous active steps were reviewed for teaching accuracy, progression, welfare and evidence scope. Current curriculum: 386 steps, 45 historical steps and 87 source records. See [the complete review](research/CURRICULUM_REVIEW_2026-10-28.md).

# Good Ground — Android 1.7.1

Offline dog training for Android 8.0+. This port shares the current iPhone training interface, curriculum 8: 154 active skills, 386 active teaching steps, 45 preserved earlier steps and 87 sources. Independent components, prerequisites, dropdowns, dog profiles, tailoring, clicker settings and real progress history remain intact.

The Java Activity hosts only bundled HTML/CSS/JavaScript in Android WebView. The native bridge provides atomic private-file saves, previous-save recovery, Android document export/import, appearance, Back handling and safe-area/keyboard insets. References open in the external browser. Training requires no account and works offline. Optional feedback has narrowly allowed Internet access to Formspree; there is no analytics or automatic synchronization.

The shared training core, curriculum, marker synthesis and styling are copied unchanged from iPhone. `app.js` adds Android bridge transport and Back handling, and adapts platform-specific help. No records are bundled with the app. JSON backup version 3 is shared with the current iPhone release; older supported backups remain importable.

[Install](INSTALL.md) · [Build and test](DEVELOPING.md) · [Validation and limitations](VALIDATION.md) · [Inherited curriculum decisions](docs/archive/CURRICULUM_REWORK.md)

The original iPhone checkout and earlier Android repository are retained outside this project. See [the original port record](<../../../Archives/Development Records/ANDROID_PORT_RECORD.json>) for provenance and verified directory moves.

This release contains 154 skills and 386 active teaching steps, including the 50 skills added in the earlier expansion. Today and Practice rhythm offer daily maintenance without changing completion. See [current update notes](UPDATE_NOTES.md) and [the earlier development report](docs/archive/DEVELOPMENT_REPORT_1.4.0.md) and [validation](VALIDATION.md).

## Workspace organization

In the complete Good Ground workspace, shared evidence and independent verification live in `Research/Sources and Verification` at the workspace root; start with its `Research/README.md`. The current shared handoff is under `Documentation/`. Historical releases, earlier validation and old generated files belong under `Archives/`.

This project's `research/` directory contains required local generator inputs and review ledgers. Keep it with the project when building or distributing the portable source ZIP. Current local validation remains in `validation/v1.7.1`; older reports were moved into the platform archive. The active Git repository, platform build files, signing configuration and app records were not relocated.
