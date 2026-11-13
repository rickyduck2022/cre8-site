# Dub, Sample and Vocal Packs

Developer entry point: [product-system map](developer/product-systems.md).

Packs are ordered releases made from an uploader's own audio files. They are separate
from listening crates: a crate organises listening, while a pack publishes and
shares a collection.

## Getting started and tutorials

The account menu's **Help & tutorials** opens a replayable, six-lesson checklist:
media and packs; browsing and playback; windows and workspaces; uploading;
sharing and A-List; and Library, friends and Messenger.

Signed-in members receive a non-blocking welcome offer separately on desktop
and mobile (the shared 760px breakpoint). **Get started** or **Not now**
acknowledges that platform's offer. Completion and dismissal are saved per
account across devices, independently for each platform. Workspace restoration
retains priority: onboarding never opens a blocking dialog automatically.

The overview uses numbered lesson cards, workflow icons, completion progress and
a suggested next lesson. Walkthroughs use a bottom-right, non-modal coach that
repositions to avoid the focused controls and results, with
visual workflow cues and a short task. **Concept & tips** expands the explanation;
**Hide guide** minimizes to a compact bar without losing the current step.
While a walkthrough is expanded, unrelated UI is blurred and dimmed; the guide
and that step's contextual controls stay clear and interactive. The spotlight
uses a rainbow guide outline combining the existing orange, Dub turquoise,
Sample green and Vocal violet primary accents. All highlighted UI components
use the same rainbow outline; the guide has only its own single border,
tracking navigation, scrolling, filters and newly opened dialogs. Minimizing,
skipping or closing the walkthrough removes the focus effect, restoring the
normal app view without resetting the step.
The focus overlay is mounted at the document root and covers the entire viewport,
including the sidebar. Each step explicitly selects its relevant interactive
controls, including navigation links and section toggles when navigation is the
task. Unrelated dialogs, menus, windows and sidebar sections remain dimmed;
disabled, hidden and inert controls are not highlighted.
Starting a lesson, moving Next/Back (including Skip step), resuming, or using
**Return to this step** navigates to the matching collection and reveals search,
filters, the upload chooser or Workspace Explorer as appropriate. Reveal requests
run once per guide navigation, so ordinary typing and manual control changes do
not reset the journey. Draft filters survive Next/Back without being applied.
Existing upload edits are retained; only a clean upload opened by the guide can
close automatically when moving to another topic. Playback, file submission,
sending, publishing, workspace saving and discarding remain manual. On mobile,
tutorial-opened filters and Workspace Explorer are non-modal so guide navigation stays usable;
the normal blocking startup/restoration flow is unchanged.
Mobile feature windows revealed during a guided step also stay non-modal for
that opening. Reopening them outside the guide restores their normal modal
behavior, without losing editor content.
It stays inside the content area, above the footer/player and away from header
actions. The overview remains available through Help.
Their destination buttons navigate real app pages, open the Upload chooser,
or open an accessible file window, but never start playback, submit uploads,
publish, grant access, send messages, or save/discard workspaces automatically.
Action steps show ordered requirements. Real inputs and successful actions check
them off, announce completion, then advance after a brief confirmation. Revealing
a page or form automatically does not satisfy its task. Search requires typing
and clearing; playback requires playing and pausing the same file; window
restoration must match the window minimized in that step. Concept-only steps
remain self-paced. Automatic progression does not move focus into the guide.

Uploads, saving a pack/workspace, adding friends, sharing and messages require
the actual successful action where specified. These are real changes, never
performed by the guide. Failed validation or requests do not satisfy requirements.
**Skip step** and **Skip lesson** remain available, but skipped action requirements
do not earn lesson completion. A lesson is saved as complete only after all its
required actions and the progress save succeed; failed saves remain retryable
without repeating uploads or sends. Replays start with fresh action requirements.
Paused guides and the checklist ignore activity, and pending advancement is
cancelled when leaving a step.

Empty collections have safe skip instructions, and opening a file with no
available music reports that explicitly. A-List does not require applying for
approval or changing permissions; no task requires deleting or discarding work.
Switching between mobile and desktop resets the active walkthrough to that
platform's checklist without merging completion.
See [interactive onboarding](onboarding.md) for action contracts and improvement ideas.

## Browse the vaults

**Dub Vault** contains dubs and Dub Packs. **Sample Vault** is a separate
navigation destination (`#samples`; available in More on mobile) containing
Sample Packs and their samples. **Vocal Vault** (`#vocals`, also in More)
contains vocals and Vocal Packs. All three reuse the same release cards, ordered
playlists, sorting and search components, with independent distribution filters.
Navigation counts include files in the matching public feed, not pack cards.

Individual uploads offer **Dub** or **Vocal**, including when sharing privately
or to A-List. Published Vocal Pack membership also classifies a file as a vocal.
Vocal classification takes priority over published Sample Pack membership,
which otherwise classifies a file as a sample. Files with neither classification
are dubs. Draft membership never reclassifies a file. Removing published membership
recomputes classification; explicit Vocal uploads remain vocals. Ordinary metadata
edits preserve that distinction. No media or access grants are duplicated.
Private releases remain opt-in through the distribution filter.

The **Dubs / Samples / Vocals** navigation groups are independent collapsible
menus on desktop and in mobile More. Their toggle backgrounds use the matching
turquoise/green/violet primary media accent. The current section starts expanded;
navigating into another group reveals its current link automatically.
Nested links use compact tree indentation, with quieter selected states and
short visible names: **Explore vault**, **Your uploads**, and **Shared with you**.
Their accessible names retain the full media-specific destinations.

**My Uploads** (`#all-uploads`, retained for existing links) is a separate navigation item below Vocals.
It contains only the signed-in member's files and packs, including draft packs.
Files/Packs tabs and full expandable filters narrow the collection without
mixing in other members' public or shared releases. Media type and audience
apply to the file or pack itself. Pack title search and file-detail criteria
combine: all active tags/BPM/format/bitrate criteria must match one same member
file. Empty drafts remain visible unless file-detail criteria are selected.
All audiences, including Private, start included. Filter selections persist
across Files/Packs, and counts reflect the loaded owned collection.
**Start an upload** opens the media-type and Single file / Pack chooser.
**Open pack** opens the regular pack window rather than its editor. Owners can
play nonempty drafts there or from the pack card; draft downloads and sharing
remain unavailable until publication. Empty packs cannot play.

