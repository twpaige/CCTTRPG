# SR — Audio Spaced Repetition System
Specification v0.1 · 2026-10-12 · Proposed, not implemented

## Vision and scope
Create a **local-first, audio-first** personal memorization system for Windows Chrome and Android. Its primary use is walking with Bluetooth earbuds and the phone locked: start a review once, then hear questions, recall pauses, answers, and subsequent cards automatically. Prioritize actually using the product over months of development.

The learner authors their own mnemonic chains. Creating the cards is an essential part of learning; do not introduce public decks, sharing, accounts, passwords, AI-authored mnemonic content, or a server dependency. Preserve concise, idiosyncratic original imagery without embellishment. Desktop is the authoring/mastery authority; Android initially is a listening/review client.

## Core concepts
- **Series/deck:** named collection of flashcards, ordered and marked **bound** or **unbound**.
- **Unbound:** presidents, states, commandments; cards can be shuffled/interleaved independently even though series order is meaningful.
- **Bound:** e.g. Psalm 23; cards form an essential recitation sequence. Practice individual cards or contiguous groups, but preserve order for full recitation. A bound block can be shuffled as a whole among other reviews.
- **Flashcard (FC):** stable ID, name, series ID, position, ordered variable-length **steps**, and manually set mastery 0–10. One FC may encode several facts.
- **Step:** an explicit **question and answer** pair leading to the next association. Unlimited practical step count, add/insert/delete/reorder/edit. Do not automatically reorder steps.
- **Review preset:** named reusable selection of one or more series and/or individual FCs, without duplicate selections.
- **Progress:** separate from content: mastery, last scheduled review, next due date.

### Example: 16th President
FC name "16th President"; unbound series "Presidents".
| Step | Question | Answer |
|---|---|---|
| 1 | Who is the sixteenth president and when did he take office? | Sixteen |
| 2 | Where does sixteen lead us in the list of presidents? | Ditch |
| 3 | What is the presidential story about the ditch? | Abraham Lincoln going into a ditch with a wagon full of freed slaves |
| 4 | Who was driving the wagon in the story? | Abraham Lincoln |
| 5 | What memory trick helps with the year he took office? | Turn sixteen around to get sixty-one |
| 6 | In what year did the sixteenth president take office? | Eighteen sixty-one |

Distinguish 1861 (took office) from 1860 (first elected). The author, not the application, creates associations.

### Example: Delaware
First state, capital Dover, admitted December 7, 1787; DE. Peg: **1 → tie → WEAR → DelaWARE**. Bend **OVER** while tying tie → **DOVER**. Major System **den (12) → key (7) → vac (87)** → December 7, 1787. Original short story: "In the den, pick up a key that turns on the vacuum." Keep the wording sparse to let the learner visualize the rest. One FC can contain all the facts and the mnemonic steps; do not force separate cards per fact. At higher mastery, questions can start from "Delaware" rather than the number 1.

### Example: Psalm 23
Bound series "Psalm 23", with one FC per natural phrase/location, not necessarily per biblical verse. Memory journey through childhood farmhouse: **Gate → Grass → Pond → Store → Porch → Door → Kitchen → Corner → Dining Room → Bathroom → Stairs → Window**. Gate FC may ask: Where are you? → Gate; Who is there? → Jesus; What is he doing? → Shepherd's crook and Big Macs, feeding you everything you want; What Scripture does it recall? → "The Lord is my shepherd; I shall not want." Subsequent cues include green grass, still pond, shoe soles/store/restore soul, righteous path and name on porch, VSD door, monster/no fear in kitchen, rod and staff in corner, enemy at dining table, oil and overflowing cup in bathtub, Shirley/Goodness/Mercy on stairs, cookies/dwarf/dwell at window. Preserve the original learner-authored stories and chosen KJV text; verify canonical Scripture wording rather than silently rewriting it.

Other intended content: Ten Commandments with number pegs **1 run, 2 zoo, 3 tree, 4 door, 5 dive, 6 sticks, 7 heaven, 8 gate, 9 dine, 10 den**; vocabulary ("reconcile"); presidents; states/capitals/admission order/date; Bible verses. Do not hardcode subject-specific fields into the engine.

## Knowledge Mastery and review
Every FC has manually adjustable integer mastery **0–10**. The **Knowledge Mastery** control on desktop lets users browse series/cards and change levels. Lower levels: easy step-by-step questions, pauses, full mnemonic/story and answer. Increasing levels: fewer intermediate cues, direct questions, and longer recall sequences. Highest levels: direct retrieval with answers spoken after a pause. The authored steps remain intact and can always be revisited. The learner controls mastery; merely playing a card never proves correctness or automatically raises mastery.

