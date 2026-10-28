# Project research inputs and curriculum reviews
+
+Keep this directory with the app project. It contains the local inputs needed for independent, reproducible builds and portable source packages.
+
+## Current review and authored corrections
+
+- [Full curriculum review](CURRICULUM_REVIEW_2026-10-28.md) — every skill and step decision.
+- [Authored curriculum-8 correction layer](curriculum-corrections-8.json).
+- [Exact content-review ledger](curriculum-review-8.json) — reviewed fingerprints, source scopes and explicit retirements.
+- [Step setup review](SETUP_REVIEW.md) and [reviewed preparations](step-setups.json).
+- [Prerequisite review](prerequisite-review.json), [readable audit](PREREQUISITE_AUDIT.md) and [historical baselines](prerequisite-baselines.json).
+
+`base-data.json`, `additional-sources.json` and `previous-project-guides.json` are required generator inputs. Older evidence briefs, app reviews and timing records retain provenance; they do not override the current authored correction layer. An intermediate baseline is not the complete current curriculum.
+
+In the full Good Ground workspace, the wider shared evidence collection is under `Research/Sources and Verification`; start with the workspace's `Research/README.md`. The verified collection and these project-local inputs serve different purposes. A portable source ZIP includes everything needed to regenerate the app and does not require the wider research folder or historical workbook.
+
+Run `python3 scripts/extend-content.py` from the project root, then `npm run check` and `npm test`. Re-review actual content before updating fingerprints.
+