**Full Library** (`#full-library`) lists every track in the account's authorized
community snapshot across Dubs, Samples and Vocals, including owned and shared
private tracks. It provides media-type, audience and metadata filters without
inventing download dates or granting additional access. **My Library** remains
the separate download-history collection.
Owner-only draft-pack files arrive in the snapshot's separate `draftDubs`
catalog, available to the player and Full Library but excluded from vault
discovery and other accounts. Removing them from a subsequent snapshot stops
their playback; pack queue membership remains exact.

Each owned-media page offers exactly **Add Dub / Sample / Vocal** and **Add Pack**
above the file/pack views. Add Dub and Add Vocal open a dedicated form locked to
that type, without upload-mode tabs. Add Sample starts a Sample Pack: sample
classification remains pack-derived and requires publishing with usage terms.
Add Pack starts a pack of the current section's type. The same two actions stay
available on the Packs view; no duplicate create-pack control is shown there.
The global header's **Upload** action instead opens a chooser for media type
and Single file / Pack. Choosing Sample starts a Sample Pack; samples cannot
be uploaded independently. Changing choices or closing the dialog confirms
before discarding unsaved form or pack details. Busy submissions disable
switching. Owned-page actions keep their contextual type locked.

**Your Vocals** (`#my-vocals`) offers Files/Packs, editing, access management,
deletion and **Add Vocal**.
**Vocals shared with you** (`#shared-vocals`) separates received vocal files and
packs from public discovery. Profiles, My Library, Messenger attachments,
external shares, search, single-file workspace windows and pack queues all retain
the media identity. Vocal navigation uses a microphone; media controls, selected
tabs and workspace borders use the shared violet palette. A-List orange still wins.

Vocal Packs, like Sample Packs, require explicit usage licence terms before
publishing or saving published edits. Their ZIP downloads include `LICENCE.txt`.
Individual download access alone does not grant permission to reuse a vocal:
check the creator's terms. Pack playback keeps exact ordered membership and queue
identity, even when a file belongs to several releases.

Dub Packs accept only dubs; Sample Packs accept samples and vocals; Vocal Packs
accept only vocals. New audio added inside a pack uses that pack's type.
Existing-file pickers disable incompatible types or audiences and explain why.
Already selected incompatible files can be removed after a type change.
Save, publish and direct API membership edits validate the same rules; changing
a file's explicit type cannot invalidate a published pack. Remove incompatible
memberships first. Draft-only files do not reclassify other releases.

Opening an app window with no running Draft or saved workspace automatically
activates Draft Workspace and shows the window on the first request. Merely
inspecting a saved workspace does not make it the destination for app opens.
Explicit Explorer dependency additions and workspace opens keep their selected
destination. Saved workspaces and editor close guards are preserved.
Focus/open actions also reveal Hidden windows and restore minimized targets on
the first click, including grouped tabs, without switching the running workspace.

On its first desktop open, an unarranged window measures its content and expands
to fit, up to the available viewport with an 8px edge margin. Small windows also
avoid unnecessary empty height. Scrollbars remain available when content cannot
fit on screen. Saved/restored sizes and manually resized windows are not fitted
again. A new tab may grow its floating group to fit its content, without shrinking
the group's existing dimensions. Docking and full-screen layouts stay unchanged.
Reopening or switching previously opened tabs does not keep resizing a window.
Mobile windows stay full-screen.

The window manager lists Dubs, Samples and Vocals under separate headers, with
group counts. Existing tab groups stay intact; mixed-type groups and non-media
windows appear under **Mixed & other windows**. Empty sections are hidden, and
minimized windows remain in their media section.

A-List releases use dark card backgrounds, orange borders and explicit
audience labels across individual files, pack cards and pack detail headers.
Players use a dark background with light text and orange waveforms and transport
controls, plus an A-List release label where space allows. All media accents
inside A-List releases and packs use orange, including Sample Pack actions.
This identifies release distribution, not just an approved artist:
worldwide releases by approved artists retain their normal card styling.
Non-A-List Dub/Sample/Vocal playback controls retain turquoise/green/violet palettes.

The vaults offer **Dubs / Packs** or **Packs / Samples** views using
the same shared raised collection tabs as docked pack windows, with
Left/Right wrapping and Home/End selection, roving keyboard focus and a labelled
results panel. Sample Vault defaults to Packs; Dub Vault defaults to Dubs and
Vocal Vault defaults to Vocals. Vocal tabs use `--audio-vocal-active`.
Sample collection and pack-window tabs use the green
`--audio-sample-active` token for their selected indicator and keyboard focus;
Dub tabs use `--audio-dub-active`. The strip behind the tabs stays transparent
in both themes; individual tabs retain their raised, hover and selected states.
Shared palette contract tests enforce these
mappings, including on A-List packs. Filters and sorting remain unchanged when
selecting a tab. The file view
shows individual files, including pack members; **Packs** shows published packs
in a two-column grid when the content area has room, collapsing to one column on
narrow screens. Search, audience filters and sorting stay applied when switching;
each view paginates independently of the other content type. Mobile vaults put
a title-only heading and tabs beside a Search and filters
toggle in the fixed collection header. Search and sort start collapsed but
retain their state, show the active search/filter count, and surface errors.
Expanded controls scroll within the header on short screens so pack playback
and the fixed footer retain space. On desktop, the tabs and search controls
stick together above the scrolling collection.

The header's sun/moon control switches between dark and light appearance.
On mobile, use **Account menu > Light theme** to keep the header uncluttered.
The sign-in screen also has a theme control. Dark is the initial default;
the browser remembers changes and synchronizes them across tabs. The shared
design-system provider applies the theme at the document root, including
floating windows and menus. Media colours and the dark A-List treatment remain
independent of the chosen appearance. Light theme overrides are exported as
`lightThemeTokens` by `@craft/tokens` and mirrored in CSS and JSON.

Each grid pack card reuses the shared pack identity and includes its own audio
player, with pack-scoped transport and seeking. Open, playlist, ZIP and share
actions fill a two-column button grid rather than a crowded action row; playback
also has a full-width **Play pack / Pause pack** button above the other card
actions, using the same exact pack queue as the embedded player. Across pack
cards, **Open pack** sits beside **Share pack** in the main actions.
Both use the shared orange primary button variant, including workspace Open and
pack-view Share actions. Open pack includes a folder icon. Playback retains the
blue/turquoise Dub and green Sample media variants.
The full-width card playback button has the same 44px minimum height as the
other card actions. Play pack also expands the inline playlist, matching Show
tracks/samples; pausing leaves it open. Player transport, volume, share/download
and layout controls use solid icon variants in every player mode without
changing unrelated navigation icons.
Owner-only **Edit pack** and **Delete pack** sit in a dedicated two-button
control row below the other actions, separated by a divider. Both owner controls stay
visible on mobile instead of moving into the overflow menu.
Deletion requires confirmation, preserves the underlying files, and reports
failures inline so owners can retry.
**Show tracks / samples** expands an ordered,
scrollable playlist using the shared DubCard playlist variant. **Play all** and
**Download ZIP** operate on the whole pack; individual playback, seeking and
downloads remain available in the expanded list.