Suggested initial due intervals, editable after testing: L0 every session, L1 1 day, L2 2 days, L3 4 days, L4 7 days, L5 14 days, L6 21 days, L7 30 days, L8 42 days, L9 60 days, **L10 ~90 days**. These are proposed heuristics, not validated scheduling constants. Store last/next scheduled review separately.

For Psalm 23, begin with phrase-by-phrase recall: allow ~3–5 seconds for a short phrase, speak correct phrase, continue. Progress to adjacent chunks, then prompt "Recite Psalm 23", wait an appropriate full-passage duration, and speak the whole passage for self-check. Allow recall time proportional to words and adjustable speaking rate/margin. Full-passage recitation can remain a single bound review unit, while weak segments can be practiced individually. No speech recognition or mandatory self-rating during a walk.

### Review modes
**General Review:** choose due FCs from all series, shuffle unbound cards and bound groups, preserve bound internal sequence, play without requiring user feedback, update last/next review on completed scheduled units. Do not automatically adjust mastery.

**Review Setup:** select one/multiple whole series, specific FCs, or combinations; save as named presets. Choose a preset or General Review at session start.

**Focused Review:** ignore due dates; play selected cards even if not due. **Never update normal last-reviewed, next-due, scheduling history, or mastery.** Overdue cards remain overdue. The same spoken question/pause/answer engine is used in all modes.

Desktop supports authoring, mastery adjustment, presets, and review. Android initially supports selecting review/presets, listening, pause/resume/skip/stop, import/sync; no card authoring or mastery editing in MVP. Both use the same review behavior. A Knowledge Mastery entry may be visible read-only on Android until editing is intentionally added.

## Native JavaScript text-to-speech — required
Use **Web Speech API**, specifically `SpeechSynthesisUtterance`, `window.speechSynthesis.getVoices()`, and `speechSynthesis.speak()`. The user explicitly does **not** want prerecorded MP3 clips, audio timestamp indexes, cloud TTS APIs, Sherpa-ONNX, Piper or a native TTS bridge as the default design.

Preferred Chrome voice: **Google UK English Male**, `en-GB`, initial rate 0.9, pitch 1.0, volume 1.0. Populate voices on `voiceschanged` (asynchronous); match preferred voice by name; if absent use an available English voice with clear fallback/selection. Voice is supplied by the browser/platform, not Windows Settings. The exact Google voice is **not guaranteed on Android** and may not be available offline; provide an Android-available fallback, and do not promise identical voices across platforms.

A single JavaScript review controller loads a lightweight randomized queue of card IDs from IndexedDB, fetches steps as needed, and stays on the same page. Each chosen step: **speak question → await onend → wait recall time → speak answer → await onend → next step**, then next FC automatically. No refresh, server call, or button press between cards. One initial Start gesture may be needed to unlock audio. Include Pause, Resume, Stop, Skip and optional Repeat. Implement cancellation robustly: timers must be cancellable, outstanding speech promises must settle on stop/error, and a session token prevents overlapping old and new loops. `onend` is authoritative for speech completion; do not guess spoken duration.

**Critical technical gate:** Android must keep advancing while screen is locked, with Bluetooth earbuds. A Capacitor WebView does **not automatically guarantee** that JavaScript timers, Web Speech or microphone survive backgrounding. Test on a real Android device early. A foreground service/native Android integration may be required; seek approval before substituting native TTS for the required JS speech path. Offline voice availability must be verified. Do not spend months building other features before proving pocket/screen-off narration.

Earlier tongue-cluck proof of concept: local microphone activity meter moved and some one/double clicks were recognized. Discreet one cluck YES / two clucks NO remains **optional future** functionality; do not require microphone access or user feedback during normal review. No audio output from the original click detector test.

## Storage: IndexedDB
Use a single versioned local **IndexedDB** database (e.g. SRLearning) per device, with logical stores:
- `series`: stable ID, name, bound, position, timestamps
- `flashcards`: stable ID, seriesId, name, position, ordered steps [{id, question, answer, position}], timestamps
- `progress`: card ID, mastery, lastReviewedAt, nextDueAt
- `presets`: ID, name, selected series/card IDs, review mode
- `settings`: voice preference, speaking rate, pauses, optional sync metadata
- optional scheduled review event log

