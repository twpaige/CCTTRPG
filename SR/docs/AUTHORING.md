# Author your library

Open **https://crownandcall.com/SR/library.html** in desktop Chrome, or choose **Library editor** from the player at `/SR/`. Your existing library stays in the same browser profile and origin; this navigation change needs no import or migration. Stop playback before saving edits. Clearing site data can erase the library; keep dated JSON backups outside the browser.

1. Choose **New series**, enter a name and choose its binding. **Bound** means the sequence matters (for example, a passage journey). **Unbound** means related cards may later be reviewed independently or randomly. This setting does not rearrange your cards. Choose **Save**.
2. Select the series and choose **New flashcard**. Enter its descriptive name and write the first question and answer. Multiline text, Unicode, punctuation and your own wording are retained; no story is generated for you.
3. Use **Add step**, **Insert after**, **Up**, **Down** and **Delete step** to build the chain. There is no fixed step limit; 100-step authoring is tested. Set **Recall duration in seconds** if this step needs a custom pause; blank uses the session default, zero is valid, and long recitations are supported in storage. Review the complete chain and choose **Save**. At least one nonblank question/answer pair must remain.
4. Reopen a saved card from the list to continue editing. Choose a different series to move it; its default destination is the end. Change **Position** (1 means first), or use **Move up/down**, then **Save**. **Edit series** provides the same ordering controls for series.
5. **Cancel** discards a draft only after confirmation if it has changed. Switching editors, reloading or leaving the page also warns about unsaved changes. These browser warnings cannot protect drafts against crashes or forced termination: save regularly.
6. **Save JSON backup** downloads all saved content, independent step progress, legacy progress, completion receipts, presets and preferences in version-2 format. Unsaved drafts are excluded. Version-1 backups are still importable through the approved conversion. Use **Data & recovery** for automatic outgoing backup, read-back verification and one import confirmation. Keep desktop and phone backups separately; restoration replaces rather than merges. Update an older Android APK before transferring a version-2 file.

All controls are native keyboard controls: Tab/Shift+Tab to navigate, Enter/Space to activate buttons, arrow keys for selects/number inputs. Ordering never requires dragging. Lists show up to 50 items per page; only the selected card's chain is rendered.

Deletion shows the saved content name, affected card names, step/progress counts and the number of affected presets. **Keep content** cancels. **Delete permanently** removes the selected card, or a series and all its cards, together with their progress and preset references. The presets themselves remain. Export first if you might need to recover it.

If a save fails, the draft stays in the form. Correct validation errors or retry after resolving a storage/quota failure. If another tab changes or restores the library, even a change elsewhere in the library, the stale save is refused. Copy text you want to retain, choose **Reload saved library**, confirm discarding the stale draft, and reopen the current record before reapplying it. There is no automatic merge. Keep one authoring tab for ordinary work. A database version change closes the connection; copy your draft text before reloading the page.

Editing content preserves existing step mastery and review dates. Newly authored cards/steps begin at mastery 0 with no last review and a due date 15 minutes after creation. Imported optional annotations are preserved. To avoid silently changing recitation references, the editor refuses deletion of a referenced step or a move that changes their relative order; ordinary unannotated chains support all step operations. The final step is the complete-retrieval convention and controls card eligibility; changing which step is last changes the anchor without resetting any surviving step's progress.

## Knowledge Mastery (Stage 5)

Open **Knowledge Mastery** from the library, or go to **https://crownandcall.com/SR/mastery.html**. Select a series, flashcard and step. Choose a level, inspect its interval and proposed date, then **Apply step mastery**. The controls change saved progress; they do not rewrite your questions or answers. Use Reload saved library after a stale-write error; your unapplied selection remains visible until you explicitly discard it.

| Level | Next interval |
|---|---|
| 0 | 15 minutes |
| 1 | 3 hours |
| 2 | 6 hours |
| 3 | 1 day |
| 4 | 2 days |
| 5 | 3 days |
| 6 | 1 week |
| 7 | 2 weeks |
| 8 | 1 calendar month |
| 9 | 3 calendar months |
| 10 | KNOWN â€” no normal REVIEW due date |

Dates restart from the explicit change time. Days/weeks are elapsed time; months use UTC calendar arithmetic with month-end clamping. Dates display in your local timezone. Playing will not automatically increase mastery.

Setting a **final step** to 10 asks before marking the entire card KNOWN. **I know this for sure** does the same. On the final card of a BOUND series, the confirmation explains that the **entire series** will become KNOWN. This is never an unannounced side effect. Lowering the final step later leaves earlier KNOWN steps untouched.

**Reset FC** asks before setting every step of that card to 0, due in 15 minutes. In the AUDIT preview, **Reset final step only** preserves the earlier chain's mastery. **Reset entire flashcard / objective** resets that card, or the whole BOUND series when it is the final comprehensive card; confirmation explains the scope. Neither audit success nor failure automatically changes anything.

The **REVIEW / AUDIT preview** shows what later playback will select:

- REVIEW uses Due now, a lookahead of one or more whole days, or Max Deferred. A card appears only when its final step is non-KNOWN and within the window. It includes only non-KNOWN steps within that same window, always in authored order. Earlier overdue steps cannot independently select a card. Max Deferred includes all non-KNOWN eligible steps/cards, never KNOWN material.
- BOUND card order is preserved; UNBOUND cards may be randomized. Selected steps from a card stay together.
- AUDIT ALL or a selected series includes only KNOWN cards' final steps. A completely KNOWN BOUND series contributes only its final comprehensive card. Future AUDIT playback will repeat until stopped; Stage 5 shows the selection and explicit reset choices without starting audio.

## First schema-2 upgrade and recovery

The approved migration copies each existing card's mastery, last-reviewed time and due date to **every step**. Level 10 becomes KNOWN with no due date. It does not propagate to other cards, recalculate old dates, rewrite content or change identifiers/order. After migration, steps are independent. The upgrade is atomic and never reapplied on reopen. If another SR tab blocks it, close that tab; do not clear storage.

Keep a dated export before an update when possible. Use **Data & recovery → Save Complete JSON Backup** for the complete current library. Historical private recovery records are retained but their old export actions are retired. Confirm your real States/Delaware content and copied progress in the same profile; synthetic test fixtures are not a substitute for that owner check. Never uninstall or clear storage as an update procedure.

The desktop [REVIEW / AUDIT player](PLAYBACK.md) and Stage 10 [Android listening client](ANDROID_LISTENING.md) use the same Stage 5 rules. Android supports long authored text and recall overrides through its native service; physical Samsung qualification remains separate. Author/edit on desktop, export a dated full JSON snapshot to OneDrive or another location, then import on Android using the system picker. After listening, Stop/save queued progress before exporting back. Full snapshots replace rather than merge: keep both files if desktop content changed independently. Desktop cold offline launch remains on hold in Stage 9; Android bundles its listening assets.

For a disposable owner trial use **https://crownandcall.com/SR/library.html?test=SRLearning-test-owner-editor**. Its player, mastery and Data links preserve that test database selection. Do not use a personal library for destructive acceptance testing.
