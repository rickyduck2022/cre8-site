# Dub Packs and Sample Packs

Packs are ordered releases made from an uploader's own dubs. They are separate
from listening crates: a crate organises listening, while a pack publishes and
shares a collection.

## Browse the vaults

**Dub Vault** contains dubs and Dub Packs. **Sample Vault** is a separate
navigation destination (`#samples`; available in More on mobile) containing
Sample Packs and their samples. Both reuse the same release cards, ordered
playlists, sorting and search components, with independent distribution filters.
Navigation counts include files in the matching public feed, not pack cards.

An individual file is classified as a sample while it belongs to at least one
published Sample Pack, even if it also belongs to a Dub Pack. Draft membership
does not move existing releases between vaults. Changing pack type, removing a
file, or deleting its last Sample Pack recomputes classification; files without
published sample membership are dubs. No media or access grants are duplicated.
Private releases remain opt-in through the distribution filter.

A-List releases use dark card backgrounds, orange borders and explicit
audience labels across individual files, pack cards and pack detail headers.
Players use a dark background with light text and orange waveforms and transport
controls, plus an A-List release label where space allows. All media accents
inside A-List releases and packs use orange, including Sample Pack actions.
This identifies release distribution, not just an approved artist:
worldwide releases by approved artists retain their normal card styling.
Non-A-List Dub/Sample playback controls retain their turquoise/green palettes.

Published packs appear as one compact **DubPackCard**, rather than repeating
every member as a full feed post. **Show tracks / samples** expands an ordered,
scrollable playlist using the shared DubCard playlist variant. **Play all** and
**Download ZIP** operate on the whole pack; individual playback, seeking and
downloads remain available in the expanded list.

Search includes accessible published pack titles and descriptions. Filters
retain matching files inside the playlist, with a matching count and an
**Open pack** action for the full release. Pagination counts
release cards, while crates continue to show their individual saved dubs.
Private packs only enter an authorised member's community feed; drafts never
enter the feed.

Published Dub and Sample Packs also appear in **Your Dubs** or **Your Samples** and the uploader's
profile using the same pack collection and cards. Owners see their private
releases; other members' profiles show public releases only. Drafts remain
available in the matching **Your Dubs > Packs** or **Your Samples > Packs** view.

## Create and edit

Open **Your Dubs > Packs > Create pack** or **Your Samples > Create Sample Pack**, or choose **Dub / Sample Pack** in the
upload dialog. Existing owned dubs also offer **Add to pack** in their actions.

1. Choose **Dub Pack** or **Sample Pack**, enter a title, optional description
   and artwork, and choose the audience before adding files.
2. Select existing uploads or upload multiple audio files. Each file has its own
   title, artist, optional BPM and tags. Sample uploads can include a musical key.
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
A Sample Pack requires uploader-supplied usage licence terms before publishing.
Those terms appear on its page and in the downloaded ZIP; access to a file alone
is not permission to reuse it. Uploaders must have rights to distribute and
license their content.

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

Use **Share pack** on a release card, or **Share a pack** inside Messenger, to
send either pack type to friends. Received releases use the same expandable
DubPackCard and scoped playlist. Private sharing is uploader-only and requires
explicit confirmation before granting access to the current files. Sending adds
recipients without removing existing grants. Restricted A-List packs can only be
sent to approved friends. Failed recipients remain selected for retry; successful
recipients are not sent the pack again. Unsend removes the message, not access;
use Manage access to revoke a private grant.

## Playback and downloads

Navigation groups **Dub Vault** and **Your Dubs** under **Dubs**, and
**Sample Vault** and **Your Samples** under **Samples** (also in mobile More).
The existing `#my-dubs` route remains valid; `#my-samples` opens sample
management directly. Both management pages reuse the same searchable, paginated
cards, statistics, access controls and pack workspace, scoped to the current
owner and media kind. Their Packs tabs include drafts of that type.
Your Samples starts uploads through **Create Sample Pack**, so samples receive
usage terms and become samples when the pack is published. Draft membership
alone does not reclassify a file. Pack editors can still select any compatible
owned upload and change pack type; on returning to the list the saved type
determines which management page contains the pack.

Each domain also has its own received-file page: **Dubs shared with you** under Dubs
(`#shared-with-me`, preserving the existing route) and **Samples shared with you** under
Samples (`#shared-samples`). Both reuse SharedWithMeTemplate with separate
counts, search, filters, pagination and media palettes. Only received files
with current access appear; changing classification moves a file to the
matching domain without changing grants or share history.
Received pack files are included, not just individually shared files. Discovery
uses the recipient's full message history and current private pack grants,
including messages outside the loaded Messenger page. Published membership and
current file access are required; revoked access removes files from this view.
Sample shared navigation uses the green media palette; vault counts use
turquoise for dubs and green for samples on desktop and mobile.
All navigation entries in Dubs and Samples inherit their group's media variant:
turquoise for dubs, green for samples. Active and hovered items use solid media
backgrounds with dark text and inverted count badges, including mobile More.
Keyboard-focus outlines retain the matching media color.
Mobile primary navigation shows Dub Vault and Sample Vault alongside My Profile
and Messenger; My Library remains available in the grouped More menu.
Received Dub Packs and Sample Packs also appear as expandable DubPackCards in
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

The desktop persistent player displays the active pack's ordered playlist,
including its type, title and current position. It can be collapsed, and stays
associated with the selected pack even when another pack contains the same files.
On desktop, **Choose player position > Right dock** reserves a full-height column
beside the main content, below its header. The queue scrolls independently without
covering the page. A floating mini-player can also be dragged to the right edge
to dock. The position is remembered separately for Messenger and other pages;
below desktop width it uses the footer until desktop space is available again.
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
falls back to the footer until returning to mobile.
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
