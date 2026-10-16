# SR — Future cloud service, sustainability and user independence

**Status:** Discussion notes / future consideration only (2026-10-16). **Not authorized for implementation.** Current Stage 11 automatic synchronization remains **ON HOLD**. These ideas do not supersede current implementation priorities, product behavior, or test gates.

## Product intent and funding

- SR remains a **general-purpose, audio-first memorization tool**; Scripture memorization is one useful application, not an exclusive audience.
- The owner does **not** seek to maximize profit. If offered publicly, the aim is for SR to be **self-supporting** rather than requiring ongoing personal subsidy.
- Keep a fully useful **free, local-only edition**: authoring, REVIEW/AUDIT, step mastery, Android listening, and manual JSON export/import. No required account, paid plan, or network service for the core learning workflow.
- A possible **optional annual cloud subscription** in the neighborhood of **$10–$15/year** is an *early idea*, not a price commitment or validated business case. Charge only for hosted cloud services (e.g., managed storage, cross-device automatic sync, managed backup/recovery), **not** for the Android app or the ability to learn.
- Device voices remain the user's responsibility. Do **not** plan to sell, host, or license premium voices. Optional customization (e.g., user-selected step/flashcard chimes) may be considered later, but is not an approved paywall or development assignment.
- Any future pricing must be evaluated against realistic hosting, storage, egress, backups, payment fees, taxes, security, support, and customer count. Avoid spending development effort on monetization until owner requests it.

## Future cloud architecture — investigate, don't assume

- Current manual JSON transfer via **OneDrive** is working and acceptable; there is **no urgency** to replace it.
- If optional cloud sync is eventually approved, investigate **Supabase managed PostgreSQL/auth** as a leading candidate, and compare with **DigitalOcean** managed or self-hosted options and other suitable solutions. No provider has been selected.
- Preserve **local IndexedDB as the working store** and Android's offline, native playback. A cloud service would synchronize, not make speech and learning dependent on a live connection.
- Investigate safe multi-device change propagation, offline queues, revisions, independent authored-content versus mastery changes, idempotency, deletions, conflict resolution, authentication, tenant isolation, and backup/restore. Do not assume Supabase automatically syncs IndexedDB.
- Design for a possible ~1,000 cloud customers and growth, but benchmark real storage/traffic and costs before choosing infrastructure.
- Account expiration, subscription cancellation, loss of internet, or provider outage must **never** lock users out of their locally stored learning material.

## User ownership, portability and continuity

- **Users own their learning content and progress.** Full, documented JSON export/import must remain available without a subscription, including a path to retrieve cloud-only changes before account closure.
- Maintain compatibility and recoverability of authored series, cards, ordered steps, mastery, due dates, and other necessary progress; do not make paid cloud access the only way to use or recover data.
- Explore a **downloadable, independently runnable offline desktop edition** (all required HTML/JS/CSS/assets plus a simple local launcher or installable app), so users can create, edit, REVIEW, AUDIT, and import/export indefinitely even if the public website disappears.
- **Do not assume saving `library.html` alone works**: module dependencies, IndexedDB origin isolation, and browser restrictions on `file://` require a deliberate packaging and persistence strategy.
- Android already packages listening assets; preserve its independent offline operation and provide a way for users to retain a compatible installer and JSON backups.
- Future acceptance should include disconnected cold launch, edit/review, persistent local storage after restart, complete JSON round trip, and cross-device restore. This is not yet certified; desktop cold-offline launch remains Stage 9 **ON HOLD**.
- Keep independent backups and a documented exit path so an eventual service shutdown does not strand customer data.

## Next steps (only if authorized)

1. First continue normal real-world use and learning-focused refinements.
2. If commercial cloud becomes a real goal, request a **technical and cost preflight** (Supabase vs DigitalOcean, sync integration, data security, billing/support and backup recovery).
3. Separately evaluate an offline distributable edition and prove independent operation.
4. Obtain explicit owner approval before any cloud account, backend, subscription, offline-packaging implementation, or changes to Stage 11.

**Guiding principle:** The memorization tools should remain useful without payment or a hosted service. Optional cloud convenience should pay for itself without holding users' knowledge hostage.
