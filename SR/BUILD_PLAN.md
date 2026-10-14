# Dex — SR implementation plan
Current Stage 6 desktop implementation · 2026-10-13

## Owner-approved roadmap revision — 2026-10-14

**This section supersedes the historical Stage 7–11 order and dependencies below; retain original stage numbering and historical descriptions for reference.**

- **Stage 7 — SUPERSEDED / NO ACTION.** No automatic grouping of adjacent BOUND flashcards into combined recitation units. Every flashcard remains independent with its own final-step eligibility, step mastery and schedule. BOUND means ordered flashcards, not merged cards. The last card may contain a complete passage; focused practice can select that card without a special passage feature. No Stage 7 application code is required; G7 is retired rather than claimed as tested.
- **Stage 8 — ON HOLD.** Focused selections and saved presets remain planned but are not a prerequisite for the revised next work.
- **Stage 9 — ON HOLD.** Desktop MVP hardening and release qualification remain planned and their unperformed acceptance checks stay open; no implied release certification.
- **Stage 11 — NEXT FOR DESIGN / AUTHORIZATION.** Implement optional Google Drive synchronization **before Stage 10**, initially around the existing desktop schema-2 library and JSON backup/restore. Dex must first investigate and report dependency changes, OAuth/security constraints, single-writer/conflict and recovery rules, and how an Android client can subsequently integrate. Do not assume the Stage 10 native completion protocol exists. No sync implementation is authorized merely by this roadmap change.
- **Stage 10 — AFTER STAGE 11.** Integrate authored REVIEW/AUDIT playback and progress on Android, using the established signing identity and native service. Adapt to the Stage 11 sync contract where appropriate. Preserve outstanding G2/G3/G6 and G10 verification requirements.

**Priority order: Stage 11 → Stage 10; Stages 8 and 9 remain on hold.** The original Stage 11 dependency on Stage 10 and Stage 8 dependency on Stage 7 are superseded. Do not silently reinstate automatic bound grouping or require on-hold stages before the newly approved order. This revision changes the plan only, not application code or gate evidence.

## Current authority and gates

The owner's Stage 5 rules and Stage 6 assignment supersede the original mastery bands, card-level schedules, L10 90-day interval, whole-unit completion credit and proposed bound recitation grouping. [SPECIFICATION.md](SPECIFICATION.md) is the current rule set. Stage 4 is formally CLOSED/PASS; earlier Android checks remain separately open. Stage 6 is authorized and implemented for desktop; **Stage 7 is superseded (no implementation)**. G6 core real-content desktop audible playback and scheduling have now been owner-verified on 2026-10-13; remaining detailed manual G6 checks stay open. Empirical results belong in [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md).

## Architecture

Keep plain HTML/CSS/ES modules, native IndexedDB and the existing static site. Content remains in series/flashcards, with steps embedded in authored order. Independent active step progress lives in schema-2 stepProgress; legacy progress remains a recovery archive. Use atomic transactions, revision/generation checks, explicit Save and confirmations. No server, framework, account system or synchronization service.

Desktop playback is at /SR/; authoring moves to /SR/library.html within the same origin and database. /SR/mastery.html manages mastery and previews REVIEW/AUDIT. Native Android listening remains the existing fixed-sample proof. Stage 6 preserves schema 2, native playback/service policy, asset allowlist, origin, application ID and signing.

## Stage 5 — implementation and G5

1. **Migration and recovery:** validate version-1 data, retain pre-migration and pre-import recovery separately, copy each card's progress to every step atomically. Preserve mastery/last-reviewed/due/revision; 10 gets null due. Never propagate across cards during migration. Keep identifiers, wording and order exactly. Test aborts, malformed data, reopening/idempotence and legacy JSON import. Export version 2; older applications reject it safely.
2. **Scheduling:** pure clock-injected functions for 0–9 = 15 min / 3 h / 6 h / 1 d / 2 d / 3 d / 1 wk / 2 wk / 1 calendar month / 3 calendar months. 10 = KNOWN, never normal REVIEW. Elapsed days/weeks, clamped UTC calendar months. Explicit changes schedule from change time; no playback-based mastery increase.
3. **Selection:** final-step eligibility anchor and identical window cutoff for all retained steps. Due now, N-day lookahead or Max Deferred. Preserve BOUND card order and all step order; optionally shuffle UNBOUND cards only. AUDIT ALL/one series selects KNOWN final steps; a wholly KNOWN BOUND series contributes only its last card. Continuous AUDIT cursor stops on request or empty eligibility and refreshes targets each cycle.
4. **Mastery actions:** individual steps; confirmed final-step/KNOWN propagation to the card or final BOUND series; lowering final mastery preserves earlier KNOWN steps. Confirm Reset FC, reset final only and audited final BOUND objective reset. Stage 5 does not implement role-based cue bands or infer missing author text.
5. **Completion foundation:** prepare/capture step identity, content/progress revisions, library generation and due-at-step-start status. Successful due REVIEW writes the current interval and a unique receipt in one transaction. Early/FOCUSED/AUDIT do not schedule automatically. Queue manual changes until successful step completion. Skip/Stop discard pending changes; special actions invoke pause and confirmation. Test retries, duplicate callbacks, stale edits, storage failure and restored generations without adding a full player.
6. **Desktop UI:** per-step level/interval/date display; explicit Apply; consequences before confirmation; REVIEW/AUDIT selection preview; optional recall seconds in the existing editor; retained selections on errors; keyboard and narrow-screen usability. New steps start at mastery 0 due in 15 minutes. Imported optional annotations remain recoverable.
7. **Verification:** real Chrome and real IndexedDB in isolated test databases, all prior suites, 1,000 cards × 10 steps, original-content equality, legacy/new backup round-trip, original recovery download and actual browser restart regression. Keep owner/device observations separate from automation.

**G5 passes** when the approved rules, atomic migration/recovery and desktop controls match these tests without losing content or silently altering other steps. Report unsupported physical-device claims and any open owner verification explicitly.

## Stage 6 — implemented desktop player and G6

1. `index.html`/`js/player.js` load the actual IndexedDB library. Link the preserved editor, mastery and Data screens; never seed/reset personal content. Choose REVIEW/AUDIT, ALL/one series, due-now/N-day/Max Deferred, unbound shuffle, voice, rate and default recall. Show authored card/step/text/state and empty/error outcomes.
2. `js/study.js` adapts Stage 5 selection/completion to the original `ReviewController`. A REVIEW pass keeps ordered units; AUDIT repeats refreshed eligible cycles. Questions, full recall waits and complete answers progress without extra gestures. Native `BrowserSpeech` remains the only desktop speech adapter.
3. Extend that controller with asynchronous prepare/commit/cycle hooks, retained in-flight work across pauses, exact Unicode text segments and long timer chaining. Preserve all original controls/cancellation tests. Commit only after the entire answer; retry the identical receipt/time without replaying an already finished answer.
4. Queue current-step mastery until successful answer completion, using the established confirmation policy. Reuse `StepCompletionController.special` for card/BOUND-series KNOWN and reset actions. Pause dialogs, discard interrupted choices, and exclude reset AUDIT targets on the next cycle. No automatic mastery increase.
5. Hold one exclusive origin/database Web Lock for the active/paused/error session. The transaction helper rejects other current-version writes during ownership. Preserve revision/generation checks for old tabs, stop late callbacks, await outstanding writes before releasing, and never resume automatically after reload.
6. Run all 162 prior scenarios plus Stage 6 isolated real-Chrome/IndexedDB/Web-Lock/UI tests, injected speech/error/timer/write races and deployed-site tests. Automation uses synthetic text and simulated sound; only the owner can confirm their actual Delaware is heard. See [PLAYBACK.md](docs/PLAYBACK.md).

**G6: CORE OWNER AUDIBLE/SCHEDULING PASS; formal full-checklist OPEN.** Owner heard a newly authored Delaware card on the home desktop, confirmed correct ordered question → recall → answer progression and checked the resulting Mastery due-date changes. Other manual playback controls, long passages, AUDIT sound and concurrency edge cases remain to be individually verified. Require exact Delaware wording/order, audible recall pauses/progression, controls, preferred/fallback voice, long answer/long wait, and explicit REVIEW/AUDIT/mastery outcomes. Preserve old gates independently. No Stage 7 work follows automatically.

### Android investigation boundary

The existing shared plan builder/parser caps recall at 120 seconds, text at 2,000 characters/action and actions at 100/unit; the service has a 120-second speech watchdog and a 150-second action-renewed wake lock. Its last-200-card diagnostic journal lacks durable per-step receipts, captured revisions, generation and due-at-start state. It cannot safely schedule authored steps while the WebView is suspended.

Stage 6 requires no native architecture change because it delivers desktop authored playback and preserves the functioning native sample. A future separately authorized integration must version the plan/receipt contract; add stable per-step answer boundaries and durable replay/acknowledgement; chunk text under the engine limit without early credit; handle long waits using renewed bounded wake ownership; and reconcile receipts atomically with JavaScript storage. It also needs physical screen-locked/Bluetooth/offline/process-death testing. Merely raising limits is insufficient. The automatically rebuilt APK contains shared storage/navigation updates, not the new desktop player or authored/native scheduling. No native long-recitation support is claimed.

## Later stages

Stage 7 passage features, Stage 8 expanded selections/presets, Stage 9 offline/recovery/scale qualification, Stage 10 complete Android listening qualification and Stage 11 optional Drive require their own authorization and must follow the current Stage 5 rules. The old automatic 1/2/4/full grouping and mastery bands below are historical proposals, not an approved implementation instruction. No AUDIT is a REVIEW and no KNOWN item becomes normally due again without explicit reduction/reset.

## Historical planning baseline

The original 2026-10-12 plan is retained below for investigation/history. Its statements about proposed/unimplemented stages, old data models, mastery bands/intervals, date rules, completion units, grouping and initial permission status are **superseded by the current specification and Stage 5 contract above**. Preserve useful platform investigation and later-stage risks without reinstating conflicting old policies.

<details>
<summary>Original planning document — historical, not current Stage 5 requirements</summary>

# Dex — SR Memorization System Build Plan

Planning baseline: 2026-10-12. Specification: `SR/SPECIFICATION.md`, v0.1. Repository inspected: `twpaige/CCTTRPG`, `main` at `5f6f7b520584600344aa03c3ebd95a397f69bdb6`.

**Status: investigation and proposed plan only. No application implementation or device certification has been performed.** All file names below, except existing repository findings, describe future work. Owner authorization is required before starting implementation. Approval of this document's publication is not approval of the unresolved product decisions.