On mobile, ordinary media card actions stay on one row; actions that do not fit move
into the card's **More actions** menu. This applies to release cards, playlist
files and pack workspace cards. Expanding a pack highlights its playlist
toggle in the release's media colour (orange for A-List) until it is collapsed.
Vault grid pack cards instead keep their actions visible in the button grid.
Shared audio volume controls are borderless and offer **Mute / Unmute**, restoring
the last audible volume (70% when first opened muted). Narrow vault cards retain
the mute button while hiding the slider to leave room for transport.

Owners can choose **Edit pack** directly from their pack workspace cards or
owned release cards in the vault, Your Dubs/Samples and their profile. The button
sits beside **Delete pack** in the separated control row. Other members do not
see either control. Opening the editor fetches the
latest saved details and file order, with retry/cancel controls if loading fails.
Existing drafts use **Edit pack**; newly created packs use **Create pack**.
Published edits use **Save changes**, without republishing or changing the
audience. Saved changes update connected members' views. Cancel/close warns
before discarding unsaved edits, and reload/closing the browser warns while
edits or saves are pending. A failed save keeps the form; a successful save
followed by a failed community refresh offers **Retry refresh** without writing
the pack again. File ordering, title/description, type/licence and replacement
artwork remain editable; private additions still require access confirmation.

Search includes accessible published pack titles and descriptions. Filters
retain matching files inside the playlist, with a matching count and an
**Open pack** action for the full release. Opening a pack does not start or
replace playback. Each pack retains its full ordered playlist, playback, download
and owner controls. New pack opens automatically snap onto the most recently
active window or group made purely of the same type (a pure Dub Pack or pure
Sample Pack group), retaining that window's position, size and placement
(floating, docked or full screen). Mixed groups are allowed through explicit
drags or **Window options > Move to group**, but a mixed group never captures newly opened packs. A minimized
pure target is restored when a newly opened pack automatically joins it. Reopening the same pack selects
its existing window/tab rather than duplicating it.

On desktop, pack windows are non-blocking: use the **Move** handle to drag or move with
arrow keys (**Home** resets), drag to the left/right edge to dock, or use the
position selector. The whole title bar is draggable except its controls. Drag the bottom corner to resize a floating window, or the
inner bottom corner to resize a dock's width. Arrow keys resize in 16px steps
(**Shift** for larger steps, **Home** resets size); sizes stay within the viewport.
Windows retain their floating size through docking, minimization and full screen.
Separate groups and standalone windows docked on the same side stack vertically,
sharing the available height with a gap between frames; docking never merges them.
Docking a grouped window moves its whole group. Within each group, only the
selected playlist is visible, while the other packs remain mounted. Select a tab
or use **Left/Right**, **Home/End** to switch packs without starting playback.
Each tab carries its own media-kind accent (green for samples, turquoise for
dubs); a group made of one kind colours the whole strip with that accent.
Left and right docks are independent; resizing a dock's width applies to every
group in that region. Dock stacks compact when a group leaves or closes.
Minimizing, maximizing or closing affects only the selected
pack; remaining tabs stay docked, and a single remaining pack no longer needs a
tab bar. Reopening an already docked pack selects its existing tab.
Drag a window's **Move** handle over another window's title bar or tab strip to
group any mix of Dub Packs and Sample Packs; the highlighted
preview confirms the target before release. This
works for floating windows and existing docked groups. Dragging a floating
group's Move handle moves the group, and resizing keeps every member the same
size. Dropping that group at a screen edge docks its members together.
Drag a tab out of the tab strip to tear that pack out into its own floating
window at the release point; a ghost label previews the tear-out while dragging.
Open the header's **Window options** menu and choose **Ungroup** to detach the
selected pack (or use the position selector).
Minimizing hides only that pack and retains its group membership; closing removes
only that pack. Other members keep their state. Hidden tabs remain available in
the group's minimized container, even when only one tab is hidden.
Drag tabs within a strip to reorder without selecting or playing another tab.
**Alt+Left/Right** or **Window options > Move tab left/right** provides the same
ordering without dragging. Tab order is independent of activation order and
survives account workspace restoration.
Drop a window header or a torn-out tab onto a minimized group to add it without
restoring the destination or starting playback. A highlighted preview says
**Release to add to group**. Header drags move the source group; tab drags and
**Move to group** move only the selected tab. The menu's destination selector
also works on mobile and includes minimized groups.
Groups have stable names, initially taken from their first window; **Rename group**
is available in the window or minimized-container menu. The container shows
the name, total/hidden tab count and the playing track when present.
Grouping, ungrouping and tab reordering offer **Undo** for eight seconds.
Undo restores the previous groups, tab order, frames and minimized state without
changing audio or reopening windows closed since the action. Cancelled drags do
not change the arrangement.
Tabs use a raised, top-accented selected shape that connects to the content
surface, with darker inactive tabs, through shared `--window-tab-*` tokens.
The community app adds a restrained record-archive/studio-rack treatment, not a
literal safe theme. The cre8 mark, navigation names, media/audience colours and
playback behavior stay unchanged. `VaultLabel` supplies small catalogue labels;
the opt-in `vault-theme` uses shared `vault-panel` and `vault-rack` utilities for
fine inset edges and decorative hardware. All colours and shadows are owned by
the synchronized `--vault-*` tokens. Pack windows opt in on their portal layer
so the treatment survives grouping and docking without changing window focus cues.
Vault pages have a compact visible collection heading; pack workspaces keep their
existing create, search, draft and edit workflows beneath a release-archive label.
On small screens the described app header puts search on its own full-width row
to preserve readable input and access to messages, notifications and upload.
Single windows and tab groups share one compact minimized dock. Each container
uses the conversation-style title/restore, playback and options controls; grouped
containers also show their individual tabs with restore/play/close actions.
The dock scrolls on short screens and horizontally on mobile, remaining above
restored windows. All frames use theme-aware `--window-*` roles. Click the title
to restore a window or group; double-click an open window's title bar to minimize.
Closing a window compacts the dock. Contents remain mounted while minimized.
Header and content corners follow the inner frame radius, including all four
corners on minimized headers, without clipping window menus.
Dark headers and borders use the shared dark canvas, control and border roles;
light mode uses their light counterparts, retaining the shared focus cue.
Window controls use a horizontal line for minimize, a square for maximize and
overlapping squares for restore. Maximize restores the previous floating frame
or dock when toggled back. Headers, tabs and controls do not select text during
mouse interaction; content text and editable fields remain selectable.
The active window has a tinted header, labelled status indicator and stronger
outer shadow. Inactive frame borders follow the current theme's neutral border;
the focused frame uses the primary action colour. All window colours,
focus treatment and shadows come from shared `--window-*` design tokens.
Clicking a window brings it forward; closing one leaves other windows and
playback untouched. In the app workspace, clicking, tapping, scrolling or using
the keyboard outside the window system temporarily **hides** its windows without
changing their minimized state, selection, drafts, grouping or frames, or pausing
audio. Opening a new window or requesting an existing window reveals the previous
non-minimized windows too. **Show windows** in the manager restores the workspace
without opening anything new. Deliberately minimized windows stay minimized.
Window controls, menus, Explorer and main-player controls are inside the window
system; programmatic focus changes alone do not hide windows.
New floating windows cascade diagonally in 32-pixel steps, bounded by the
viewport, so earlier headers remain reachable. Saved/moved frames are retained;
mobile continues to show one fullscreen sheet at a time.

