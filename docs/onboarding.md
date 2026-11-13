# Interactive onboarding

For code ownership, entry points and validation, see the
[developer handbook](developer/README.md) and
[product-system map](developer/product-systems.md).

## Current interaction contract

The guide observes typed activity from the real controls and successful operation
boundaries. It does not infer success from a submit-button click or a DOM mutation.
Each action step declares ordered requirements in the lesson metadata. Alternative
events can satisfy a single requirement, such as applying or cancelling filters.
The user sees a checklist and a brief completion announcement before automatic
navigation. Concept-only steps use explicit continuation.

The coach panel uses a muted rainbow border; contextual interactive controls keep
the vivid rainbow outline so the next user action stands out from the guidance.
The relevant component container stays sharp, but only its actionable controls
receive outlines. Single-action steps pick one visible trigger: an active
dialog/panel takes precedence over page controls, which take precedence over
navigation and collapsed-menu fallbacks. Selector order breaks ties; offscreen,
fully clipped, hidden and disabled triggers are excluded. Forms retain distinct fields
and choices while equivalent buttons are deduplicated. Paired window restoration
targets the same window (or its group), not an unrelated minimized window.
Opening the mobile navigation sheet brings its requested link into view once,
without repeatedly snapping back when the member deliberately scrolls the sheet.
Ordered tab and playback actions highlight only the next required control, not
both choices.
Successful actions also declare result regions: the selected collection or search
matches, player, opened editor/window, minimized group, Workspace Explorer, share
confirmation, friend list or conversation. These stay sharp and outlined alongside
the next action, including during completion confirmation. Unrelated or failed
actions do not reveal results. Window results are scoped to the interacted subject.
If results are below the fold, their own scroll viewport reveals them once without
moving keyboard focus or repeatedly overriding deliberate scrolling.

The introductory lesson now has three distinct domain journeys: Dubs, Samples,
then Vocals. Each visits its discovery vault, own uploads and received shares.
Vault and upload steps compare files and packs; received shares are one combined
collection, so no nonexistent Files/Packs action is required there. The guide
explains that the layout repeats but the collections are separate. A domain-skip
button moves past the remaining steps for that domain without awarding completion;
Back/replay remain available. No uploads or shares are needed for this lesson.
Moving to another step resets only the coach's reading position, so its next
action is visible without moving keyboard focus or scrolling the collection.

Find and play follows the currently selected Dub, Sample or Vocal vault, including
switching vaults mid-step, and keeps that vault for subsequent search/filter steps.
Leaving these collections shows an explicit return instruction instead of silently
ignoring input under apparently valid highlights.
The coach defaults to the bottom-right above app chrome and the right-hand panel.
Placement avoids the entire focused component and result regions, not just button
outlines. It follows scrolling, resizing and layout changes, moving to the nearest
clear position before using a compact action summary or icon-sized pause control.
Fullscreen sheets focus their relevant field groups and footer rather than treating
the entire screen as a single control. If even the compact control cannot fit, the
guide explicitly pauses without losing progress instead of obscuring focused UI;
Show guide resumes it. Automatic compacting alone does not pause action tracking.
Unrelated floating workspace controls are temporarily inert during focused steps,
so their blurred footprint cannot intercept search or filter clicks. Hiding or
leaving the guide restores their original interaction state.

Each step has its own three-part mini workflow, rather than repeating a generic
lesson diagram. A lesson-position bar shows the current step (not completion).
The next-action card names the current ordered requirement and changes to a
completion confirmation only after success. The checklist emphasizes that same
requirement; task details and concept tips can be expanded separately.
Short mobile layouts hide the diagram, but retain the action card and navigation.
Unrelated open editor windows are temporarily inert too, preventing a preserved
pack/upload window from blocking the collection tabs underneath it.

Workspace guidance provides an explicit Open Workspace Explorer action, so
revealing the Explorer cannot remove the button the member was told to click.
Sharing separates audience selection from applying/cancelling filters. Friends
guidance highlights lookup/Add rather than Remove/Profile, and messaging focuses
on recipients and the composer. Unapproved members reach the A-List application
information instead of an inaccessible feed; applying is not required.

- Page/form revelation by the tutorial is not a user action.
- Search requires a non-blank input followed by clearing it.
- Play/pause and minimize/restore pairs must refer to the same track/window.
- Normal navigation, collection tabs, filters and upload choices report actual
  user interactions, including keyboard interactions.
- Uploads, pack saves, friend additions, messages and media sharing count after
  successful operations. Invalid input and failed requests never count.
- A named workspace save counts after its exact checkpoint is acknowledged by
  the persistence request, not when the Save button is clicked.
- Activity is ignored while the guide is minimized or its checklist is open.
  Switching steps cancels pending automatic progression. Completed actions remain
  checked when going Back; starting/replaying a lesson resets its action checklist.
- Automatic progression does not focus the coach heading. Start, Back and Resume
  retain explicit navigation focus behavior.
- Non-modal tutorial sheets are mounted at the document root, above app chrome
  and below the spotlight, so mobile footer navigation cannot intercept their
  Apply/Cancel buttons. On short mobile viewports the coach uses a smaller,
  scrollable layout without the decorative workflow strip to leave search
  controls accessible.
- Skipping remains possible, including when there is no music or recipient.
  Skipped action requirements do not mark a lesson complete.
- Lesson-completion save failures leave a retry button and retain satisfied
  requirements, avoiding duplicate uploads, shares or messages.

Uploads, publishing, sending, access grants and workspace changes are always
performed by the user. Task copy explicitly identifies real changes. The guide
does not require deleting, discarding work or applying for A-List access.

## Improvement ideas

These are follow-ups, not implemented behavior:

1. **Persist partial progress.** Save the active lesson, step and requirement
   progress per platform so reloads can resume naturally. Store only action IDs,
   never search strings, message contents or uploaded filenames.
2. **Availability-aware prerequisites.** Explain missing music, eligible recipients
   or permissions before starting an action step. Offer a clear route to prepare
   them or skip, without silently awarding completion.
3. **Branch the upload lesson.** Offer distinct single-file, Sample Pack and Vocal
   Pack paths instead of sharing one file-preparation step. Keep existing drafts
   intact when switching paths.
4. **Offer an isolated practice mode.** Let new members learn uploading, sharing
   and messaging with disposable fixtures and a test recipient. Clearly
   distinguish this from real uploads, grants and sends.
5. **Compact minimized workspace chrome.** At 320 by 568, minimized workspace
   controls can overlap collection controls independently of the coach. Make that
   footprint smaller without losing access outside the guide.
6. **Optional manual progression.** Offer a preference to retain completion
   confirmation until Continue is pressed, for users who need more reading time.
7. **Recover from unavailable context.** If the paired track/window disappears
   mid-step, explain why the remaining action cannot complete and offer restarting
   that step or skipping it without losing unrelated work.