**Owner clarification incorporated:** on 2026-10-12 the owner authorized investigation and recommendation of a minimal native Android TTS bridge if necessary. Android must still synthesize text dynamically, preserve shared JavaScript review/data rules and IndexedDB, and support reliable locked-screen progression. Desktop keeps browser speechSynthesis. The owner accepts Android Studio and a personally installed APK with guided setup; Google Play publication is unnecessary. This clarification supersedes the specification's prohibition on recommending native TTS without approval, but authorizes no implementation. The specification itself remains unchanged.

## 1. Executive Summary

Build a small, static HTML/CSS/JavaScript desktop application with native Web Speech synthesis and IndexedDB. Use ordinary ES modules, a few focused screens, explicit Save actions, one review controller, and complete JSON recovery. Plain JavaScript is sufficient; no frontend framework, backend, user accounts, cloud database, bundler, or runtime dependency is justified for the desktop MVP.

The most serious risk is Android: current compatibility data reports **no SpeechSynthesis support in Android WebView**, while Android Chrome supports it. Capacitor uses Android WebView. Therefore ordinary Capacitor packaging may fail before background execution even becomes relevant. Verify the actual phone/runtime first; do not promise that a foreground service supplies a missing speech API. This conclusion combines [MDN's compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechSynthesis.json) and [Capacitor's Android runtime documentation](https://capacitorjs.com/docs/android).

Use two short feasibility stages before committing to the full build. Stage 1 proves desktop narration and controls. Stage 2 tests Android API availability and a minimal native TTS service route, then locked-screen progression and Bluetooth on the owner's physical phone. Recommend a small local Capacitor plugin plus an Android foreground playback service if Web Speech is absent. JavaScript prepares the review; a native executor carries out its speech/wait actions without depending on WebView timers. If this fails, stop for an explicit scope/architecture decision or authorization to proceed desktop-only. This follows the specification's early Android gate without an open-ended mobile investigation.

There are **11 proposed stages**. Stage 6 first enables basic study of personally authored cards with scheduling. **Stage 9 is the first complete, usable desktop MVP** under the completion definition in section 14. Stages 10 and 11 are separately authorized later work, not desktop release dependencies. Microphone controls and Android authoring remain unnumbered future enhancements.

| Stage | Objective | Complexity | Dependencies | Testing gate | Resulting deliverable |
|---|---|---|---|---|---|
| 1 | Prove desktop speech and controller controls | Medium | Implementation authorization | G1: ordered audible playback and cancellation | Small repeatable desktop speech harness |
| 2 | Decide Android feasibility early | High | 1; physical phone/headset; D5 | G2: API/lock/offline/Bluetooth evidence and route decision | Tested feasibility record; no production app claim |
| 3 | Establish storage and safe snapshots | Medium | 2 passes or approved desktop-only carve-out | G3: atomicity, restart, valid/invalid restore | Persistent data layer and backup/recovery harness |
| 4 | Author series and ordered mnemonic cards | Medium | 3 | G4: complete authoring/reopen/backup workflow | Usable personal library editor |
| 5 | Define mastery presentation and dates | Medium | 4; D1, D3, D4 approval | G5: all levels and fixed-clock cases | Mastery screen and playback previews |
| 6 | Deliver sequential and randomized scheduled review | High | 5 | G6: due selection, controller, completion isolation | Basic personal desktop study application |
| 7 | Add bound groups and passage recitation | Medium | 6; D2 approval | G7: adjacency, coverage, mixed mastery/due cases | Phrase, group, and full-passage practice |
| 8 | Add focused selection and presets | Medium | 7 | G8: deduplication and zero scheduling writes | Flexible, reusable practice sessions |
| 9 | Finish offline, recovery, and scale acceptance | Medium | 8 | G9: all desktop workflows and release checklist | Complete desktop MVP |
| 10 | Package and qualify Android listening | High | 9; successful approved Android route from 2 | G10: real-device interruption and locked-walk tests | Qualified personal Android listening client |
| 11 | Optional manual Drive sync and restore | High | 10; D7 approval | G11: retries, stale events, conflicts, recovery | Optional cross-device sync with dated backups |

The numbered desktop stages are sequential: do not proceed until the preceding acceptance gate is recorded as passed. A failed gate requires a fix and retest or an explicit owner-approved scope amendment. An unavailable phone is not a pass. The stage 2 desktop carve-out is such an amendment, not a claim that Android works.

## 2. Existing Repository Findings

- Read the complete specification and experimental HTML at the baseline commit. `SR/` contains only `SPECIFICATION.md` and `Joshua18.html`; no SR application, database adapter, tests, package manifest, service worker, or build configuration exists.
- `Joshua18.html` is a single static page containing Joshua 1:8, Read Verse and Stop buttons, immediate `getVoices()` discovery plus a `voiceschanged` listener, exact preferred-name matching, `en-GB`, rate 0.9, pitch 1, volume 1, and `cancel()` before speaking. It preserves a useful minimal browser experiment.
- Its fallback is implicit platform selection. It has no visible selected-voice status, empty-voice recovery, speech completion/error handling, recall delay, multi-step loop, promise cancellation, pause/resume, review queue, persistence, or mobile lifecycle handling. Its source alone does not establish that any particular voice or offline playback works on this machine.
- Preserve both existing SR files. Create the future harness separately. Extract the tiny speech concept into new modules only after authorization; do not rewrite the existing experiment into an application.
- The root README identifies a public static website at `crownandcall.com`. `_config.yml` configures Jekyll/GFM with a layout scoped to `CCMud`; unrelated root HTML remains static. There is no root/SR `AGENTS.md`; the only discovered one is under the separate `CCMud/` subtree and does not govern SR. No tracked `.github` workflow or JavaScript package/test infrastructure was found.
- SR should stay independent of the TTRPG pages and the MUD documentation. Do not change root publishing configuration, route existing pages through SR, or introduce dependencies for unrelated projects. A later service worker must be scoped to `/SR/`.
- This planning delivery changes only `SR/BUILD_PLAN.md` on the existing `main`. No deployment command or publishing-configuration change is part of this work. The repository already has its own Pages publishing behavior; pushing a document does not certify an SR deployment.

## 3. Requirements and Scope

### Essential desktop behavior

The desktop MVP includes bound/unbound series; arbitrary practical numbers of ordered question/answer steps; create/edit/delete/reorder operations; explicit manual mastery 0–10; mastery-dependent cues; default scheduling; sequential and randomized review; due-only General Review; focused review and named presets; automatic narration; Start/Pause/Resume/Stop/Skip/Restart; settings and visible voice fallback; IndexedDB; complete validated JSON recovery; offline launch and a tested offline voice; and the 1,000-card × 10-step acceptance test.

Content remains learner-authored plain text. Do not infer final facts from step position, generate mnemonic imagery, rewrite a sparse story, or create subject-specific database columns. Direct questions and recitation targets must be explicitly authored. Multiple facts within one card must survive cue reduction. The specification's proposed scheduling intervals are initial defaults, not scientifically validated constants.

Focused review must not mutate mastery, last scheduled review, next due, or scheduling history. Listening never proves recall and never raises mastery automatically. General Review includes only cards due at session start; bound ordering constrains grouping, not due eligibility.

### Later scope

Android begins as a review/listening client with import/export, preset selection, read-only mastery, and the same review semantics. The clarified native-TTS option is the recommended investigation route; production packaging and background integration remain conditional on stage 2. Google Drive is optional and cannot gate local study. Tongue-click microphone input, automatic speech assessment, Android editing, statistics dashboards, elaborate search, streaming backup formats, and alternative scheduling algorithms can wait.

Excluded: public decks, social sharing, authentication as an application requirement, AI-authored content, server storage, paid speech APIs, and prerecorded audio. Android platform TTS is now permitted for investigation and recommendation; desktop retains Web Speech and its preferred voice. No speech engine or bridge is being implemented by this planning assignment.

## 4. Technical Feasibility Assessment

Evidence below was checked on 2026-10-12. Documentation establishes API behavior and constraints, not successful execution on the user's devices. All empirical gates remain unrun.

| Area | Assessment | Consequence and verification |
|---|---|---|
| Desktop Web Speech | Straightforward API, experiential reliability unproven | SpeechSynthesis is broadly available in modern browsers. Certify Windows Chrome first; optionally smoke-test Edge. Firefox/Safari support does not imply identical voices or control behavior. See [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). |
| Sequential narration | Straightforward design; long-session gate required | Advance on utterance `end`, not a guessed duration; handle `error` separately. Test duplicate, late, and missing callbacks. See [end](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/end_event) and [error](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/error_event). |
| Voice loading and offline speech | Requires measurement | Discover immediately and again on `voiceschanged`; inventory can initially be empty. Voice availability depends on environment. `localService` distinguishes local/remote services but is not a substitute for an airplane-mode test. See [getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices) and [localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService). |
| Native pause/resume | Browser-sensitive | Android compatibility notes say pause can end the utterance. Establish approved sentence/utterance-restart semantics if exact continuation cannot be made reliable. See [MDN compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechSynthesis.json). |
| IndexedDB | Good fit | Version upgrades, indexes, and atomic store-spanning writes are native capabilities. Transactions must stay short; migration blocked by another tab needs UI recovery. See [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB). |
| Large random queues | Straightforward at target scale | Build/shuffle lightweight IDs and metadata, load one unit's steps at a time. Proposed algorithm is in section 7; benchmark instead of assuming a problem needs a database framework. |
| Mastery and bound chunks | Product-policy uncertainty | The specification intentionally leaves mappings open. Approve deterministic rules D1–D4, then test them as pure functions. |
| JSON recovery | Straightforward but data-critical | Validate completely before one replacement transaction; require a recoverable pre-import backup. No record-by-record destructive import. |
| Browser storage | Reliable working store, not permanent backup | Clearing site data, private sessions, quota exhaustion, and corruption can lose data. Request persistence and show approximate storage usage, but still export. See [IndexedDB characteristics](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology), [persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist), and [estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate). |
| Offline shell | Straightforward on stable secure origin | Cache only SR static assets; IndexedDB holds content. Service workers need HTTPS or a trustworthy local development origin. A cached page does not cache a remote voice. See [Using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers). |
| Android Capacitor | Likely incompatible with required speech path in ordinary WebView | Check API existence before testing speech. Browser Chrome success cannot certify a WebView app. Follow the evidence and decision in section 1. |
| Minimal native TTS bridge | Feasible API; complete background behavior needs a prototype | Android TextToSpeech can synthesize text at runtime with voice selection and completion callbacks. A simple JS-to-speak wrapper alone does not keep JS progression alive. Recommend the small native executor described in section 11. See [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech), [utterance callbacks](https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener), and [local Capacitor plugins](https://capacitorjs.com/docs/plugins/android). |
| Timers while hidden/locked | Technically unreliable without device proof | Browsers throttle hidden-page timers; WebView exposes lifecycle timer suspension. Do not use silent audio or frequent timers as a reliability claim. See [Chrome timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/) and [WebView pauseTimers](https://developer.android.com/reference/android/webkit/WebView#pauseTimers()). |
| Background Runner plugin | Unsuitable for continuous Web Speech review | Runs outside the WebView, lacks its DOM/window speech environment, and is designed for finite bursts rather than a continuous session. It is not a drop-in background review controller. See [Capacitor Background Runner](https://capacitorjs.com/docs/apis/background-runner). |
| Android audio/Bluetooth | Physical-device gate | A foreground media service is a possible native component, not proof of Web Speech survival. Audio focus, calls, routing, and disconnections need explicit handling and tests. See [service types](https://developer.android.com/develop/background-work/services/fgs/service-types) and [audio focus](https://developer.android.com/media/optimize/audio-focus). |
| Drive | Feasible later, disproportionately complex | OAuth, separate platform authorization, content authority, retries and review-event reconciliation add substantial work. Manual JSON transfer is sufficient for MVP. See section 12. |

## 5. Recommended Architecture

Use native ES modules and a single page with view panels. UI code calls repository functions and controller commands; it does not directly manipulate speech queues or IndexedDB requests. Pure domain functions take injected clocks/random generators for reproducible tests. Keep abstractions small; no generic event bus, dependency injection framework, state-management library, or speculative plugin system.

Suggested future structure, created incrementally:

```text
SR/
  SPECIFICATION.md             existing, preserved
  BUILD_PLAN.md                this plan
  Joshua18.html                existing, preserved
  index.html                  semantic view panels and navigation
  styles.css                  responsive desktop/listening layout
  js/
    app.js                    wiring and feature detection
    db.js                     open/upgrade/transaction helpers
    repository.js             library/progress/preset operations
    validation.js             model and snapshot validation
    backup.js                 export, preview, replacement import
    mastery.js                step selection and presentation
    scheduler.js              due eligibility and date arithmetic
    queue.js                  selection, deduplication, ordering
    bound.js                  contiguous runs and recitation groups
    voices.js                 discovery and explicit fallback
    speech.js                 Web Speech adapter
    review.js                 one playback state machine
    settings.js               validated defaults
    ui/                       editor, mastery, review, setup, data panels
  sw.js                       scoped offline asset cache, stage 9
  manifest.webmanifest        optional installable shell, stage 9
  tests/
    runner.html               dependency-free browser test runner
    domain.test.js            scheduling/mastery/queue/bound invariants
    review.test.js            fake speech and controllable-clock tests
    persistence.test.js       real IndexedDB in isolated test database
    fixtures/                 synthetic/user-approved examples only
  poc/speech.html              stage 1 harness
  docs/TEST_RESULTS.md         gate evidence and reproduction instructions
  mobile/                     only authorized Android proof/package work
    capacitor.config.json     stable app identity and asset directory
    android/                  generated Android project; local TTS plugin/service
```

Do not create every proposed module as an empty scaffold in stage 1. Future Android tooling belongs under `mobile/`; its package/Gradle dependencies do not become desktop runtime dependencies. Native IndexedDB is sufficient: use a small local helper that resolves on transaction completion. Reconsider a thin wrapper only if measured code complexity justifies it; do not install one preemptively.

Review interface: `buildQueue(selection, mode, order, now, rng)` returns unit descriptors; `prepareUnit(unit, cards, progress, settings)` produces ordered narration actions; `start/pause/resume/skip/stop/restart` drive the controller. Desktop `speech.speak(text, voice, signal)` settles exactly once with ended/cancelled/error. Android `nativePlayback.start(plan)` executes the same prepared actions, exposes controls/status, and journals completion IDs for later JS reconciliation. `repository.completeScheduledUnit(completion)` is the only review path allowed to update schedules. Focused sessions never call it. JavaScript retains selection, mastery, grouping, scheduling and IndexedDB; Kotlin/Java supplies only platform playback and interruption handling. This bounded execution split is the proposed D5 decision, not a second native application architecture.

Prefer a stable local origin for personal use, served by an available static-file tool without a persistent application backend. Later approved static hosting is also possible, but origin changes require export/import: IndexedDB belongs to an origin, not to the Git directory or URL path. Do not rely on double-clicked `file://` pages for ES modules, durable application storage identity, or offline installation. The existing public site is not an implied deployment request. Never commit personal database exports, tokens, or real library content into this public repository.

## 6. Data Model and Persistence

### Proposed version 1 records

Use generated stable string IDs, integer zero-based positions, UTC epoch milliseconds internally, and plain text. Array order and positions must agree; reorder operations normalize positions to 0…n−1 in a transaction. These are design proposals, not changes to the illustrative specification JSON.

| Store / key | Fields | Indexes and purpose |
|---|---|---|
| `series` / `id` | `name`, `bound`, `position`, optional `recitationPrompt`, `createdAt`, `updatedAt`, `revision` | `byPosition(position)` for ordered navigation |
| `flashcards` / `id` | `seriesId`, `name`, `position`, ordered `steps`, optional `recitationStepIds`, timestamps, `revision` | `bySeries(seriesId)`; `bySeriesPosition([seriesId, position])` for order and key-only scans |
| embedded step / `id` | `question`, `answer`, `position`, proposed `role: cue/bridge/target`, optional `directQuestion`, optional `recallSeconds` | No separate step store; atomically edit one card's chain |
| `progress` / `flashcardId` | integer `mastery`, nullable `lastReviewedAt`, numeric `nextDueAt`, integer `revision` | `byDue(nextDueAt)` and `byMastery(mastery)`; progress is separate from content |
| `presets` / `id` | `name`, deduplicated `seriesIds`, `cardIds`, `mode: focused/due`, `order: sequential/random`, `grouping: auto/individual/full`, timestamps | No index needed at MVP size |
| `settings` / `key` | `value`; voice descriptors, rate, recall settings, interval table, data format metadata | Key lookups; never persist browser voice objects or secrets |
| `reviewEvents` / `id` | `sessionId`, `unitId`, `completedAt`, members with card/content/progress revisions and mastery used | Unique `bySessionUnit([sessionId, unitId])`; `byCompletedAt` for recovery/audit |

Include the small scheduled-event store from stage 6, anticipating idempotent completion and later sync without building synchronization now. No focused-review records belong in this scheduling log. Sessions/cursors are in memory for desktop MVP; recover from reload by explicitly starting a fresh session. Do not imply recovery of a half-spoken syllable. Android resumable checkpoints arrive in stage 10 if that route is approved.

Represent never-reviewed or L0 always-due cards with `nextDueAt = 0`. This keeps them in the numeric due index: null is not an IndexedDB key. Convert the specification's illustrative null due dates to 0 only during an explicit validated format conversion. `lastReviewedAt = null` still identifies never-reviewed cards. Create exactly one progress record with every card; missing progress in a native-format import is an error, not a silently healed schedule.

Proposed D1 annotations default to `target` for legacy/unannotated steps so content is never silently omitted. The editor asks the author to classify cues/bridges and designate every final fact. At least one target must remain. `directQuestion` is optional authored wording for higher mastery (for example starting from Delaware); otherwise reuse the existing question. `recitationStepIds` explicitly selects the phrase answer(s), in authored step order. Never assume the last answer contains the entire passage.

### Transaction boundaries and upgrades

- Card creation writes card + progress together; deleting a card removes progress and direct preset references together. Preserve past event IDs, with deleted members treated as historical references. Deleting a series requires a visible count/confirmation and cascades its cards atomically; this confirmation is future destructive-data UX.
- A simple mastery change touches one progress record, including any recalculated next due and revision; it does not rewrite card text or a JSON file. A reorder or move updates the affected positional records atomically.
- A completed scheduled unit writes its event and all member progress in one transaction. Each member gets the same actual completion timestamp but its own mastery-derived interval. Check the unique completion key before checking expected revisions inside that transaction. On duplicate, return already-applied without advancing dates again. On conflicting revisions, leave the unit uncommitted and report it.
- A complete snapshot reads all stores under one readonly transaction after stopping playback and disabling editor saves. JSON serialization/file I/O occurs after reads finish. Import parsing/validation/preview/file backup occurs before opening the replacement transaction.
- Do not await speech, network, file dialogs, or unrelated promises inside an IndexedDB transaction. Report Saved only after `complete`; errors/abort must reject the operation and retain UI drafts. See [transaction completion](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).
- Use `onupgradeneeded` with explicit sequential version steps. Handle `blocked` by asking the user to close other SR tabs; close a connection on `versionchange`. Never delete the database to resolve an upgrade error. Test old-version fixtures before release; take a backup before the first upgrade once backups exist.
- Prevent simultaneous playback/writes in multiple tabs with a same-origin Web Lock where supported in the target Chrome; show a read-only/second-tab notice. Revision checks still protect writes. Do not hold a database transaction for the lifetime of that lock or a review session. See [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

No schema can guarantee survival of cleared browser storage or disk failure. Catch quota/open failures, retain unsaved text, offer export of readable data, and preserve the previous database on failed import. Storage persistence requests are advisory, not a backup strategy.

## 7. Speech and Review Engine

### Proposed mastery and scheduling policy (D1–D4)

Use three presentation bands rather than eleven independently customized layouts. Every level still has its own interval. D1 and D2 must be approved before shipping these policies.

| Level | Due interval after completion | Individual-card presentation | Automatic bound grouping ceiling |
|---|---|---|---|
| 0 | Every new session | All authored steps | 1 card |
| 1 | 1 day | All authored steps | 1 card |
| 2 | 2 days | All authored steps | 1 card |
| 3 | 4 days | All authored steps | 1 card |
| 4 | 7 days | Bridge and target steps | 2 adjacent cards |
| 5 | 14 days | Bridge and target steps | 2 adjacent cards |
| 6 | 21 days | Bridge and target steps | 2 adjacent cards |
| 7 | 30 days | Target steps, using authored direct question when present | 4 adjacent cards |
| 8 | 42 days | Target steps, using authored direct question when present | 4 adjacent cards |
| 9 | 60 days | Target steps, using authored direct question when present | 4 adjacent cards |
| 10 | 90 days | Target steps with recall pause and spoken answers | Entire series only if every member qualifies; otherwise up to 4 |

All retained steps stay in original order; no sorting by role. A user can select full-chain practice in focused mode regardless of mastery. The banding is a proposed simplification of the specification, not a claim that its exact mapping was already specified. A card with multiple final facts has multiple targets; dropping all but the final step would be incorrect.

Recommended D4 date policy: an interval day is exactly 86,400,000 milliseconds, added to actual completion time in UTC. Due means `nextDueAt <= sessionStartedAt`. This deliberately avoids locale/DST-dependent calculations; local dates are display only. A calendar-day model is a legitimate alternative requiring approval. Long-overdue completion schedules forward from completion, not from the old due date; never repeatedly add intervals to catch up. L0 is selected once per session and remains due for a subsequent session, avoiding an infinite current-session loop.

On manual mastery change: if never reviewed, keep due now; otherwise set the next due to `lastReviewedAt + newInterval`, possibly already overdue. L0 always sets due 0. Do not change `lastReviewedAt`. Display the proposed next date before saving. Interval-setting edits apply to future scheduled completions by default, not a silent bulk rewrite; any bulk reschedule is separately previewed later. Reject nonfinite timestamps and noninteger/out-of-range mastery. Inject `now` in tests; test exact boundaries, leap days, DST, timezone display changes, clock rollback, and a 90-day L10 example. Detect large backwards clock changes and explain that due selection depends on the device clock.

Recommended D3 completion: a **whole prepared unit** completes audibly only after its final answer's `onend` on desktop or `onDone` on native Android, with the current session token. Scheduling credit requires a successful IndexedDB transaction; Android can durably journal the completion first and reconcile it when JavaScript resumes. Cancellation, Skip, missing speech callback, failure, or stopping in its final recall gap earns no credit. Completed earlier units remain credited if a later unit stops. A group is atomic: if interrupted, none of its member cards is credited. No rating is required. A stopped/restarted session never raises mastery. Playback status distinguishes spoken completion from failed schedule saving and offers a retry of the same completion ID.

### Queue construction and efficiency

1. Freeze session mode, selection, order, settings, time, and a fresh session ID at Start. Disable content/mastery/import changes during playback; retain Stop as a way to edit. Capture content/progress revisions as each unit is prepared.
2. Expand series selections through `bySeriesPosition` key cursors. Cursor index keys supply series/position and primary keys supply card IDs without cloning steps. Union explicit card IDs, deduplicate by ID, then validate missing references. Read tiny series/progress records in batches. General Review queries `byDue` up to the start timestamp; focused mode bypasses this filter entirely.
3. Generate units from eligible metadata. Unbound cards are single-card units. For bound series, split selection at every missing/noneligible position; never join cards across a gap or silently pull a not-yet-due card into General Review. See grouping below.
4. Sequential mode sorts by series position then card position. Random mode performs an in-place Fisher–Yates shuffle over the **units**, with an injectable RNG for tests. Never shuffle embedded steps or members of a bound unit. Every eligible card appears once per session. A new random run need not differ from the previous one by guarantee.
5. Keep O(n) IDs/metadata and O(u) unit descriptors in memory; shuffle is O(u), stable ordering at worst O(n log n). Do not `getAll()` full flashcards to randomize or call `sort(() => Math.random() - 0.5)`. Do not use repeated random cursor offsets, which get expensive and complicate uniqueness. A reservoir sample is only needed later for an explicit capped subset mode, not the required whole-selection review.
6. Fetch the current unit's cards only; optionally prefetch the next unit in one short read transaction. Generate utterances one at a time. A full-passage unit needs its passage text in memory, but not the whole library. Load editor lists in pages (for example 50 cards), not 10,000 step DOM rows at once.

Queue construction and shuffle are original design recommendations, to be validated at the target scale. IndexedDB cannot project arbitrary fields, so key cursors are intentional; if future search needs a denormalized summary store, add it only after measurement.

### Bound grouping and Psalm 23

After approval of D2, scan each contiguous eligible run left-to-right. If the complete selected run is the entire series, all cards are L10, and all recitation references exist, create one full-series unit. Otherwise, at each position try a four-card prefix where every member's grouping ceiling supports four and each has recitation references; if that fails, try two under the same rule, then one. This makes mixed-mastery handling deterministic and never skips a weak segment. Remainders stay in order and are not duplicated.

For a multi-card unit, prompt with the series and start/end card names, wait one proportional recall interval, and speak the concatenated explicitly designated recitation answers in sequence. A full unit uses the authored `recitationPrompt`, such as “Recite Psalm 23.” Single-card units use their ordinary mastery presentation. An explicit `individual` choice always allows weak-phrase practice; an explicit `full` choice is offered only for a complete series with valid recitation targets. In a due-only session it is disabled unless every member is due. Use focused full practice to bypass due dates without giving schedule credit.

Bound group questions/answers cannot discard unrelated target facts hidden in a multi-fact card. A card is eligible for scheduled recitation grouping only if its recitation references cover **all** of its target steps; otherwise fall back to individual review and explain why. Focused recitation may practice a subset, since it gives no scheduling credit. This prevents hearing one phrase from falsely crediting other facts in the same card.

Recall timing recommendation: normal short answers default to 4 seconds, editable per step. For grouped passage retrieval, use `max(4, wordCount × 60 / (120 × speakingRate) + 2)` seconds, with a user-adjustable reference words-per-minute and margin. This is a starting heuristic, not a measurement of TTS duration; preview the resulting pause. Speech rate 0.9 affects the proposed recall allowance but actual speech always advances on `onend`. Preserve all learner phrase wording; phrase joins insert spacing only. If long utterances fail, test sequential sentence-sized utterances without altering words, and consider the answer ended only when the last segment ends.

### Playback state and cancellation

This subsection specifies the desktop executor. Android implements equivalent action/control semantics in the native executor described in section 11, using `onDone` in place of `onend` and a completion journal while JavaScript is suspended.

Maintain one controller with states `idle`, `loading`, `speaking-question`, `recalling`, `speaking-answer`, `committing`, `paused`, `stopped`, `finished`, `error`. Its state includes queue/unit/action indexes, the active utterance, a monotonic session generation, an AbortController, remaining recall milliseconds, and current completion ID. UI updates are state projections, not alternate sources of truth.

Normal progression is question `onend` → cancellable recall wait → answer `onend` → next selected step → scheduled commit if eligible → next unit. Errors do not masquerade as completion. Hold a reference to the current utterance, attach handlers before calling `speak`, and settle each promise once. A watchdog may report a stalled utterance and stop for Retry; it must never guess success or mark the card reviewed. Test long passages before choosing its threshold.

Stop increments the generation, cancels speech, clears recall/watchdog timers, explicitly settles outstanding waits as cancelled, and detaches callbacks. Every continuation checks generation before speaking, changing the cursor, or submitting completion. Do not depend on `cancel()` producing any particular browser callback. Restart first awaits this teardown, then starts a fresh session/queue; it does not roll back already committed reviews. If the final answer already ended and its transaction began before Stop, finish that transaction and display its outcome; otherwise Stop prevents a new commit. Test this boundary deterministically.

Pause during recall stores remaining time based on a monotonic clock and clears the timeout; Resume waits only the remainder. Pause during loading/committing blocks the next spoken action but does not interrupt an atomic transaction. During speech, prefer native pause/resume only if stage 1 proves it reliable. D6's recommended fallback is cancel and replay the current utterance from its beginning on Resume, with UI wording that makes this behavior explicit; it still uses Web Speech. Do not seek by guessed timestamps or trust boundary events to identify an exact resumable syllable.

Skip cancels the current **unit**, gives it no credit, and advances to the next one. While paused, Skip keeps playback paused. Optional Repeat replays the current unit without double-committing it. Empty queues finish with a clear “No due cards” or “No selected cards” state. A hidden or suspended page must never fast-forward missed speech and credit it on return; resume only from a known action with the same cancellation rules.

### Voice selection and error UX

Try the saved voice descriptor (name/language/URI), then preferred `Google UK English Male`, then another `en-GB` voice, then another English voice. Show the actual voice and an explicit fallback notice. If none exists, offer the system voice with explicit user selection or disable Start with an actionable message; do not silently speak another language. Subscribe before/repeat discovery after the initial call; allow Refresh Voices and a short bounded initial wait, not an indefinite spinner. A late list update changes options but not the active voice mid-utterance.

Initial rate/pitch/volume are 0.9/1/1. A user can test a voice from Settings. Offline mode prefers a tested local English voice selected by the user; the exact Google voice is not guaranteed. A synthesis error pauses the session at the current action with Retry/Skip/Stop, and earns no credit. Display interrupted/cancelled operations differently from genuine synthesis failure. Desktop background tabs and long silent recall periods are part of G1/G9; no claim of uninterrupted narration after desktop system sleep.

## 8. Detailed Numbered Implementation Stages

All stages below are **future authorized work**. Each delivers a working increment or a reproducible feasibility result. Keep the last passing build available while the next stage is incomplete. Record commands, device/browser versions, results, failures and decisions in `SR/docs/TEST_RESULTS.md`; do not replace evidence with a checkmark inferred from source inspection.

### Stage 1 — Desktop narration proof and controllable loop

**A. Objective:** prove the core listening experience and control semantics before building editors or persistence.

**B. Dependencies:** explicit implementation authorization; resolution of D6 if exact native pause is unreliable.

**C. Implementation work:** create `poc/speech.html`, `voices.js`, `speech.js`, a minimal `review.js`, and the browser test runner. Use a small in-memory fixture with three cards and different step counts. Implement visible voice inventory, preferred selection/fallback, Start, Pause, Resume, Stop, Skip and Restart, event-based sequencing, cancellable recall waits, generation tokens, and diagnostic event timestamps. Keep the existing HTML unchanged. Draft the Android action-plan contract without implementing a bridge.

**D. Testing:** automated fake-speech tests for end/error/no-event, late callbacks, repeated Start, Stop during every phase, pause during recall, and 20 rapid stop/restart cycles. Manually listen in Windows Chrome with the preferred voice and a local English fallback. Run 30 minutes with multiple cards, background the tab, exercise controls, and disconnect networking for the local-voice test. Compare event log order with audible output.

**E. Acceptance:** G1 passes: no overlap or skipped actions, one initial gesture suffices for progression, cancellation settles pending work, Stop prevents further narration, and selected/fallback voice is visible. An absent preferred voice is acceptable with an explicit working English fallback; an untested voice is not certified.

**F. Complexity:** medium; API use is small, but asynchronous controls and platform speech quirks are meaningful risks.

**G. Deliverable:** a repeatable desktop narration harness and measured support record, not an MVP.

### Stage 2 — Physical Android feasibility and minimal native route

**A. Objective:** prove pocket/locked-screen feasibility before investing in the library UI. Bound this investigation to approximately two focused working days initially; a failure then becomes a decision, not months of speculative work.

**B. Dependencies:** stage 1; physical Android phone and Bluetooth headset; future authorization to implement the prototype and install development tooling. The current clarification permits planning only. D5 defines the proposed native execution boundary.

**C. Implementation work:** in a later authorized session, guide Android Studio setup and create a minimal Capacitor harness under `mobile/`. Record API availability in Chrome and WebView separately. If Web Speech is unavailable, add one local plugin and a foreground service using platform TextToSpeech, a JS-prepared action plan, native recall waits, generation-based cancellation, and a small completion journal. Do not migrate authoring or scheduling logic. Add notification Stop/Pause/Resume and prove the executor continues when the WebView is inactive. Use no third-party TTS/background plugin unless a demonstrably smaller maintained option passes the same contract.

**D. Testing:** native fake-callback tests plus the physical matrix in section 11: foreground, home/background, screen lock, airplane mode with Bluetooth re-enabled, battery saver, long recall pauses, calls, headset disconnection/reconnection, and repeated sessions. At least two 30-minute locked-screen runs, including one offline, must start and finish without per-question interaction. Deliberately suspend/detach the JS UI during playback; verify subsequent questions start and completions can be reconciled.

**E. Acceptance:** G2 passes only with a recorded working route and owner approval of any remaining execution-policy decisions. If no route works, or no physical device is available, stop for reassessment. Desktop-only continuation requires an explicit carve-out, preserving Android as unresolved. API absence alone is now a reason to test native TTS, not to abandon Android.

**F. Complexity:** high; device power management, audio focus, service lifecycle, and bridge durability must be demonstrated.

**G. Deliverable:** small installable proof APK, setup notes and a go/no-go report in the future implementation stage. The planning delivery itself contains none of these code artifacts.

### Stage 3 — Versioned persistence and safe backup foundation

**A. Objective:** establish reliable storage and recovery before storing valuable learner content.

**B. Dependencies:** stage 2 gate passes or desktop-only exception is explicitly approved.

**C. Implementation work:** create `db.js`, `repository.js`, `validation.js`, `backup.js`, and a minimal Data panel. Implement stores/indexes from section 6, schema version 1, transaction-completion promises, validated CRUD primitives, snapshot export, replacement preview, and atomic import. The test harness can insert synthetic records before editors exist. Define public backup format version 1 independently of internal IndexedDB version.

**D. Testing:** real IndexedDB tests in a separate `SRLearning-test-*` database; restart/reopen, card/progress atomicity, deliberate transaction abort, null-due conversion fixture, blocked upgrade with a second tab, unknown future format, malformed JSON, duplicate IDs, broken references, quota/write failure simulation, and export/import semantic equality. Exercise download/reselection of a backup manually.

**E. Acceptance:** G3 passes: no partial replacement after failure, data survives browser restart, import reports errors without mutation, and a complete validated snapshot restores the test library. No destructive reset used as an error remedy.

**F. Complexity:** medium; most work is validation and transaction discipline rather than algorithmic complexity.

**G. Deliverable:** working persistent data layer and safe Data/backup harness.

### Stage 4 — Desktop authoring and series management

**A. Objective:** let the owner create a personal library without editing code or JSON.

**B. Dependencies:** stage 3.

**C. Implementation work:** add `index.html`, `styles.css`, `app.js`, and editor panels. Create/rename/order/delete series, toggle binding with a clear effect preview, create/move/order/edit/delete cards, and insert/edit/delete/reorder arbitrary steps. Use explicit Save/Cancel and unsaved-change protection. Add keyboard-accessible Move Up/Down rather than requiring drag-and-drop. Display save failures without losing draft text. Expose backup from the main UI.

**D. Testing:** full authoring workflow with 1, 6, 10 and 100 steps; move first/last steps; cross-series moves; cancel edits; delete with dependent preset/progress cleanup; empty/invalid form input; text containing HTML characters must render as text. Close/reopen Chrome and export/restore the edited library. Run G3 regression tests.

**E. Acceptance:** G4 passes: exact authored wording and order persist, all operations work by keyboard, no mandatory fact/subject fields appear, and complete backups are available before serious content entry.

**F. Complexity:** medium; data integrity and simple usable editing matter more than visual polish.

**G. Deliverable:** a usable authoring application, still not the complete studying MVP.

### Stage 5 — Knowledge Mastery and scheduling policy

**A. Objective:** resolve and encode deterministic presentation/due rules before connecting review writes.

**B. Dependencies:** stage 4; approval of D1, D3 and D4.

**C. Implementation work:** create `mastery.js`, `scheduler.js`, and the Knowledge Mastery panel. Implement 0–10 controls, role/direct-question/recitation annotations, full-chain and effective-playback previews, default intervals and validated settings. A mastery edit writes one progress record and shows the resulting due date. Do not auto-increase mastery. Stage 7 will consume the recitation annotations.

**D. Testing:** every level in the section 7 table; multiple target facts; all-target legacy cards; empty target rejection; direct-question fallback; unchanged source-step order; never-reviewed/mastery-down/mastery-up cases; due boundary, overdue and L0 cases; 90-day L10; UTC arithmetic across DST/leap dates; invalid mastery and date input. Re-run persistence tests.

**E. Acceptance:** G5 passes with approved policy fixtures and visible preview matching expected questions/answers at each band. Dates and mastery survive backup round-trip; changing one mastery record does not rewrite content.

**F. Complexity:** medium; owner policy is the main uncertainty, with date and migration edge cases.

**G. Deliverable:** functioning mastery management and testable playback/due previews.

### Stage 6 — Sequential, randomized, and scheduled desktop review

**A. Objective:** connect authored content to hands-free study and safe schedule completion.

**B. Dependencies:** stage 5 and G1 controller regression pass.

**C. Implementation work:** add `queue.js`, the Review panel, indexed due selection, lightweight ID queues, sequential ordering, Fisher–Yates randomization, lazy unit loading, and `completeScheduledUnit`. Initially bound cards remain individual units, with their internal step order preserved. Store scheduled events atomically with progress. Add visible current card/step/state and errors, and protect running sessions from edits/import. Implement same-origin single-playback locking.

**D. Testing:** seeded queue invariants, no duplicate cards, due-only selection, no inclusion of future cards, finite L0 sessions, no schedule write before final answer completion, Stop/Skip/error paths, duplicate completion IDs, transaction failure/retry, second-tab rejection, and rapid control sequences. Manually author several cards and listen from first to last and in randomized order. Re-run G3–G5 tests.

**E. Acceptance:** G6 passes: automatic multi-card review works and only completed scheduled units update due dates once; mastery is unchanged. A schedule-save failure is visible and recoverable. Refresh never claims an interrupted unit completed.

**F. Complexity:** high; speech callbacks and persistence must agree at cancellation/commit boundaries.

**G. Deliverable:** first basic personal study app. It is an interim increment, not the complete desktop MVP because grouping, focused presets and offline qualification remain.

### Stage 7 — Bound grouping and full-passage practice

**A. Objective:** support the Psalm 23 learning progression without breaking general review eligibility.

**B. Dependencies:** stage 6; D2 approval.

**C. Implementation work:** add `bound.js`, recitation-reference validation and authoring UI, automatic/individual/full grouping controls, contiguous-run generation, minimum-member mastery handling, group prompt generation, proportional recall pauses, and atomic group completion. Use generic series/card fields, never hardcode Psalm-specific logic.

**D. Testing:** 12-location farmhouse fixture, every grouping band, mixed levels, odd remainders, missing middle selections, a future-due gap, all-L10 complete series, missing recitation references and uncovered target facts. Verify randomized blocks retain member order. Interrupt during the final group answer: no member receives completion. Manually listen to phrase, adjacent-group and full-passage modes.

**E. Acceptance:** G7 passes: every eligible selected card is covered exactly once, groups are contiguous, no ineligible member receives credit, long pauses are adjustable, and passage wording is unchanged. Partial full-series selection cannot masquerade as full recitation.

**F. Complexity:** medium; grouping itself is small, but edge conditions have scheduling consequences.

**G. Deliverable:** dependable bound-sequence and passage practice.

### Stage 8 — Focused review, selections, and saved presets

**A. Objective:** enable reusable targeted practice independent of the due schedule.

**B. Dependencies:** stage 7.

**C. Implementation work:** add Review Setup and preset CRUD, selected-series/card union with ID deduplication, mode/order/grouping choices, selection preview/count, and focused full-chain override. Persist explicit selection references; whole-series selections expand at session start so newly added cards are included. Deleting a selection reference updates presets transparently with a visible notice. Default a new manually configured practice preset to focused and visibly label due-only presets.

**D. Testing:** overlaps between selected series and individual cards, multiple series, empty presets, renamed/moved/deleted cards, newly added series members, focus on overdue and future cards, and no progress/event-store writes in focused mode. Compare serialized progress and scheduling history before and after complete, interrupted, skipped, restarted and repeated focused sessions. Re-run general-review tests.

**E. Acceptance:** G8 passes: focused selection plays every selected item exactly once irrespective of due date; schedules/mastery/history are identical afterward; presets survive restart/import; due-only presets still apply due filtering.

**F. Complexity:** medium; the critical risk is accidentally reusing scheduled-write behavior.

**G. Deliverable:** full desktop study modes and reusable presets, ready for release qualification.

### Stage 9 — Offline operation, recovery, scale, and desktop MVP release gate

**A. Objective:** make the complete desktop application safe and practical for daily use.

**B. Dependencies:** stage 8.

**C. Implementation work:** add SR-scoped static-asset caching and update UX, storage status/persistence request, tested offline voice selection, paginated library lists, backup reminders based on successful export, final keyboard/focus/error polish, and a short operating guide. Do not cache personal snapshots in the service worker. Delay activating a new shell while playback or unsaved edits are active. Improve only measured bottlenecks.

**D. Testing:** all desktop scenarios in section 10; offline cold launch after a successful initial cache; local-voice speech with networking disabled; shell update without mid-session reload; 1,000 × 10 scale test; one-hour continuous narration; backup/replace/restore and invalid import; two-tab upgrade; browser restart; rendered text injection tests and keyboard navigation.

**E. Acceptance:** G9 passes every applicable desktop test, meets measured scale budgets or records owner-accepted revised budgets, has no unresolved data-loss/focused-write/cancellation defects, and offers complete recovery without Google. An online-only voice cannot satisfy offline audio acceptance.

**F. Complexity:** medium; release qualification may expose device/browser-specific issues.

**G. Deliverable:** **first complete usable desktop MVP**. Stop optional expansion long enough for the owner to use it and evaluate the interface.

### Stage 10 — Android listening client and guided APK installation

**A. Objective:** turn the proven stage 2 route into a maintainable personal listening app.

**B. Dependencies:** stage 9; stage 2 Android pass; D5/D6 approval and separate implementation authorization. A desktop-only exception does not authorize claiming mobile completion.

**C. Implementation work:** package shared static assets and data/domain modules in Capacitor; finish the small native plugin/service if required; add bounded plan handoff, native status/completion journal, JS reconciliation, notification controls, audio interruption behavior, device-local voice settings, import/export via Android file picker, and checkpoint/resume UX. Preserve IndexedDB as library authority. Add a read-only mobile mastery view. Write the step-by-step build/install/update guide in section 11 and keep app ID/signing identity stable.

**D. Testing:** native executor unit tests plus bridge contract tests; desktop/native action-trace equivalence; journal replay after WebView/process loss; duplicate events; stale revisions; focused write isolation; manual transfer both directions; offline launch, Bluetooth and one-hour locked walk on the actual phone. Install an APK update over the prior version and verify data remains. Force-stop must not silently restart playback or credit partial units.

**E. Acceptance:** G10 passes; owner can rebuild/install using the written guide, author on desktop, transfer, start once, lock the phone, and hear automatic progression offline. Reopening reconciles completions once, preserves mastery, and offers safe continuation after interruption. No Play Store account required.

**F. Complexity:** high; remaining risks are native service lifecycle, battery use, recovery and cross-platform persistence rather than UI reuse.

**G. Deliverable:** personally installable Android listening APK and reproducible owner setup/update instructions.

### Stage 11 — Optional manual Google Drive sync and restore

**A. Objective:** remove repetitive manual transfers without sacrificing local operation or edit authority.

**B. Dependencies:** stage 10, owner opt-in to Drive/OAuth configuration, D7 approval. This stage can be omitted indefinitely.

**C. Implementation work:** add isolated `sync/` modules and platform authorization adapters; explicit Connect/Disconnect/Sync/Restore; desktop-authoritative immutable snapshots; Android completion uploads; event acknowledgements/deduplication; stale-base validation; dated backups and a recoverable manifest. Use section 12's single-writer protocol. Keep tokens out of snapshots/logs and native long-lived credentials in platform-secure storage if needed.

**D. Testing:** pure protocol tests and a separate test Drive dataset: offline edits, two devices, repeated upload, timeout after server success, stale content/mastery, deleted card, wrong account, revoked/expired authorization, out-of-order completion events, interrupted manifest update, corrupt latest snapshot, and restore from an older valid version. Verify local workflows still work disconnected.

**E. Acceptance:** G11 passes with no silent content overwrite, no duplicate review credit, clear recoverable conflicts, validated restore on either platform, and multiple preserved dated snapshots. Sync and Restore remain distinct commands.

**F. Complexity:** high; OAuth and distributed-state recovery cost more than simple file upload.

**G. Deliverable:** optional account-connected manual sync and independent restore, with JSON-only use unchanged.

## 9. Stage-by-Stage Testing and Acceptance Gates

The A–G definitions above are the executable stage scope. This matrix identifies the evidence required to close each gate. Record PASS/FAIL/BLOCKED with date, exact revision, environment, reproduction steps, measured results and any owner-approved exceptions. **No gate has been executed by this planning task.**

| Gate | Automated evidence | Integration/manual evidence | Stop condition |
|---|---|---|---|
| G1 | Fake speech/timers, generation races, pause/skip/restart | Audible Windows Chrome 30-minute run, two voice paths | Overlap, stall, lost controls, or silent voice failure |
| G2 | Native action runner/bridge cancellation contract | Phone API inventory; two locked 30-minute runs; offline/Bluetooth/calls | WebView-dependent advancement, missing voice, unsafe interruption or no device |
| G3 | Validation, transaction abort and round-trip fixtures | Reopen browser; real IndexedDB; file recovery; blocked upgrade | Any partial import or unrecoverable previous data |
| G4 | CRUD/order/cascade invariants | Authoring workflow and keyboard use | Lost wording/order or failed persistence |
| G5 | All 11 levels, target coverage and fixed-clock cases | Mastery UI preview and saved due display | Unapproved mapping, automatic mastery change or wrong due date |
| G6 | Queue and exactly-once transaction tests | Authored sequential/random study; two tabs | Credit on partial/skip/error or not-due inclusion |
| G7 | Bound contiguity/coverage/property fixtures | Farmhouse journey at phrase/chunk/passage levels | Reordered phrase, crossed gap or false target credit |
| G8 | Full progress/history before/after equality | Create/use/reopen overlapping presets | Any focused schedule/history/mastery mutation |
| G9 | Full desktop regression and scale measurements | Offline cold start; recovery; one-hour speech soak | Any missing desktop workflow or online-only offline claim |
| G10 | JS/native trace equivalence and journal replay | Real locked walk, interruptions, APK update and owner setup | JS sleep halts progression or duplicate/lost committed event |
| G11 | Protocol retry/conflict/restore tests | Separate Drive test account/data and both devices | Lost content, repeated credit or corrupted last good backup |

Start with a dependency-free browser assertion runner for pure modules and fakes; use real IndexedDB for storage integration. If later unattended browser automation materially helps, propose one development-only tool after measuring need, not a framework migration. Synthetic speech tests cannot validate sound quality, Bluetooth, background execution or installed voices. Emulators cannot satisfy physical-phone gates.

Suggested performance budgets on the owner's recorded desktop hardware: library initial view and 1,000-card queue each under 1 second after database open; typical card save under 250 ms; 10,000-step export/restore under 5 seconds, excluding file dialogs; controls acknowledged within 250 ms and audible Stop within roughly 500 ms. Measure at least five runs and report median and slowest. These are proposed usability budgets, not measured promises. During a one-hour soak, record utterance count, stalls, timer drift and memory before/after; there must be no growth proportional to completed utterances or overlapping audio. Log metadata, not private card text, by default.

## 10. End-to-End Test Scenarios

Use a disposable database/origin and a known valid backup. Never clear the owner's live library for a test. Manual Scripture fixtures require owner-provided/approved phrase text; compare it with the chosen KJV source and flag discrepancies without silently rewriting mnemonic or Scripture wording.

1. **Flashcard authoring (G4/G9):** create unbound Presidents, create “16th President,” enter its six specified steps, insert a seventh temporary step, edit, move and delete it, save, close every Chrome window, reopen the same origin/profile. Exact text/order, series/card IDs and progress must persist. Verify 1861 remains the office year, not 1860. Repeat using a 100-step card to avoid a hidden fixed-step limit.
2. **Knowledge Mastery (G5/G9):** classify cues/bridges/targets on a multi-fact card, choose L2, L5 and L8, and inspect/hear the expected presentation. Every target survives at L8; no authored step is deleted. At fixed completion time T, verify due T+2, T+14 and T+42 days respectively; L10 is T+90. Manual changes follow D4 and playing does not raise mastery.
3. **Sequential review (G6/G9):** choose a due-only series containing three due cards with varied step counts; play from first to last. Each selected question finishes, a recall pause occurs, its answer finishes, and the next step/card follows with no extra gesture. Verify stored completion/due changes only after full units.
4. **Random review (G6–G9):** choose at least two series including unbound cards and a bound run. With a seeded RNG, assert exact unit order; over multiple seeds assert membership/uniqueness/adjacency rather than demanding any particular perceived randomness. Step order and bound member order never change. Future-due cards remain excluded in due mode.
5. **Focused review (G8/G9):** create a named preset selecting a whole series plus overlapping individual cards, including overdue and future items. Save/reopen/play/stop/restart it. All selected items are included without duplicates; every field of progress and scheduling history matches its pre-session snapshot. Overdue items remain overdue. Repeat full-passage focused practice at high mastery.
6. **General spaced repetition (G6/G9):** fix clock T; create cards due before/equal/after T, a never-reviewed card and L0. Only before/equal/new/L0 are selected. Complete one unit, skip one, stop halfway through another. Only completed units receive a single event and future due; L0 is not reinserted into the running session. Move clock forward and repeat; error and duplicate callback variants must preserve this outcome.
7. **Psalm 23 farmhouse journey (G7/G9):** create bound phrase cards in Gate → Grass → Pond → Store → Porch → Door → Kitchen → Corner → Dining Room → Bathroom → Stairs → Window order. Preserve the supplied crook/Big Macs, shoe soles, VSD, Shirley/Goodness/Mercy and other sparse imagery. Assign phrase target references explicitly. Test individual phrase recall (~3–5 seconds), pairs, four-card groups, and full “Recite Psalm 23” with proportional pause and phrase-order self-check. Make Pond weak or not due and verify no group crosses the resulting eligibility boundary. Stop in a group and confirm none of its members is credited.
8. **Data recovery (G3/G9):** export the whole fixture library; validate/reselect the file; replace local test data with different content; import the backup after preview and safety export. Compare cards/steps/order/roles, series binding, mastery, last/next dates, presets, settings and scheduled events semantically. Then reject truncated JSON, future versions, duplicate IDs, dangling references, invalid mastery and bad positions without changing a byte of logical live data. Abort a replacement transaction and reopen to confirm the prior state survives.
9. **Scale (G9):** generate at least 1,000 cards × 10 steps across mixed bound/unbound series with varied mastery and due dates. Measure the section 9 budgets; inspect database access to show queue creation does not clone all step payloads. Run all 10,000 steps with accelerated fake speech and at least one hour with real narration, including controls. Ensure only one utterance is submitted at a time and completed utterances/listeners are released.
10. **Offline and browser lifecycle (G9):** after initial installation/cache, close the browser, disable networking, reopen the stable origin and review with a verified local voice. Edit/save/export and restart offline. Test denied persistence, quota simulation, missing preferred voice, a new service-worker version and a second tab. Cache updates must not overwrite IndexedDB or force a mid-session reload.
11. **Android (G2/G10):** transfer desktop data by JSON, select preset/General Review, start, lock, walk with Bluetooth, continue offline through long pauses, receive a call, disconnect/reconnect earbuds, reopen and reconcile events. Check native execution while JS is inactive. Kill/relaunch the process, reconcile completed units once and resume an interrupted unit only by explicit action. Install an update, verify data, then test recovery from deliberate loss using a test installation. No authoring or mastery editing is required on Android.
12. **Optional Drive (G11):** desktop exports authoritative content, phone downloads then completes scheduled units offline, desktop edits mastery before phone uploads, and both Sync. The stale event is surfaced under the approved conflict policy without overwriting mastery. Repeat uploads and failed responses do not duplicate credit. Restore an older valid dated snapshot on each device after corrupting a disposable latest snapshot.

## 11. Android Feasibility and Migration Strategy

### Recommended minimum native boundary

Keep the HTML/CSS panels, flashcard model, IndexedDB repositories, mastery filtering, bound grouping, queue generation, scheduling policy and JSON format in JavaScript. Desktop continues to use `window.speechSynthesis`. Android uses platform **TextToSpeech dynamically from text** through one small local Capacitor plugin if Web Speech is unavailable. No audio files, cloud speech service, native database replacement or native authoring UI are needed.

A plugin that only exposes `speak(text)` and forwards completion to JavaScript is the smallest code sample, but it leaves recall timers and next-question dispatch in a potentially suspended WebView. It is not the recommended locked-screen architecture. A foreground service also does not, by itself, make the WebView continuously execute. The proposed D5 boundary is a slightly larger but bounded **native action executor** controlled by the JavaScript review engine:

1. JavaScript builds and validates a finite session plan containing immutable unit IDs, card revisions, mode, and ordered `speak`/`wait`/`unit-complete` actions. The shared engine alone decides what is due, what text is retained, grouping, order and pause length. For Android, prepare and hand off the entire selected session before Start completes, in batches if needed; unlike the desktop lazy path, it cannot rely on fetching the next unit through sleeping JS. Display preparation progress and allow cancellation; never silently truncate selected cards.
2. The native service stores this temporary plan in app-private storage and interprets it sequentially, loading one unit at a time. This is disposable playback state, not another flashcard database. The plugin contract is `prepare/start`, `pause`, `resume`, `skipUnit`, `stop`, `getStatus`, `getUnacknowledgedCompletions`, and `acknowledgeCompletions`. Events update the UI when it is alive; durable status does not depend on their delivery.
3. Initialize TextToSpeech asynchronously, select an installed English voice, set speech audio attributes, and check return/error codes. Split text below the runtime's input-length limit without changing its words. One active utterance ID includes session generation and action ID. Advance audible speech on `UtteranceProgressListener.onDone`; `onError` and cancellation earn no completion. Marshal callbacks onto one executor thread. The platform provides text synthesis, voice selection and an input-length limit; its completion listener distinguishes successful audible completion. See [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech) and [UtteranceProgressListener](https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener).
4. Native timers handle recall intervals and cancellation. A foreground service is not a CPU wake lock; Android Handler delays can be lengthened by deep sleep. Investigate a narrowly held partial wake lock for the active listening session, including silent recall gaps, with a timeout and release on Pause/Stop/error/finish. Use a monotonic elapsed-time clock and preserve remaining pauses, rather than accumulating timer drift. Measure battery impact; do not hold a permanent lock or use exact alarms for every question. See [Handler timing](https://developer.android.com/reference/android/os/Handler#postDelayed(java.lang.Runnable,%20long)) and [wake-lock guidance](https://developer.android.com/develop/background-work/background-tasks/awake/wakelock).
5. Start the service while the app is visible after the user's Start gesture. Declare the appropriate foreground-service type/permissions and show a persistent playback notification with working controls. Media playback is the relevant candidate type; verify applicability and restrictions against the target SDK during implementation. Android 15-targeted audio-focus requests require the app to be topmost or run a foreground service. Use media/speech audio attributes; handle focus loss and calls as interruptions. See [foreground service launch](https://developer.android.com/develop/background-work/services/fgs/launch), [service types](https://developer.android.com/develop/background-work/services/fgs/service-types), and [audio focus](https://developer.android.com/media/optimize/audio-focus).
6. Journal a scheduled unit's completion only after all its required answer audio finishes. Store session/unit IDs, completion time, content/progress revisions and library generation. JavaScript later applies the completion through the existing atomic IndexedDB function and only then acknowledges it. Replays are idempotent. Reopening must drain completions **before** building the next due queue or exporting progress. A focused session journals no scheduling completions. If journaling fails, stop and show the unrecorded unit; do not pretend it was saved.
7. On process loss, retain completed-unit journal entries and the last safe checkpoint; do not auto-resume speech unexpectedly. Offer replay from the start of the interrupted unit after a user gesture. An engine callback lost at crash time may mean one unit is repeated; conservative under-credit is safer than false credit. Imported/replaced libraries invalidate old plans via generation ID; stop and reconcile or explicitly resolve pending completions before replacement. Native code never independently computes new due dates or raises mastery.

The native executor is a necessary execution detail proposed to meet locked-screen progression, not an approved implementation yet. If the owner requires every timed action to execute in JavaScript itself, stage 2 must prove that stricter approach; current evidence does not justify promising it. Do not duplicate queue/mastery/scheduling algorithms in Kotlin to avoid this discussion.

Use installed non-network voices where available and verify offline synthesis. Android exposes whether a voice requires network connectivity, but the voice must also be installed and exercised offline. Voice names and numeric rate effects need not match the desktop Google voice. See [Android Voice](https://developer.android.com/reference/android/speech/tts/Voice#isNetworkConnectionRequired()). Prefer the existing platform engine and one local plugin/service over adopting an additional synthesis engine or a collection of background plugins.

### Required physical-device evidence

Record phone model, Android version, WebView/Chrome versions, APK target SDK, TTS engine/version/voice, installed language data, headset model, power settings and battery consumption. Run unlocked first, then Home, then screen lock. Test short 4-second gaps and 60–120-second passage gaps so uninterrupted audio cannot hide a broken timer. Test online and airplane mode with Bluetooth re-enabled; repeat with battery saver and without a USB/debugger connection that could keep the device awake.

During calls or loss of audio focus, pause and preserve position; on headset disconnect, prefer stopping/pausing before speech escapes through the phone speaker. Resume by an explicit control after a disruptive interruption. A browser-only route may not expose reliable routing/focus signals; that limitation must be disclosed if considered. Basic Bluetooth **output** is required; headset media-button mapping is optional unless implemented and tested. A native media session can be added if needed for reliable notification/headset controls, without importing an unrelated media playback framework solely for TTS.

G2 requires two successful 30-minute locked sessions, at least one offline, plus interruption tests. G10 repeats these and a one-hour walk on the final packaged app. Process force-stop is a recovery scenario, not a promise of continued playback after the OS/user kills the application. Device-specific battery exemptions may be documented only if actually required and acceptable to the owner; no universal reliability claim based on a single emulator or connected debugger.

### Owner-guided build/install path (to finalize against selected versions)

Stage 2 should walk the owner through these steps one at a time, recording exact versions and successful commands in a future `SR/docs/ANDROID_SETUP.md`. Do not install anything during this planning task.

1. Install Android Studio and its setup-wizard SDK components on Windows. Use its supported bundled JDK; select the Android SDK/platform and build tools required by the chosen stable Capacitor version. Install a compatible Node LTS only for Capacitor tooling. Pin versions and keep the lockfile inside the mobile project.
2. Open the repository and the generated `SR/mobile/android` project in Android Studio. Let Gradle sync; show how to select the SDK path and resolve a missing SDK component. Do not ask the owner to edit unfamiliar native code to build a supplied project.
3. Enable Developer options and USB debugging on the phone, connect a data-capable USB cable, accept that computer's debugging authorization, and select the device in Android Studio. Follow the official [physical-device setup](https://developer.android.com/studio/run/device) and [Capacitor Android guide](https://capacitorjs.com/docs/android).
4. Run the debug app, choose/install an offline English TTS voice if needed, and perform the speech/lock test. Explain where Android's notification and battery settings are on that actual device. A native permission/setup screen must explain only permissions the feature requires; microphone access is unnecessary.
5. For normal personal use, build a signed APK with a stable application ID and locally protected signing key. Guide key creation and an off-device backup of the key/password; do not commit signing secrets. Install by Android Studio/ADB or by opening the APK and enabling installation from that specific source. No Play Store enrollment or publication is needed. See [Android app signing](https://developer.android.com/studio/publish/app-signing).
6. Export a JSON backup before updates. Rebuild with the same app ID/signing key and install over the existing app; do not uninstall as an update procedure. Verify IndexedDB survives the update and explain that uninstalling/clearing app storage removes local data. Keep a reproducible asset-copy/Capacitor-sync/build sequence in the guide.
7. Transfer the desktop JSON via a local file, preview/import on the phone, start a review and lock the screen. Document exporting results/backups and the single-writer restrictions below until Drive sync exists.

## 12. JSON Backup and Optional Google Drive Sync

### Complete versioned snapshot and recovery

Proposed envelope: `format: "sr-learning-backup"`, `formatVersion`, `schemaVersion`, `appVersion`, `exportedAt` (UTC ISO text), `libraryId`, `libraryGeneration`, and complete `series`, `flashcards`, `progress`, `presets`, `settings`, `reviewEvents`. Export times do not rewrite record times. Internal database version and portable-format version have separate purposes. A checksum can detect accidental damage but is optional and does not establish trust. Do not serialize executable functions, HTML templates, active utterances, transient locks, OAuth tokens, signing keys or in-flight timers.

Validation is explicit and recursive: expected object/array/scalar types, finite bounded numbers, nonempty stable IDs and unique IDs in their scope, valid timestamps, mastery integers 0–10, exact series/card/progress references, step IDs/positions/order, positive usable text, valid recitation references, enum values, preset deduplication and supported settings. Require all live cards to have one progress record. Historical review events may reference a deleted card, clearly identified as historical. Reject unsafe object keys and render imported strings with text content, never `innerHTML`. Preserve whitespace and wording; validation should not silently rewrite mnemonic prose.

Workflow: stop playback and reconcile pending mobile completions → select JSON → parse and validate without writes → show counts/version/replace scope → export the current readable library → verify that backup can be reselected and validated (a browser download click cannot prove the file was saved) → explicit Replace confirmation → one transaction clears/repopulates the application stores → wait for commit → show counts and reopen validation. Reject unknown future versions; migrate known older formats in memory and preview the conversion. Do not treat arbitrary JSON matching a few field names as a known legacy format.

An import error, cancellation or transaction abort leaves the old library intact. Parsing/validation is done outside transactions. Start with whole-file JSON at the specified scale; measure memory for larger files and show a size warning/confirmation or clear rejection before any mutation, never silently truncate. If a database will not open, provide a recovery screen capable of importing a separately validated backup; if old data is unreadable, explain why a fresh safety export is impossible and require explicit acknowledgement before destructive recovery. Test this exceptional route with disposable data. Keep multiple dated off-device JSON files because snapshots within the same browser are lost with that browser's storage.

### Manual desktop/phone transfer before sync

A complete backup is a replacement, not an automatic merge. Desktop is the content/mastery authority. Export to Android before a walking session. If returning a whole phone snapshot to desktop, first export the current desktop state and verify no desktop authoring/mastery changes occurred since that transfer; otherwise stop and retain both backups. Do not overwrite newer desktop content to recover phone review dates. Stage 10 may offer an explicit review-event-only file transfer using the same idempotent reconciliation contract; it is a small optional convenience, not a prerequisite for the desktop MVP. Clearly distinguish full restoration from importing review completions.

Portable backups retain preferred settings, but available voices/device identity are environment-specific. Preserve source preferences for restoration while visibly resolving unavailable voices on the destination; do not clone a device's installation ID to another device. Generate a fresh installation ID locally. A restored library retains stable content IDs, with a new active generation to reject stale in-flight sessions.

### Optional Drive design proposal (D7)

Use an application-owned OAuth integration, never the ChatGPT Drive connector. Google's `drive.appdata` scope provides a private application-data area; it is distinct from the user's visible Drive folders. If browsing backups directly in Drive is desired, evaluate `drive.file` and an app-created folder instead. Recommend appData plus explicit local exports for simplicity. See [Drive application data](https://developers.google.com/workspace/drive/api/guides/appdata).

A static desktop app can use Google Identity Services' user-driven token model for manual operations; no client secret belongs in a web bundle. Android needs an appropriate native authorization flow/configuration, not a Google login inside an embedded WebView. Tokens can expire/revoke; reconnect must be recoverable. Keep desktop short-lived tokens in memory and use platform-protected credential storage where native persistence is needed. OAuth client IDs, authorized origins/redirects, consent-screen configuration, test/publishing status and platform identifiers require setup; recheck current requirements during stage 11. See [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) and [installed-app authorization](https://developers.google.com/identity/protocols/oauth2/native-app).

Proposed protocol, deliberately single-writer rather than real-time collaboration:

- Designate one desktop installation as content/mastery/preset writer. Store immutable, dated content snapshots with a monotonically increasing content generation and parent generation. Upload/validate a new snapshot before updating a small manifest pointer; retain the prior known-good pointer and at least several dated backups. A second writer or mismatched remote head causes a visible conflict, not blind replacement. Re-read the head before promotion; if conditional updates cannot safely be implemented with the chosen API, enforce single-writer operation and refuse ambiguous promotion rather than claiming compare-and-swap protection.
- Android downloads desktop content only after preserving pending review events. It uploads immutable scheduled-completion batches keyed by device/session/unit IDs and base content/mastery revisions. Focused sessions generate no such events. Retry after an uncertain network result by locating/deduplicating the same logical ID; Drive filenames alone are not a uniqueness constraint.
- Desktop validates and deduplicates events, checks referenced IDs and revisions, and applies only compatible events atomically. Recommend showing stale-content/mastery events for explicit reconciliation instead of applying a guess. Valid older completion times never move `lastReviewedAt` backwards. Preserve manual mastery; compute future due using the approved policy. Retain acknowledged IDs so re-imported batches cannot reapply credit.
- Sync uploads/downloads changes with those authority rules. Restore instead selects a dated complete snapshot, validates and previews replacement, and takes a current local backup. Restoring the desktop explicitly re-establishes its writer identity; restoring Android also preserves or resolves pending unsynced completions. A corrupt latest snapshot must not overwrite earlier valid ones or force deletion of local good data.
- Show last successful sync, pending completions, chosen account, conflicts and offline state. Network/auth failure leaves local study usable. Do not automatically prune the last known-good backup. Retention/pruning is separate from successful upload.

This is substantially more complex than file upload, which is why it follows both usable desktop and proven Android. Do not build a server solely to simplify optional OAuth or conflict handling.

## 13. Risks and Decision Register

The following are product decisions needing owner approval before their dependent stage; they are not questions blocking publication of this plan. Native TTS **investigation and recommendation is already authorized** by the clarification and need not be requested again. General implementation authorization remains outstanding.

| ID / issue | Alternatives | Recommendation and reason | Blocks |
|---|---|---|---|
| D1 — Mastery-dependent step selection | Infer a suffix from position; author 11 masks; annotate cue/bridge/target with optional direct wording | Three bands with explicit targets; preserves all facts and original step order with modest authoring effort | Stage 5 presentation/editor policy; not stage 1 |
| D2 — Bound grouping and gaps | Fixed groups; minimum-member progression; include not-due context and track separate credit | Section 7's 1/2/4/full policy, contiguous selected/due runs, all-target coverage, individual override; easiest to explain/test without hidden schedule effects | Stage 7 |
| D3 — Review completion credit | Credit every finished step/card inside a group; only whole session; complete unit | Credit only whole completed units, retain earlier complete units, skip/interruption earns none; clear atomic behavior and no rating | Stage 5 policy and stage 6 writes |
| D4 — Dates and manual mastery changes | Local calendar days; fixed elapsed days; review from old due date or actual completion | UTC elapsed days from completion; mastery edits recalculate from last review, unreviewed stays due; deterministic across devices | Stage 5 |
| D5 — Locked Android execution boundary | JS-driven per-utterance bridge; native executor of JS-prepared actions; fully native rewrite | Small plugin + foreground service executing prepared actions and journaling completion; shared JS rules/IndexedDB remain authoritative, WebView suspension no longer gates next question | Native part of stage 2 and stage 10; broader native TTS recommendation already allowed |
| D6 — Pause/Resume semantics | Exact mid-utterance pause where reliable; restart current utterance consistently | Preserve recall remainder; use restart-current-utterance when native/browser continuation is unavailable, with clear UX; avoids unreliable offsets and missing words | Stage 1 control acceptance if fallback needed; stage 10 |
| D7 — Drive scope/conflicts | Full snapshot overwrite; single desktop writer with review events; bidirectional record merges | Single desktop writer, immutable snapshots/events, explicit stale-event conflicts; smallest protocol protecting content/mastery | Optional stage 11 only |
| D8 — Failed/unavailable Android early test | Stop all work; expand mobile investigation; authorize desktop-only milestone | Stop at G2 with evidence, then offer a bounded desktop-only carve-out if the owner wants immediate utility; does not waive locked-screen requirement | Stage 3 only if G2 cannot pass |

Routine implementation recommendations do not need separate owner decisions: plain ES modules, native IndexedDB, explicit Save, keyboard reorder buttons, stable IDs, numeric positions, Fisher–Yates, scoped service-worker cache and dependency-free initial tests.

| Risk | Mitigation / evidence required |
|---|---|
| Android kills/suspends components or stalls silent gaps | Native action execution, lifecycle-aware service, tightly scoped wake lock if needed, physical offline/locked tests; no universal success claim |
| Preferred Google voice unavailable/offline | Visible platform-specific voice choice, tested offline voice, no identical-voice promise |
| Cancel/pause races and missing callbacks | One executor/generation, settle-once promises, fault-injection tests, no credit on uncertainty |
| Browser eviction, uninstall or corrupted import | Validated off-device snapshots, atomic writes, restore rehearsal; persistent storage request is supplemental |
| Simplified mastery drops learned facts | Explicit multiple target steps, preview, no implicit final-step-only rule |
| Grouping over-credits non-due or partially recalled content | Eligible contiguous groups, all-target coverage, unit-atomic completion |
| Mobile results overwritten by desktop transfer or stale sync | Visible replacement semantics, preserve both backups, event IDs/revisions and single-writer authority |
| Two runtimes diverge | Shared prepared-action fixtures; compare desktop and native traces, keep learning policy out of Kotlin |
| Scope grows before first useful release | Close stages in order, release desktop at 9, defer Drive/microphone/Android editing |

## 14. MVP Completion Definition

**Desktop MVP is complete at stage 9** only when the owner can create and edit their own series/cards/ordered steps, set mastery, see appropriate cue reduction, study sequentially or randomly, practice bound phrases/groups/full passages, save/use focused presets, run due General Review, operate all playback controls, restart the browser without losing data, work offline with a verified local voice, and successfully restore a complete JSON backup. The 1,000 × 10 test and one-hour speech run pass. Focused sessions leave schedules/history/mastery unchanged, and scheduled completions update due dates exactly once without auto-grading.

There must be a simple operating guide and visible recovery path. No unresolved blocker involving data loss, false completion credit, overlapping speech, or incomplete backup may be accepted as polish. Actual device evidence determines support claims. Android feasibility has either passed at stage 2 or an explicit desktop-only exception is recorded; such an exception never means the complete walking/phone goal is done.

Android MVP is a separate stage 10 completion: shared authoring data and review behavior, manual transfer, offline native-or-proven-Web-Speech listening, automatic screen-locked progression, Bluetooth output, reliable controls and safe interruption recovery on the owner's phone, plus repeatable APK setup/update instructions. No Play Store distribution, Android editing, Google account or microphone is required.

Drive sync, tongue-click YES/NO controls, microphone permissions, automatic scoring, native Android editing, alternative speech engines, public sharing, elaborate analytics and scheduling experiments do not belong to desktop MVP acceptance. Revisit optional enhancements only after real use reveals a need. A microphone experiment must be separately authorized and must not become a requirement for hands-free review.

## 15. Recommended First Implementation Stage

After the owner authorizes implementation, begin **stage 1: desktop narration proof and controllable loop**. It is the smallest useful technical slice: one harness, three varied cards, voice discovery/fallback, question → completion → recall wait → answer → completion → next step, and reliable controls. Keep data in memory, preserve the existing experiment, and use fakes to stress cancellation before adding storage.

Close G1 with audible desktop evidence, then move immediately to stage 2's real-phone/native-TTS feasibility proof. Guide Android Studio installation only then and retain the owner's clarified native option. Do not spend weeks building editors before confirming that the intended locked-screen walking experience has a plausible, demonstrated execution path.

For the next session: read this plan and the unchanged specification, incorporate the explicit owner clarification at the top, verify repository instructions/current changes, obtain implementation authorization, resolve only the decisions required by the selected stage, implement that stage, run its acceptance gate and relevant earlier regressions, and report evidence before advancing. **This planning assignment ends with this document committed and pushed; no application implementation is authorized by its completion.**


</details>
