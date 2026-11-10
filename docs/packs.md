# Dub Packs and Sample Packs

Packs are ordered releases made from an uploader's own dubs. They are separate
from listening crates: a crate organises listening, while a pack publishes and
shares a collection.

## Browse the Dub Vault

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

Published Dub and Sample Packs also appear in **My Dubs** and the uploader's
profile using the same pack collection and cards. Owners see their private
releases; other members' profiles show public releases only. Drafts remain
available in **My Dubs > Packs**.

## Create and edit

Open **My Dubs > Packs > Create pack**, or choose **Dub / Sample Pack** in the
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

## Playback and downloads

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

**Download pack (ZIP)** shows the number of files and estimated size. The server
validates the entire archive and access before download: missing or inaccessible
files cause an explicit error, not a silently incomplete archive. Downloads use
the existing per-dub download and unique-like accounting. My Library keeps one
entry per dub, even after repeat pack downloads.

The [journey guide library](guides/videos/index.html) includes desktop/mobile
Dub Pack and Sample Pack creation journeys. Templates are maintained in
[`scripts/video-guides/templates`](../scripts/video-guides/templates).
