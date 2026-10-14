# Listen to your flashcards

Open **[https://crownandcall.com/SR/](https://crownandcall.com/SR/)** in the **same desktop Chrome profile** where you created States/Delaware. Close old SR tabs and reload once after the update. The player uses the existing library; do not clear site data, import sample data, or reset your cards to enable playback. The editor is now the **Library editor** link at `/SR/library.html`.

## Owner verification and current limits (2026-10-13)

The owner successfully played a newly authored Delaware flashcard on the home desktop using the live player, hearing all eligible steps in order with correct question/recall/answer timing and automatic progression. They then verified the expected next-review date changes on the Mastery page. **Core desktop audio REVIEW and scheduling are owner-verified; remaining detailed G6 checks are not yet all signed off.** The home library is separate from the earlier daytime-computer library. Back up each library before transferring JSON; importing is not automatic synchronization. The Android APK still uses fixed sample playback, not authored-card REVIEW/AUDIT.

## Hear Delaware

1. Choose **REVIEW**, then the **States** series.
2. Choose **Max Deferred** to include non-KNOWN cards even if their 15-minute due time has not arrived. This does not reset their dates. If Delaware is KNOWN, use **AUDIT** instead; AUDIT speaks its final retrieval step only. REVIEW never includes KNOWN material.
3. Check the voice. **Google UK English Male** is selected when available; otherwise choose an English fallback. **Refresh voices** helps when Chrome loads its inventory late. Start remains unavailable without an English voice.
4. Set the default recall pause (for example, 4 seconds) and speech rate (for example, 0.9). Each saved per-step recall override takes precedence; zero means no additional recall delay.
5. Press **Start** once. Listen for each eligible question → full recall pause → complete answer → next step/card. The screen shows the authored step number and full text. There should be no extra clicks between steps.
6. Press **Stop** when finished. Before major changes, use **Data & recovery → Save complete JSON backup** and retain a dated copy outside the browser.

If the series is missing, check the Chrome profile and exact website address first. Another computer, profile, localhost, or Android has a separate library. This release does not copy data between them.

## Activities and controls

**REVIEW:** Due now, whole-number N-day lookahead, or Max Deferred. A card qualifies only through its final step; each retained step must qualify within the same cutoff. BOUND cards stay ordered. Randomization affects only UNBOUND cards, never steps. A finished due step restarts its current interval. An early step keeps its original dates even if its due time passes during that step. Playing never raises mastery automatically.

**AUDIT:** ALL or one series; only KNOWN final steps. A completely KNOWN BOUND series contributes its final comprehensive card. Repeats continuously, refreshing eligibility each cycle, until Stop or no eligible targets. Successful AUDIT changes nothing automatically.

| Control | Behavior |
|---|---|
| Pause / Resume | Pause cancels speech. Resume repeats just the interrupted segment; completed earlier segments remain complete. Recall resumes its remaining time. |
| Skip flashcard | Cancels the unfinished step and skips all remaining steps in that card; already completed steps retain credit. Paused Skip stays paused. |
| Stop | Cancels the unfinished attempt, drops its pending mastery and releases the library after any already-started valid save finishes. |
| Restart session | Stops and reloads currently eligible cards using the previous settings. Prior completion credit remains; newly scheduled steps may no longer be due. |
| Resume / retry after an error | Speech errors repeat the failed segment. Scheduling errors retry the same completed step without replaying its answer or double-counting it. |

Long text is split into small utterances without rewriting or dropping characters; slight pauses between segments are possible. There is no 120-second recall limit on desktop. Chrome can still delay speech/timers when hidden or suspended; keep the computer awake. A segment missing its completion callback for 120 seconds causes a visible error, never guessed credit. Offline use of a voice and background reliability require listening tests; offline cold launch is not implemented.

## Change mastery while listening

Select level 0–10 and read the displayed interval, then **Queue mastery after answer**. Playback pauses so you can check the choice; choose **Resume** to continue. It is saved only after the full answer succeeds. Stop/Skip before then discards it. Final-step 10 requires explicit confirmation of all affected steps/cards, including the entire series for its final BOUND card.

**Reset FC** confirms resetting every step of this card to 0, due in 15 minutes. **I know this for sure** confirms making the card KNOWN and available through AUDIT; the final BOUND card propagates this to its entire series. These actions are immediate explicit changes after confirmation, not speech-completion credit. Playback remains paused and moves past that card. Cancelling instead restarts the interrupted step on Resume, with its pending adjustment discarded.

During AUDIT, **Reset final step only** preserves earlier KNOWN steps; **Reset entire flashcard / objective** resets the whole card, or the entire series when auditing its final BOUND card. Confirmations identify the scope. Reset targets disappear from later AUDIT cycles.

## Another tab or an error

Only one player can own this origin/library. Ownership includes paused/error states. Stop that session before starting another, saving editor changes, changing mastery elsewhere, or restoring a library. Export remains available. A rejected editor save retains its draft. Reload saved content after playback has changed progress before trying a stale editor/mastery save again.

Close/reload SR tabs that were open before this update; old pages lack the new cooperative lock. Revision/generation checks still reject stale completion. If content changes or a library is restored, Stop then Start from the current library. If storage fails, retry or Stop and make a backup; do not clear browser data. Closing/reloading never resumes automatically and never claims an unfinished answer succeeded.

## Owner acceptance still needed — G6

Report the date, Chrome version, voice, recall settings, and observations:

- Hear your actual Delaware wording and eligible steps in order on the live site, with correct pauses and automatic progression. Confirm its text is unchanged in the editor.
- Exercise Pause/Resume during question, recall and answer; Stop, paused Skip and Restart. Confirm silence after Stop and no overlapping/stale narration.
- Check due REVIEW advances dates only after an answer; lookahead early REVIEW preserves dates; AUDIT repeats final steps without automatic changes. Test mastery/reset confirmations on content you intend to change, or a separately created disposable test library.
- Try a long answer and a saved recall override above 120 seconds. Confirm full duration/wording and controls; automatic synthetic timing tests do not prove sound.
- Record preferred/fallback availability and any stalls in a background tab. Earlier G1/G2 long-run/device checks remain separate.

**G6 remains BLOCKED until the necessary audible evidence is reported.** Automated tests never read your personal library. The APK still plays its fixed sample; this desktop release does not add authored-card Android playback.

## Local development on Windows

In this checkout:

```powershell
Set-Location 'C:\Users\tpaig\Documents\Codex\2026-10-12\files-pasted-by-the-user-dex\work\CCTTRPG'
node SR/tests/serve.mjs
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in Chrome. This uses a **different** library from the live site; it will not contain your live Delaware automatically. Do not double-click the HTML file. Use `/tests/study.html` for silent isolated tests. Press Ctrl+C in PowerShell to stop the server. Automated-runner setup is in [TEST_RESULTS.md](TEST_RESULTS.md).