Standalone WindowLayer consumers retain their outside-minimize dock behavior:
Only windows newly minimized by an outside interaction receive a four-second
highlight, using `--window-highlight-*` roles, with a screen-reader announcement.
The follow-up click does not restart the timer; manually minimized windows are
not highlighted. Reduced-motion preferences disable the color transition.
Outside minimization also captures a small, faded preview of each group's last
visible view. Previews are inert, session-only visual snapshots: they do not
mount another player or form, and disappear when their source is restored or
closed. Password/file fields and embedded media are excluded. The translucent
dock has inset padding around its scrollable group containers. **Collapse
minimized windows** reduces the entire dock to one **Windows (count)** button;
expanding it retains groups, previews, drafts and playback. The collapsed button
keeps the timed highlight and audible indicator.
Minimized tabs belonging to the same group share a labelled container, with
individual restore/play controls and **Restore group** to bring every tab back
in its existing arrangement. **Window options > Minimize group** tucks away the
entire group; the normal minimize button still minimizes only that tab.
Contents stay mounted and the group stays intact when minimized together.
Community feature dialogs (uploads, profile editing, sharing and other
feature sheets) use these same windows, automatically joining one shared
dialog group by default. Their tabs have a white/neutral border identity
through `--window-dialog-tab-border`, with normal shared tab backgrounds and
theme-aware contrast, distinct from sample and dub accents, including
in manually mixed groups. They support normal minimizing, docking, tab movement
and grouping with media windows. Forms and drafts stay mounted while hidden;
submission locks still prevent closing and footer actions retain their form
association. Feature drafts/windows are session-only, not included in account
workspace saves. Sign-in, destructive confirmations and the admin console retain
blocking modal behavior. Collection filters are a separate content-area takeover
on desktop and blocking full-height filter sheet on mobile, not workspace tabs.
Profile links open reusable, persistent profile windows instead of navigating
away. Profiles, conversations and shared media join the matching user's group
regardless of which was opened first; different users do not automatically join.
Message from a profile opens its conversation in that group. Profile deep links
remain supported as pages.
Single-dub upload, pack creation, adding an existing track to a pack and pack
editing use the same upload window journey. Switching upload type keeps both
drafts mounted, does not navigate away or create a second pack. Pending pack
operations lock window close/type switching; closing unsaved pack edits asks
for confirmation. Upload drafts remain session-only.
Mobile uses a full-screen modal for the active pack. When
more than one window is open, an **Open windows** tab strip inside the modal
switches between them; the minimize button hides the modal and adds the window
to a bottom restore bar above the mobile navigation, keeping its contents
mounted. Closing the modal returns to the previous open pack, if any. Desktop
placements survive viewport
changes within the session. Window contents scroll without moving the title bar.

Stacking is owned by shared `--layer-*` tokens: mini-player snap hints,
mini-player, windows, popovers and notifications, in that order. `WindowLayer`
portals desktop windows into an isolated stacking context; per-window ranks are
local to that layer, so opening more packs cannot raise them above popovers or
notifications. Pointer/focus activation raises a window without changing its
placement. Native modal dialogs (including mobile packs) use the browser's top
layer rather than competing with CSS z-index values.

The shared UI `FloatingWindow` and `useWindowPosition` provide window chrome,
pointer capture, keyboard movement, viewport clamping and snap previews. The
mobile mini-player uses the same movement engine with its own header, footer
and edge-docking policies. Desktop playback controls always stay in the footer.
Only the active pack's tracklist appears in the right bar alongside workspace controls.
The global player can collapse and expand in place, but cannot pop out, close,
drag or become a grouped window. Legacy saved Player windows restore their track
paused in the global player rather than recreating a floating window.
Each published, non-empty pack window has its own player by default, initially
showing the first file without starting playback. During the signed-in session,
each pack remembers its selected track, position, shuffle/repeat settings and
queue navigation history when playback moves elsewhere. Only one shared audio
engine plays at a time: starting another window pauses the previous context,
and returning to it resumes its remembered position. Opening, focusing,
grouping or minimizing a pack does not start or interrupt audio. The main app
player always displays and controls the actual loaded audio, including playback
from a window, even when focus moves to another group or outside the window system.
Pack queues remain exact: previous, next, shuffle
and repeat never spill into another tab's files. Each tracklist retains its own
position and modes. Focusing a group or selecting a tracklist only changes the
window's selected tracklist; the global player stays on loaded audio until an explicit playback action.
Using any window's play/pause, seek or queue navigation selects that window's
queue in the main controller, including controls in minimized groups. Changing
a window's shuffle/repeat updates its own settings without replacing another
audible queue in the global player. Each window retains its own saved progress
and settings; no duplicate audio engine or merged cross-pack queue is introduced.
The same selector appears inside grouped media windows, so tracklists remain
reachable in mobile full-screen windows. Explicitly playing a standalone file
restores the separate global context and clears pack queue identity, even if the
file also belongs to the pack previously playing. Saved contexts keep independent
positions and queues. Volume remains shared. Minimizing or closing a content
window does not hide its loaded audio from the global player.
Window players use the shared single-column layout so transport and seeking
remain inside narrow docked windows and mobile sheets.
Drag any non-control part of a window header to move, dock or group it; buttons,
the position selector and menu items keep their normal behavior. The Move button
also remains available for keyboard movement.

