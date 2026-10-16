# Listen to your flashcards

Open **[https://crownandcall.com/SR/](https://crownandcall.com/SR/)** in the **same desktop Chrome profile** where you created States/Delaware. Close old SR tabs and reload once after the update. The player uses the existing library; do not clear site data, import sample data, or reset your cards to enable playback. The editor is now the **Library editor** link at `/SR/library.html`.

## Owner verification and current limits (2026-10-13)

The owner successfully played a newly authored Delaware flashcard on the home desktop using the live player, hearing all eligible steps in order with correct question/recall/answer timing and automatic progression. They then verified the expected next-review date changes on the Mastery page. **Core desktop audio REVIEW and scheduling are owner-verified; remaining detailed G6 checks are not yet all signed off.** The home library is separate from the earlier daytime-computer library. Back up each library before transferring JSON; importing is not automatic synchronization. Stage 10 now implements [authored Android listening](ANDROID_LISTENING.md); its new physical-device acceptance remains open.

## Approved transition sounds — 2026-10-16

Desktop REVIEW/AUDIT and native Android now use the owner's fixed chimes: warm wood between different steps of one flashcard, gentle two-note when moving to another flashcard. A card boundary plays only the card cue. Automatic advancement and Next/Previous use the same actual source/destination identities, including filtered/KNOWN material. Repeating the identical step does not introduce a transition cue. There is no cue on initial Start, after Stop, or when ordinary Pause/Resume repeats an interrupted speech segment.

Both cues use pitch 330 Hz, volume 32%, sound length 0.72 s, fade-out 69%, silence before 0.27 s and after 0.18 s. These settings are hardcoded, not preferences or JSON backup fields. Question/answer speech waits for the cue to finish; recall intervals and completion/mastery/scheduling rules are unchanged. A cue itself never earns learning credit. No spoken next-step/card announcement was added; native playlist-start/completion/replay announcements remain.

Pause/Stop cancels a pending cue and its silences. Resume from a paused cue retries that cue before the target question, without repeating the completed answer or its credit. Navigation while paused waits for Resume. Navigation during a cue cancels the abandoned destination and chooses the cue for the actual new destination. Desktop needs Web Audio; Resume enables a suspended audio context or reports a visible error.

The [Chime Laboratory](https://crownandcall.com/SR/chime-lab.html) remains intact for experimentation; changing its settings does not change production. Physical Bluetooth-earbud comfort and desktop/Android perceptual equivalence remain owner checks.

## Android PREPARE / PLAY

Android offers one-touch PLAY: restore device-local choices, prepare automatically if needed, then start a fixed native session. A top operational panel stays open, with collapsed mastery/session/voice/Data panels, four navigation buttons and brief native status announcements. No authored content appears in playback status. Ready material is reused only after safe validation; Stop and process death discard it. Both REVIEW and AUDIT repeat until Stop; only the first successful completion of each prepared REVIEW step can schedule, including after skipping earlier passes. Android mastery buttons pause/save immediately and resume past the interrupted step; every 10 confirms scope. Explicit changes prune affected material using the original cutoff. This deliberately differs from desktop queued-after-answer choices and live repeat-boundary eligibility. Shared intervals, propagation, due/early rules, database and JSON safeguards remain unchanged. See [Android instructions and Samsung checklist](ANDROID_LISTENING.md).

## Hear Delaware

1. Expand **Choose a Session**, choose **REVIEW**, then the **States** series. The page initially uses REVIEW, All series, a 7-day lookahead, and no shuffle.
2. Choose **Max Deferred** to include non-KNOWN cards even if their 15-minute due time has not arrived. This does not reset their dates. If Delaware is KNOWN, use **AUDIT** instead; AUDIT speaks its final retrieval step only. REVIEW never includes KNOWN material.
3. Check the voice. Your device-local choice is restored when Chrome discovers it; if unavailable, SR uses **Google UK English Male** or another English fallback without forgetting your preference. **Refresh voices** helps when Chrome loads its inventory late. Start remains unavailable without an English voice.
4. Set the default recall pause (for example, 4 seconds) and speech rate (for example, 0.9). Voice, rate and default recall persist in this browser/profile across restarts; Library Preview shares voice/rate. These settings do not transfer in JSON backups. Each saved per-step recall override takes precedence; zero means no additional recall delay.
5. Press **Start** once. Listen for each eligible question → full recall pause → complete answer → next step/card. The panel shows mastery and playback controls; questions and answers are spoken without displaying their text. There should be no extra clicks between steps.
6. Press **Stop** when finished. Before major changes, use **Data & recovery → Save complete JSON backup** and retain a dated copy outside the browser.

If the series is missing, check the Chrome profile and exact website address first. Another computer, profile, localhost, or Android has a separate library. This release does not copy data between them.

## Compact player layout

**Choose a Session** starts collapsed, with a summary of activity, series and review window. Start is always outside the settings panel. Defaults are REVIEW, All series, Due within days, 7 days and randomization off. Saved voice, speech rate and recall preferences are retained without rewriting stored settings. Nothing speaks until Start.

Expand the heading to change settings before playback or inspect them while listening. Opening/closing never interrupts speech; active settings stay locked until Stop. Start/Restart collapses the panel, and Stop/completion does not expand it. The listening panel contains mastery, Reset FC, playback controls and repeat choices, with compact status/saved feedback and visible errors. Card titles, question/answer text, instruction paragraphs and help indicators remain absent; authored text remains unchanged in the engine and editor.

The bottom status reads **Activity · Series Name · Card X/Y · Step X/Y · Phase**. Card numbers describe the original authored position and total within that card's own series; step numbers describe the original position and total within the full card. Filtering, lookahead, KNOWN exclusions and UNBOUND shuffle never renumber them. Navigation and repetition update the displayed location; AUDIT shows its original final-step number.

Phases are Question, Recall, Answer, Paused, Stopped, Completed and Error (with brief preparation/saving states where needed). Recall shows remaining whole seconds, rounded up and refreshed approximately once per second from the playback controller. Pause freezes that value and retains the phase, for example **Paused (Recall: 4 seconds remaining)**; Resume continues from the controller's remaining duration. Custom step recall overrides are reflected automatically. Completed has no active card and displays the activity plus Completed. Detailed errors remain visible separately. The status observes playback; it does not schedule or change it.

## Activities and controls

**REVIEW:** Due now, whole-number N-day lookahead, or Max Deferred. A card qualifies only through its final step; each retained step must qualify within the same cutoff. BOUND cards stay ordered. Randomization affects only UNBOUND cards, never steps. A finished due step restarts its current interval. An early step keeps its original dates even if its due time passes during that step. Playing never raises mastery automatically.

**AUDIT:** ALL or one series; only KNOWN final steps. A completely KNOWN BOUND series contributes its final comprehensive card. Repeats continuously, refreshing eligibility each cycle, until Stop or no eligible targets. Successful AUDIT changes nothing automatically.

| Control | Behavior |
|---|---|
| Pause / Resume | Pause cancels speech. Resume repeats just the interrupted segment; completed earlier segments remain complete. Recall resumes its remaining time. |
| Next Step | Interrupts the current eligible step without credit, discards its pending mastery, and starts the next eligible step or card. Paused navigation stays paused. |
| Previous Step | Restarts the previous eligible step in this card from its question. Disabled on the first eligible step; never crosses backward into another card. Earlier saved progress stays intact. |
| Repeat Current Step | Loops the full question, recall and answer while REVIEW eligibility still holds at each answer boundary. Uncheck to finish this repetition and then advance. Pause/Resume keeps its usual meaning. |
| Next FC | Cancels the unfinished step and skips all remaining steps in that card; already completed steps retain credit. Paused navigation stays paused. |
| Previous FC | Returns to the preceding card in the prepared session, at its first eligible step. Disabled at the first card. Keeps the selected/shuffled order without rebuilding the session; preserves saved progress. |
| Repeat Current FC | Finishes the current pass, refreshes REVIEW eligibility, then loops this card from its first currently eligible step in ascending order. Uncheck to finish the current card pass, then advance. Mutually exclusive with Repeat Current Step. |
| Stop | Cancels the unfinished attempt, drops its pending mastery and releases the library after any already-started valid save finishes. |
| Restart session | Stops and reloads currently eligible cards using the previous settings. Prior completion credit remains; newly scheduled steps may no longer be due. |
| Resume / retry after an error | Speech errors repeat the failed segment. Scheduling errors retry the same completed step without replaying its answer or double-counting it. |

Long text is split into small utterances without rewriting or dropping characters; slight pauses between segments are possible. There is no 120-second recall limit on desktop. Chrome can still delay speech/timers when hidden or suspended; keep the computer awake. A segment missing its completion callback for 120 seconds causes a visible error, never guessed credit. Offline use of a voice and background reliability require listening tests; offline cold launch is not implemented.

### Repetition and replay safety

Before each new REVIEW flashcard repetition, the player reads committed progress and runs the existing selector against the active window at that boundary. The final step must still qualify; otherwise repetition stops and playback advances to the next prepared card. If it qualifies, only currently eligible non-KNOWN steps repeat, in authored order. For example, steps changed to mastery 9 leave a seven-day repeat after their answers save. The pass already in progress remains unchanged; refresh never interrupts active speech.

Repeat Current Step checks the same card anchor and current step after its answer commits. An ineligible step stops looping and advances within the current pass; an ineligible final anchor moves to the next card. Due-only repeats may therefore end after the first successful answer schedules material into the future. Lookahead and Max Deferred still follow their existing rules. AUDIT repetition and its cycle-level eligibility refresh remain unchanged. A failed repeat-eligibility read shows an error; Resume retries the read without repeating a successful scheduling write.

After the first successful completion of a selected step in a session, further step/card repetitions and Previous Step/Previous FC replays use the existing practice completion mode, without automatic review credit or repeated due-date changes. The current session remembers successfully completed card/step identities; the normal pass and card order remain unchanged, while automatic repetitions refresh eligibility as described above. Explicit Previous navigation may still revisit a selected step made KNOWN during the pass as practice; automatic REVIEW repetition excludes KNOWN steps. This does not add KNOWN material to a new REVIEW selection.

A new explicit mastery choice during practice applies once after the next complete answer, using the existing scheduling API and receipt rules. It does not reapply an earlier choice or move the original last-reviewed timestamp. AUDIT continues to make no automatic changes. Step navigation and Previous FC are disabled during an already-started completion write; it cannot undo legitimately committed work.

Both repeat choices reset on Next Step, Previous Step, Next FC, Previous FC, Stop, Restart and special resets. Checking one repeat option unchecks the other; Pause/Resume preserves the selected option. It never follows you to another card. Navigation discards unfinished pending choices and late speech callbacks. Restart creates a new eligible session, keeping saved progress.

## Change mastery while listening

Click one of the **0–10 mastery buttons**. Each shows its interval beneath the number: 15m, 3h, 6h, 1d, 2d, 3d, 1w, 2w, 1mo, 3mo, KNOWN. Levels 0–9 and intermediate-step KNOWN queue immediately while audio continues. No separate Queue, Save or Resume action is needed. Several choices during one step keep only the last choice.

The outlined button marks the saved level; the filled button marks the selected level (brown while pending). A screen-reader status announces a pending choice; a compact saved message appears after successful completion and clears after 2.5 seconds (or Stop/Restart). New saves replace it; old timers cannot clear a newer message. Late acknowledgements from an interrupted occurrence cannot announce a save on another step. Playback status and persistent errors remain separate. The next step displays its own mastery. Stop/navigation before the answer finishes discards the pending choice. Scheduling uses the existing API: the explicit change takes effect at successful answer completion, and the next due date uses that completion timestamp.

Tab into the radio group; arrow keys select adjacent levels, Home selects 0 and End selects 10. Space/Enter activates a focused button. The row wraps on narrower windows.

Final-step KNOWN asks for confirmation of the whole card, or the entire BOUND series for its final card. Audio pauses for that dialog and continues afterward if it had been playing; an already paused session stays paused. Cancel keeps the prior saved/pending choice. A stopped or skipped step cannot receive a late confirmation. Ordinary AUDIT still makes no automatic mastery or scheduling changes.

**Reset FC** confirms resetting every step of this card to 0, due in 15 minutes. It is an immediate explicit change after confirmation, not speech-completion credit. Playback remains paused and moves past that card. Cancel restarts the interrupted step on Resume, with its pending adjustment discarded. The redundant “I know this for sure” button is removed; use mastery 10 with its existing card/series confirmation rules.

During AUDIT, **Reset final step only** preserves earlier KNOWN steps; **Reset entire flashcard / objective** resets the whole card, or the entire series when auditing its final BOUND card. Confirmations identify the scope. Reset targets disappear from later AUDIT cycles.

## Another tab or an error

Only one player can own this origin/library. Ownership includes paused/error states. Stop that session before starting another, saving editor changes, changing mastery elsewhere, or restoring a library. Export remains available. A rejected editor save retains its draft. Reload saved content after playback has changed progress before trying a stale editor/mastery save again.

Close/reload SR tabs that were open before this update; old pages lack the new cooperative lock. Revision/generation checks still reject stale completion. If content changes or a library is restored, Stop then Start from the current library. If storage fails, retry or Stop and make a backup; do not clear browser data. Closing/reloading never resumes automatically and never claims an unfinished answer succeeded.

## Owner acceptance still needed — G6

Report the date, Chrome version, voice, recall settings, and observations:

- Hear your actual Delaware wording and eligible steps in order on the live site, with correct pauses and automatic progression. Confirm its text is unchanged in the editor.
- Exercise Pause/Resume during question, recall and answer; Next Step, Previous Step, Next FC, Previous FC, both repeat options, Stop, paused navigation and Restart. Check that repeats do not keep moving due dates and that a new mastery choice saves only once. Confirm silence after Stop and no overlapping/stale narration.
- Check due REVIEW advances dates only after an answer; lookahead early REVIEW preserves dates; AUDIT repeats final steps without automatic changes. Test mastery/reset confirmations on content you intend to change, or a separately created disposable test library.
- Try a long answer and a saved recall override above 120 seconds. Confirm full duration/wording and controls; automatic synthetic timing tests do not prove sound.
- Record preferred/fallback availability and any stalls in a background tab. Earlier G1/G2 long-run/device checks remain separate.

**G6 core audible/scheduling acceptance is owner-verified; full-checklist closure remains OPEN.** Automated tests never read your personal library. Android Stage 10 has its own [Samsung verification checklist](ANDROID_LISTENING.md); desktop evidence does not certify native listening.

## Local development on Windows

In this checkout:

```powershell
Set-Location 'C:\Users\tpaig\Documents\Codex\2026-10-12\files-pasted-by-the-user-dex\work\CCTTRPG'
node SR/tests/serve.mjs
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in Chrome. This uses a **different** library from the live site; it will not contain your live Delaware automatically. Do not double-click the HTML file. Use `/tests/study.html` for silent isolated tests. Press Ctrl+C in PowerShell to stop the server. Automated-runner setup is in [TEST_RESULTS.md](TEST_RESULTS.md).