Index by series and due date. One mastery update changes only one IndexedDB record, **not a rewritten JSON file**. Series are logical collections in the database, not separate operating-system files. Handle at least 1,000 FCs × 10 steps and preferably much more; text data is small. Lazy-load steps and create utterances one at a time. Local data works offline but can be lost if browser storage is cleared or app uninstalled: backups are essential.

## JSON export/import and optional Google Drive
JSON is a **portable versioned snapshot**, not primary live storage. Export complete personal backup: all series, cards, ordered steps, progress, presets, nonsecret settings, schema version, timestamp. Import validates schema, IDs, references, mastery range and order; preview before replacing; back up existing data first; avoid partial imports. Import/export is solely for a user's **own** backup and desktop↔phone transfer, not deck sharing or a public catalog. Manual file transfer works without any Google account or network.

**Optional Google Drive** manual **Sync** button, no self-hosted server. Desktop is authoritative for card content, mastery and presets. Android primarily downloads those and can upload scheduled review completions so desktop due dates remain accurate. Use an app-specific OAuth/Drive integration, not the ChatGPT Google Drive connection. Sync is **not** merely blind overwrite of one JSON blob: guard against lost edits/review events with version/revision checks or an explicit single-writer plus review-event upload protocol. Prefer simplicity over real-time collaboration. A manual **Restore Desktop from Google Drive** and **Restore Android** must be possible after local loss/corruption, with confirmation and validation. Sync and Restore are distinct operations. Keep multiple dated backups or versions to avoid overwriting the last good backup with corrupted data. Do not require Google Drive; JSON-only users retain full functionality.

## UI outline
- **Review:** General Review or named preset; Start, Pause, Resume, Skip, Stop; show current FC/step and status; same playback behavior desktop/Android.
- **Knowledge Mastery:** browse/filter series and FCs, set level 0–10 (desktop; mobile read-only initially).
- **Review Setup:** choose series and/or cards, name/save preset, select focused or due-only mode.
- **Flashcard Editor (desktop):** FC name, series, position, mastery; arbitrary ordered question/answer steps; add/remove/move/edit; preserve text.
- **Series Editor (desktop):** create, rename, bound/unbound, ordering.
- **Data:** Export JSON, Import JSON, optional Connect Drive, Sync, Restore, backups.
- **Settings:** available speech voices, preferred voice, rate, pause defaults, long-passage timing.

## Suggested JSON shape (illustrative, not a frozen schema)
```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-12T00:00:00Z",
  "series": [{"id":"presidents","name":"Presidents","bound":false}],
  "flashcards": [{
    "id":"president-16","seriesId":"presidents","position":16,
    "name":"16th President",
    "steps":[
      {"id":"s1","position":1,"question":"Where does sixteen lead us?","answer":"Ditch."},
      {"id":"s2","position":2,"question":"Who drove the wagon?","answer":"Abraham Lincoln."},
      {"id":"s3","position":3,"question":"When did he take office?","answer":"1861."}
    ]
  }],
  "progress":[{"flashcardId":"president-16","mastery":3,"lastReviewedAt":null,"nextDueAt":null}],
  "presets":[],
  "settings":{"preferredVoice":"Google UK English Male","language":"en-GB","rate":0.9}
}
```

## Acceptance criteria / implementation sequence
1. Prove a single HTML/JS page speaks question, waits, speaks answer, and automatically advances through multiple steps/cards using Google UK English Male when available. No reload.
2. Prove locked-screen Android/Capacitor narration and timers with Bluetooth headset. **Stop and reassess** if this fails; don't silently switch speech engines.
3. Implement versioned IndexedDB, authoring/step editing, bound/unbound series, mastery, and JSON backup/restore with validation.
4. Implement General Review scheduling and randomized queue; focused review and saved presets; enforce no schedule mutation during focused review.
5. Implement optional manual Google Drive sync/restore with conflict protection and backups.
6. Only then consider tongue-click input or Android editing.

Test: variable steps, chain order, series binding, shuffled independent cards, long-passage pauses, manual mastery only, 90-day L10 default, focused mode leaves due dates untouched, cancellation/restart, asynchronous voice loading, offline operation, large libraries, JSON round-trip, invalid-import rejection, restore from corruption, and screen-off Android playback.

## Design decisions still open
Precise mapping of each mastery level to playback steps and bound-series chunk size; whether to count a partially completed general review; exact date arithmetic for overdue items; initial sync conflict strategy; Android background speech feasibility; and final editor layout. Dex should investigate and propose the **simplest robust implementation** before coding beyond a small proof of concept. Avoid overengineering.
