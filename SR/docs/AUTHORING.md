# Author your library

Open **https://crownandcall.com/SR/** in desktop Chrome. Your library is stored in this browser profile on this device. Use the same origin and profile when returning. Clearing site data can erase it; keep dated JSON backups outside the browser.

1. Choose **New series**, enter a name and choose its binding. **Bound** means the sequence matters (for example, a passage journey). **Unbound** means related cards may later be reviewed independently or randomly. This setting does not rearrange your cards. Choose **Save**.
2. Select the series and choose **New flashcard**. Enter its descriptive name and write the first question and answer. Multiline text, Unicode, punctuation and your own wording are retained; no story is generated for you.
3. Use **Add step**, **Insert after**, **Up**, **Down** and **Delete step** to build the chain. There is no fixed step limit; 100-step authoring is tested. Review the complete chain and choose **Save**. At least one nonblank question/answer pair must remain.
4. Reopen a saved card from the list to continue editing. Choose a different series to move it; its default destination is the end. Change **Position** (1 means first), or use **Move up/down**, then **Save**. **Edit series** provides the same ordering controls for series.
5. **Cancel** discards a draft only after confirmation if it has changed. Switching editors, reloading or leaving the page also warns about unsaved changes. These browser warnings cannot protect drafts against crashes or forced termination: save regularly.
6. **Save JSON backup** downloads all saved series, cards, progress, presets and preferences using the existing version-1 format. Unsaved drafts are excluded. Use **Data & recovery** for file validation, safety-backup verification and explicitly confirmed replacement. Keep desktop and phone backups separately; restoration replaces the entire library rather than merging it.

All controls are native keyboard controls: Tab/Shift+Tab to navigate, Enter/Space to activate buttons, arrow keys for selects/number inputs. Ordering never requires dragging. Lists show up to 50 items per page; only the selected card's chain is rendered.

Deletion shows the saved content name, affected card names, step/progress counts and the number of affected presets. **Keep content** cancels. **Delete permanently** removes the selected card, or a series and all its cards, together with their progress and preset references. The presets themselves remain. Export first if you might need to recover it.

If a save fails, the draft stays in the form. Correct validation errors or retry after resolving a storage/quota failure. If another tab changes or restores the library, even a change elsewhere in the library, the stale save is refused. Copy text you want to retain, choose **Reload saved library**, confirm discarding the stale draft, and reopen the current record before reapplying it. There is no automatic merge. Keep one authoring tab for ordinary work. A database version change closes the connection; copy your draft text before reloading the page.

Existing mastery and review dates are preserved. Mastery is read only; new cards use mastery 0, no last review and the existing numeric due default. Imported optional annotations are preserved. To avoid silently changing future recitation behavior, this editor refuses deletion of a referenced recitation step or a move that changes the relative order of recitation references. Annotation management belongs to a later stage; ordinary unannotated chains support all step operations.

The sample speech player is still a separate proof and does **not** play authored cards yet. Scheduling, mastery management, library playback and full Android authoring are not part of Stage 4. The Android Data panel accepts the same JSON format. Desktop cold offline launch is not available yet; an already-loaded editor can use local storage without networking.

For a disposable owner trial use **https://crownandcall.com/SR/index.html?test=SRLearning-test-owner-editor**. Its Data link preserves that test database selection. Do not use a personal library for destructive acceptance testing.