Each window's **Window options > Rename window** changes its display name
without renaming the underlying pack or contact. Press
Enter to save or Escape to cancel. Playback-capable windows show play/pause
controls even while minimized. A playing window and its containing tab group
show the same audio dot badge as the site's **Now playing** identifier; the group
control pauses the playing child tab.

Messenger conversation headers offer **Open conversation in a window**.
Conversation windows stay synchronized with Messenger, support the same
grouping, docking, resizing and minimization as packs, and retain
their drafts while minimized. Reopening an existing chat restores that window
instead of duplicating it. Closing it leaves Messenger and its conversation
available; messages and playback continue to use the shared app state.

Opening a pack, track or sample from a Messenger message opens that media and
its conversation as a tab group. Sharing through Messenger's picker does the
same after a successful send. If the conversation already has a window, the
media joins that existing group instead of duplicating the chat. Other tabs
already in that conversation group stay in place; unrelated source groups are
not pulled across. Individual tracks and samples have a dedicated window player
that shares the app's single audible engine and remembers its context for the
current session.

## Workspaces and saved arrangements

**Workspace** is the composition tier above templates. The user journey is:

1. **Workspaces** is the top-level view: Draft Workspace and saved workspaces
   are peers. Workspaces are not floating windows or nested window containers.
2. Opening a workspace immediately opens all its dependency windows and groups,
   preserving their tabs, and displays the running window manager. There is no
   intermediate dependency selection step, including for empty workspaces.
3. **Manage** separately displays the workspace catalog, grouped tab previews,
   content picker and naming controls. **Open Workspace** opens the whole
   workspace from that viewer. Neither opening journey starts audio.
4. Opening another workspace clears the running window manager and pauses the
   previous workspace's playback. Previous windows are suspended, not destroyed:
   live drafts, tab membership, arrangement and audio positions remain available
   for that session. Revisiting opens the entire workspace, not a saved subset.

The taxonomy is `workspaces: [Draft Workspace, ...savedWorkspaces]`, each owning
its dependency windows/groups. A dependency belongs to one workspace; moving a
group retains its tabs and drafts rather than duplicating it. Window options
provide **Move to workspace** and **Move to Draft Workspace**. Floating workspace
drop targets and nested workspace creation are intentionally removed. Legacy
nested workspace records become flat peer entries; their dependency layouts
are preserved and obsolete workspace-shell windows are removed when saved.
Saved snapshots reconcile each window against its current owner and clear legacy
workspace-to-workspace links, so transfers and stale layer updates cannot publish
duplicate membership or dangling dependencies.

On desktop, Explorer, the Workspaces launcher and the runtime window manager
live in the right bar, sharing that column with the active pack tracklist rather than floating
over content. Desktop windows can move over that bar within the full workspace;
slim edge guides indicate docking without covering the content with wide outlines.
The right bar stops above the measured desktop footer player, updating when the
player resizes or collapses so pinned workspace actions remain visible.
The dependency list scrolls independently of its pinned primary
action. The tracklist retains its dark controller background to distinguish it
from workspace browsing. Collapsing the footer player leaves the tracklist and
workspace controls available. Mobile retains the fullscreen Explorer sheet and floating launcher.
Collapsing the sidebar tracklist reduces it to its header and gives the freed
height to Workspace Explorer; expanding restores the shared sidebar layout.
Explorer uses a single header with back navigation, full-row workspace choices
that open all windows immediately, without a dependency selection step.
Separate **Manage** actions open content and naming controls. Settings sit below the main workflow; launchers
stay hidden while browsing to avoid duplicate navigation. Minimizing returns
keyboard focus to the Workspaces launcher.
On app entry, saved windows stay hidden while the workspace manager offers
**Load previous workspace** or **Start empty Draft**. The resume target remembers
the running workspace independently of the last inspected catalog; legacy
layouts fall back to their viewed workspace or first saved workspace.
New accounts, and sessions with nothing to resume, go straight to an empty Draft.
Loading never starts playback. Starting blank closes windows across Draft and
saved workspaces but keeps named workspace layouts. Draft windows require
**Save and start blank**, **Discard Draft and start blank**, or **Cancel**;
saving names and preserves the Draft as a saved workspace. Busy windows block
the transition and editor close guards still prompt for unsaved content.
**Review unsaved windows** reveals any editor awaiting a decision.
Named layouts remain recoverable when starting blank; their last explicit save
checkpoints are not changed by this action.
No replacement layout is persisted until the startup decision completes.
**Open Workspace** remains explicit in the management viewer.
Clicking a workspace in the library opens it directly,
including windows excluded by legacy saved selections. Unavailable content blocks
opening with an explicit error rather than silently opening only part of a workspace.
**Minimize all windows** is available in both Explorer and the running window
manager, using stacked windows with a downward arrow rather than the single
window's minimize bar. It minimizes every open window in the active workspace, preserves
drafts and grouping, and does not pause playback or affect other workspaces.
It is disabled when no active workspace windows can be minimized.
**Open dub, sample or vocal** is available in workspace management and the running
window manager. Choose an individual track and **Open in workspace** to open its
player without starting audio. Existing windows are reused; content owned by
another workspace moves with its grouped tabs, preserving drafts and ownership.
Standalone cards in the Vault, profiles, Library, Shared With Me and Your
Dubs/Samples also offer **Open Dub** or **Open Sample**, with a window icon and
an accessible track-specific label. The action opens the single-track player
in the current workspace without playing, downloading, or opening its pack.
It restores/focuses the existing track window instead of creating duplicates.
An explicit Open request also reveals previously closed windows on the first
click, even when their saved layout was minimized. Passive account restoration
continues to preserve saved minimized states.
Mobile keeps the action in the shared card-action row (or its overflow dialog).
Pack playlist rows retain their existing pack-level opening behavior.
The runtime window manager has its own
minimize control and pinned **Save Workspace** and **Delete Workspace** actions.
Saving a running Draft prompts for a name and keeps its windows open in the new
saved workspace; saving a named workspace preserves its current arrangement.
Draft itself cannot be deleted. Deleting a saved workspace requires confirmation,
and is available directly on its Explorer library entry or in its Manage viewer,
without opening the workspace first. Deleting an inactive workspace leaves the
running workspace and its playback unchanged. Pending editor close confirmations
can be reached with **Show windows** or cancelled from Explorer.
Deletion
closes all its windows (including hidden dependencies), and removes its saved
entry without deleting source packs or tracks. Busy windows block deletion;
editors with unsaved changes must finish closing before the saved entry is removed.
Deletion can be cancelled while waiting for those editors.
**Save Workspace** updates an explicit last-save checkpoint, separately from
the automatically persisted recovery layout. Subsequent changes show **Unsaved
workspace changes**; saving again resets that baseline immediately. Both the
checkpoint and unsaved recovery layout survive reloads. Legacy named workspaces
use their existing layout as their first checkpoint.
**Close Workspace** offers **Save**, **Discard**, and **Cancel** only when there
are changes since the last save (or a nonempty unsaved Draft). Unchanged
workspaces close directly. Save keeps the current layout (prompting for a name
for Draft); Discard restores the last saved arrangement and membership, rather
than the arrangement when the workspace was opened. Within the current session,
dependency transfers also revert to their checkpoint ownership. Both close the workspace's windows and return
to its dependency viewer without deleting the workspace or its source content.
Editor close guards still apply. Discard rolls back workspace layout, not
published edits to packs or tracks.
Its list scrolls
independently, with compact single-line folder rows, aligned 16px icons and
inline actions. Group disclosure arrows hide/show indented tab rows without
minimizing their windows. Nested rows align with the group's label after its
disclosure control; the tree guide and indent scale with desktop/mobile controls.
Long titles truncate with full titles on hover;
mobile keeps larger touch targets. It lists only the active
workspace's opened groups, with existing restore/minimize/play/options controls
and disabled/busy-close safeguards.

