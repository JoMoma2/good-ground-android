# Shared training assessment — 1.2.0

True household synchronization is useful: two trainers should see the same dog profile, progress, cues and dated practice without manually replacing records. It is deferred in this release because the current app cannot provide that reliably without a service and a new data model.

## Existing architecture

`ios/GoodGroundApp.swift` owns an atomic, local `progress.json` plus a previous snapshot. The browser uses localStorage. The two stores are independent. `core.js` models multiple dogs inside one local household; it does not model multiple people, devices or permissions. Its revision counter orders writes from one app instance, not concurrent edits from two devices. The bundled Content Security Policy disallows network connections. There is no backend, identity provider, invitation system or cloud database.

Backups are complete replacement snapshots. Sharing or importing one is a transfer, not synchronization: a later import could erase another trainer's work. Placing that JSON in a shared folder would not solve simultaneous edits, deletion, stale copies, or ownership. No sync-looking controls or automatic uploads were added.

## Recommended direction for a separate feature

Use one explicitly shared household with authenticated member invitations, stable household/dog identifiers and a service enforcing membership on every operation. Keep an offline local cache and an outbox. Every edit needs a unique operation ID, writer ID, record ID and server revision; retrying an offline write must be idempotent. Use server transactions, incremental cursors and deletion tombstones rather than merging whole JSON snapshots.

Journal entries can usually merge by immutable IDs. Editing/deleting an entry needs record revisions. Conflicting profile fields can be shown for resolution. Conflicting progress stages need special care: choosing the furthest stage can wrongly advance a worried dog; blind last-write-wins can lose a deliberate pause or regression. Preserve both changes, show the conflict, and hold advancement until a trainer resolves it. Completion history should follow accepted shared states with an explicit time basis, retaining catalog version and counts.

Invite/revoke flows, lost-device recovery, per-member access, transport encryption, server access rules, retention/deletion, exports and a clear local-versus-shared state must be designed together. Existing profiles can contain health notes and household information; uploading them requires an explicit opt-in and clear disclosure. Keep local-only use available.

## Conditions before shipping

Validate simultaneous and offline edits from two devices, clock differences, duplicate retries, invite revocation, deleted records returning from an old client, conflicts in paused/progress stages, catalog upgrades, service outages, restores and household membership boundaries. Test service authorization separately from UI checks. Decide service ownership, operating cost and maintenance first. An actual two-device test with agreed conflict behavior is a release requirement, not a later polish item.