Owned packs support **Edit pack** inside their existing window, retaining the
same workspace, tabs and frame. **Add files** accepts direct audio uploads and
existing owned uploads; Next uploads queued files before review. Upload progress,
per-file retries, artist/metadata validation and private-recipient confirmation
use the shared pack editor. The window cannot close during loading/upload/save,
and closing with unsaved edits requires confirmation. Save or Close editor
returns to the pack view without replacing its window.

New users start in **Simple mode**, which bypasses the workspace chooser and
uses only Draft Workspace. Selecting Explorer introduces both modes before
enabling the workspace library. The Simple mode toggle is under **Explorer
settings**; mode and introduction state persist with the signed-in account.
Switching to Simple hides independent workspaces without discarding them.

**Create workspace** makes a named top-level entry, not a floating shell.
**Add dependency** stages content in the inspected workspace without revealing
it until Open Workspace. **Add content** expands the content picker, automatically
shown for empty workspaces; renaming and saving Draft are separate from adding
windows. Feature journeys such as uploads are session-only
dependencies. **Save Draft as workspace** names and transfers the current draft
to a saved peer, leaving a fresh Draft Workspace. Named workspaces automatically
persist recoverable arrangements; only explicit Save updates their saved
checkpoint. Merely focusing a window or playing audio does not mark the layout
as changed. Closing a running dependency does not
remove its catalog membership; available content can be reopened from Explorer.
Unavailable workspace content produces an explicit error instead of a partial
success.

The shared lighter-charcoal palette separates Explorer from the darker app.
Folder icons, breadcrumbs and semantic selection outlines communicate the
filesystem hierarchy. Running workspace entries and other/mixed dependencies
use the main app's dark charcoal palette, with lighter inactive surfaces.
Dependencies use deep green tints for pure Sample groups and deep turquoise
tints for pure Dub groups, with light text rather than bright solid fills.
Restore controls distinguish focused (darker type tint and an inset indicator,
also marked as the current item), open (a separate lighter type tint), minimized
and temporarily hidden states. Mixed/default restore controls use charcoal
rather than orange; individual tabs retain their own media type. Window entries
use an open-eye or crossed-eye icon for visible/hidden state. The focused entry
uses the same visible-eye outline with a filled pupil; its grouped tab receives
the same treatment.
The selected visibility icon and clickable row border use the primary action colour.
The focused window frame uses the same primary action colour for its three-pixel
border, including on mobile.
Visibility indicators consolidate minimized, inactive and workspace-hidden windows
as **Hidden**; open and maximized windows are **Visible**. The selected visible
variant is labelled **Visible (selected)**. Window actions and saved minimization
remain independent of these simplified indicators.
Inactive dependency cards
retain a muted version of their hue. Touch controls retain a 44-pixel minimum.

Notifications and upload activity remain independent, at bottom-right.
Notifications display for five seconds then remain in history until dismissed;
completed/failed upload results display for thirty seconds before handing off
to notifications. Active uploads do not auto-close.

The account layout synchronizes up to 20 saved workspaces, 50 dependencies per
workspace and 200 windows total, preserving frames, custom titles, groups, tab
order, dock widths and minimized state. Legacy Player track selections migrate
to the global player without autoplay. Each layout
retains `openedDependencies` independently from membership for compatibility.
The API validates this subset and removes inaccessible entries from both on
retrieval; opening a workspace now opens all its dependencies, not that subset.
On reload, Explorer offers the startup resume/start-empty choice when there is
an arrangement to recover; saved dependencies do not reveal or start playback
before that decision. Simple mode restores the draft directly.
Saves are debounced and flushed on exit/sign-out; failures use app notifications.
Unsaved form/chat drafts and audio history survive switching within a session
but are not synchronized between devices. Already-open sessions are not
rearranged by remote changes; the last successful saved layout wins.

Pagination counts
release cards, while crates continue to show their individual saved dubs.
Changing page or rows per page returns the relevant list to its top within its
nearest scroll viewport (or the document for full-page lists), without moving
keyboard focus or scrolling an unrelated panel. This also applies to uploads,
received shares, profile collections and paginated friend lists.
Private packs only enter an authorised member's community feed; drafts never
enter the feed.

Collection filters separate **Worldwide** (blue), **Private** (turquoise), and
**A-List** (orange) into labelled audience tiles with descriptions and explicit
Included/Not included states. Audiences and tags each match any selected choice;
different filter sections combine to narrow results. Changes stay in a draft
until **Apply filters**. **Reset choices** restores the collection's defaults
without changing the search text or applying; **Clear search text** preserves
filters, while **Clear search** resets both. Invalid or inverted BPM/bitrate
ranges are explained inline before applying. Mobile filters use a scrollable
full-height dialog with persistent footer actions and a minimal header.

On desktop, opening Filters fills the available collection container directly
below the app header. Only search and the Filters toggle stay above the scrolling
filter body; introductions, sorting and collection tabs are behind the takeover.
The results viewport is inert and scroll-locked until closing. Cancel, Escape
and toggling closed discard unapplied choices and restore the previous results
position; Apply shows matching results from the top. Route changes and breakpoint
changes release the old scroll lock. Filter containers use the media-primary
border and a semantic frosted surface with the modal blur treatment; controls
remain sharp, with opaque fallbacks when backdrop blur is unavailable.

While browsing on mobile, deliberate downward content scrolling compacts the app
header; upward scrolling or returning to the top reveals it. The compact header
retains collection navigation and **Show app header**. Mobile Workspace Explorer
and the window manager start minimized, except for the entry restoration prompt.
Only their explicit controls expand them; content focus and browsing do not
change their manual state. Programmatic search alignment and filter-body scrolling do not
drive this behavior. Focused inputs, open dialogs and workspace naming or
save/discard/delete workflows stay usable. This is presentation only: workspace
ownership, saved layout, windows and playback are unaffected.

Changing collection pages resets both the content viewport and document scroll
to the top. Opening an existing minimized window restores and focuses it.

These colours are design-system roles, not per-page overrides. The token package
owns `--audience-*` and `--release-alist-*`; shared `AudiencePalette.css`,
`MediaPalette.css` and `DistributionSurfaces.css` map them to audience tiles,
media interaction states and release surfaces. Change those roles to theme the
experience consistently. Open pack uses the shared primary Button variant.

In **Your Dubs** and **Your Samples**, the **Dubs/Samples** tab shows individual
files and their statistics only; packs live exclusively in the **Packs** tab.
Published packs also appear on the uploader's profile. Owners see their private
releases; other members' profiles show public releases only. Drafts remain
available in the matching **Your Dubs > Packs** or **Your Samples > Packs** view.

Each owned pack card in that tab shows download statistics underneath its
actions: whole-pack ZIP requests, total downloads of its current files, and
per-track/sample counts. Counts update with community snapshots. File counts
include ZIP requests (one download per member file) and requests made outside
the pack; files shared between packs retain the same global file count.
ZIP requests count once per accepted download action, including repeat requests,
not per member file or completed transfer. ZIP tracking starts with this update;
historical ZIP totals cannot be inferred from existing file records. The ZIP
counter persists with the pack and is only returned to its owner. No database
schema migration is required for this optional pack JSON field.

## Create and edit

Open **Your Dubs > Packs > Create pack** or **Your Samples > Create Sample Pack**, or choose **Dub / Sample Pack** in the
upload dialog. Existing owned dubs also offer **Add to pack** in their actions.

1. Choose **Dub Pack** or **Sample Pack**, enter a title, optional description
   and artwork, and choose the audience before adding files. **Next** validates
   the title and requires non-blank usage licence terms for Sample Packs.
2. Select existing uploads or upload multiple audio files. Each file has its own
   title, artist, optional BPM and tags. Sample uploads can include a musical key.
   **Next** checks queued file metadata, starts uploads automatically and advances
   to review only after all files succeed. Failed files remain on Add files;
   choose **Next** again to retry only failures, or remove them.
3. Review the order using drag-and-drop or the accessible Move up/Move down
   controls, then publish. Failed or pending files must be uploaded or explicitly
   removed; publishing never silently omits them.

Limits are 50 files, 100 MB per audio file, and 500 MB per pack. Upload progress
and failures are per file. Retry uploads only the failed files; successfully
saved files remain in the draft. Save draft retains the pack for a later visit.
Files still waiting in the browser must be selected again after leaving.
Searches show an explicit empty state with a filter reset. Adding an existing
dub disables packs with a different audience and packs already containing it.
Upload and saved-file metadata forms share the same fields and validation.

Pack type can be changed without re-uploading audio or changing access rights.
A Sample Pack requires uploader-supplied usage licence terms before continuing
past Details (also checked when using the step navigation), saving published
changes or publishing. Incomplete drafts can still be saved for later.
Those terms appear on its page and in the downloaded ZIP; access to a file alone
is not permission to reuse it. Uploaders must have rights to distribute and
license their content.

The add/edit editor uses the A-List Submission form's numbered section panels,
field styling and focus treatment, with the same three-step journey for drafts
and published releases. Enter advances Details/Add files rather than prematurely
saving or publishing. Existing published changes can still be saved explicitly;
new uploaded files are persisted individually, not rolled back by Cancel.

A dub can belong to multiple packs. Editing its metadata updates that same dub
everywhere. Removing a dub from a pack or deleting a pack does not delete the
underlying audio release.

## Distribution and access

- Each pack has one audience. Existing dubs must match its distribution and,
  for A-List packs, its public/restricted setting.
- Drafts and their newly uploaded files are private to the uploader.
- Published packs retain their original audience. A pack cannot broaden an
  included dub's permissions.
- Private packs grant access to selected friends. Adding files to a published
  private pack with recipients requires explicit confirmation before existing
  recipients gain access to them.
  Adding further recipients also requires confirmation that they can access all
  files currently in the pack.
- Revoking pack access removes only that pack's access path. Independently
  granted dub access and access through another pack remain valid.
- Downloaded files cannot be recalled.

Friends sharing makes the pack available to recipients and links to it in
Messenger. Eligible public packs also offer an external link. Guests hear
server-generated short previews only; full playback and downloads require
sign-in. Restricted and private packs are never exposed anonymously.

Public file and pack pages clearly identify **Reduced-quality preview** before
playback. Previews start at the beginning and are capped at the uploader's saved
30, 60 or 90 seconds; shorter sources are never padded. Each guest pack item labels
its playable preview duration, and mixed preview limits are not presented as one
pack-wide duration. Guest pack headers label the summed time as previews and
the file size as the full download. The current preview stream is **16 kHz, mono, 16-bit PCM WAV
at 256 kbps**. This is reduced fidelity, not necessarily a lower numeric bitrate
than a compressed source; the displayed bitrate describes the preview, not the
original upload. Sign-in actions return to the same file or pack for full-length,
original-quality playback and downloads, subject to access.

External file-sharing settings show the currently saved preview limit and audio
quality. Changing the limit displays an unsaved notice and keeps copying disabled
until the setting is successfully saved. Authenticated original playback does not
display guest-preview restrictions. Download access alone never grants sample or
vocal reuse rights.

Use **Share pack** on a release card, or **Share a pack** inside Messenger, to
send either pack type to friends. Received releases use the same expandable
DubPackCard and scoped playlist. Private sharing is uploader-only and requires
explicit confirmation before granting access to the current files. Sending adds
recipients without removing existing grants. Restricted A-List packs can only be
sent to approved friends. Failed recipients remain selected for retry; successful
recipients are not sent the pack again. Unsend removes the message, not access;
use Manage access to revoke a private grant.

## Playback and downloads

Navigation groups **Dub Vault** and **Your Dubs** under **Dubs**,
**Sample Vault** and **Your Samples** under **Samples**, and **Vocal Vault**
and **Your Vocals** under **Vocals** (Samples and Vocals also in mobile More).
The existing `#my-dubs` route remains valid; `#my-samples` opens sample
management directly. `#my-vocals` opens vocal management. All management pages reuse the same searchable, paginated
cards, statistics, access controls and pack workspace, scoped to the current
owner and media kind. Their Packs tabs include drafts of that type.
Your Samples starts **Add Sample** through a Sample Pack, so samples receive
usage terms and become samples when the pack is published. Draft membership
alone does not reclassify a file. Pack editors can still select any compatible
owned upload and change pack type; on returning to the list the saved type
determines which management page contains the pack.

Each domain also has its own received-file page: **Dubs shared with you** under Dubs
(`#shared-with-me`, preserving the existing route) and **Samples shared with you** under
Samples (`#shared-samples`), plus **Vocals shared with you** under Vocals
(`#shared-vocals`). All reuse SharedWithMeTemplate with separate
counts, search, filters, pagination and media palettes. Only received files
with current access appear; changing classification moves a file to the
matching domain without changing grants or share history.
Received pack files are included, not just individually shared files. Discovery
uses the recipient's full message history and current private pack grants,
including messages outside the loaded Messenger page. Published membership and
current file access are required; revoked access removes files from this view.
Sample shared navigation uses the green media palette; vault counts use
turquoise for dubs, green for samples and violet for vocals on desktop and mobile.
All navigation entries inherit their group's media variant:
turquoise for dubs, green for samples, violet for vocals. Active and hovered items use solid media
backgrounds with dark text and inverted count badges, including mobile More.
Keyboard-focus outlines retain the matching media color.
Mobile primary navigation shows Dub Vault and Sample Vault alongside My Profile
and Messenger; My Library remains available in the grouped More menu.
Received Dub Packs, Sample Packs and Vocal Packs also appear as expandable DubPackCards in
their matching shared domain, with scoped playback, Open pack and ZIP download.
Members of a displayed pack are not duplicated as standalone cards. Search
matches pack titles and member metadata, and packs and standalone files share
pagination. Public packs that were never received are not included.

**Play all** uses pack order (or the selected shuffle mode) in the existing player
and stops after the last file unless repeat is enabled. Each playlist offers Previous, Next, Shuffle and Loop
controls. Loop repeats the whole pack, not a single file; shuffle visits every
file once before stopping (or beginning another cycle with Loop enabled).
Previous retraces shuffle history. Manual Next/Previous wrap within the pack.
Selecting or seeking an individual file also activates that pack's queue, so
playlist controls and the persistent player never advance into unrelated dubs.
Individual files can still be played or downloaded.
The ordered playlist uses the shared DubCard's streamlined playlist variant,
with artwork, waveform seeking, playback state, BPM and sample key metadata.
The pack card itself composes DubCard's collection variant, retaining its pack
artwork, summary, ZIP download and expandable playlist. Full audio controls,
including waveform seeking and volume for the current (or first) pack track,
remain available while the playlist is collapsed. Expanding adds the ordered
track rows without duplicating the pack transport controls.

Pack Play all uses the type's media palette (turquoise for Dub Packs, green for
Sample Packs), with a play/pause icon and Pause pack label while playing. Pausing
and resuming keeps the current file and position rather than restarting the pack.
The explicit active pack identity prevents overlapping releases from displaying
the wrong pause state. Standalone Next/Previous and shuffle stay within the
current media kind and distribution; pack queues keep their explicit membership.

Media kind is independent of layout, distribution and playback state.
The shared AudioPlayer sample variant, DubCard, playlists and persistent player
use the same semantic sample tokens, including the green highlighted and dark
controller variants. A shared PackPlaybackButton composes the design-system
audio button rather than duplicating button styling in pack views.

The desktop right bar displays the active pack's ordered playlist,
including its type, title and current position. The playlist can be collapsed, and stays
associated with the selected pack even when another pack contains the same files.
On desktop, both single-track and pack playback controls use the **Footer**,
including Messenger. Only the pack tracklist moves into the same aside as
Workspace Explorer, retaining the shared dark media-controller surface and
Dub/Sample/A-List accents. Both surfaces control the same exact queue; there
is no second playback engine or duplicate footer playlist. Collapse keeps play/pause and an expand
control available without interrupting playback. Switching between pack and
single-track modes expands the player again.

The right bar reserves a full-height column beside the main content.
Tracks stack from the top at a consistent height, reserving the same status,
title and artist lines for active and inactive files. Long labels truncate rather
than changing row height; the queue scrolls independently without covering the page.
Playback errors remain visible. Desktop ignores
obsolete saved floating placements without discarding mobile preferences.
Mobile starts in the footer when no layout has been saved and retains separate
saved positions for Messenger and other pages.
Desktop vault and collection filters stay inside the content column and stick to
the top of its scroll viewport, leaving the right dock clear. Mobile retains the
separate collapsible controls below the app header.
Mobile header and footer players share a compact two-row layout: truncated track
identity beside the full transport controls, then seek progress beside share and
download. Volume and redundant status text do not reserve extra mobile space;
playback errors remain visible and content clearance uses the measured height.
On mobile, **Choose player position > Full screen** opens a focused full-viewport
player with larger artwork and the pack queue. **Minimized**, the minimize control,
or closing/Escaping full screen returns to the floating compact player without
stopping playback. Full-screen preference persists per page context; desktop
uses automatic footer/right-bar placement until returning to mobile.
When a pack is selected, mobile players also show a collapsible, media-colored
pack title and track position above a short scrollable playlist. Numbered rows
reuse DubCard playback with truncated title/artist text and play/pause, omitting
duplicate artwork, waveforms and metadata. Selecting a row retains the pack queue.
The mini-player places transport beside the track identity, with share and
download icon buttons underneath. These actions share/download the active pack
(a ZIP for downloads), or the individual dub when no pack queue is active.

**Download pack (ZIP)** shows the number of files and estimated size. The server
validates the entire archive and access before download: missing or inaccessible
files cause an explicit error, not a silently incomplete archive. Downloads use
the existing per-dub download and unique-like accounting. My Library keeps one
entry per dub, even after repeat pack downloads.

The [journey guide library](guides/videos/index.html) includes desktop/mobile
Dub Pack and Sample Pack creation journeys. Templates are maintained in
[`scripts/video-guides/templates`](../scripts/video-guides/templates).
