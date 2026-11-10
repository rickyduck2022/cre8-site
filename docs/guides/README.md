# User journey video guides

Each video is defined by a JSON template in
[`scripts/video-guides/templates`](../../scripts/video-guides/templates).
The shared recorder runs the **real built app** and API against a temporary,
isolated database. It never uses the development database or existing accounts.

## Record one guide

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm build
pnpm guides:test
pnpm guides:record signup-get-started
```

Outputs are an H.264 MP4 with burned-in step captions and a matching SRT file in
`docs/guides/videos` (ignored by Git). There is no voiceover, music or recorded
audio. The full app viewport is preserved; captions occupy a separate band below
it. Output is decoded once before publication to check it is readable.

The recorder stops on missing controls, timeouts or app exceptions. Temporary
accounts, database files and raw recordings are removed after the run. The demo
password is generated at runtime, appears only as masked input, and is never
saved in the template. Do not put real personal data or credentials in templates.
The recording stylesheet hides only local demo-login hints and the local-backend
notice. Product controls and normal service-worker behavior are preserved.
The isolated browser is granted clipboard access only for its temporary local
origin, so Copy link can be demonstrated in headless recordings.

## Update or add a video

Copy an existing template, change its `id` to match its kebab-case filename, and
edit `title`, `description`, `variables` and `steps`. Run `pnpm guides:record --list`
to list templates. Make one guide at a time; successful output replaces that
guide's previous MP4/SRT.

For an approved batch, run both profiles with up to two isolated browser
workers (one per device):

```powershell
pnpm guides:batch --check find-dub playback-mini-player
pnpm guides:batch find-dub playback-mini-player
```

With no template IDs, the batch command selects all templates. `--check`
executes the real setup and journey without typing/reading delays or publishing
videos. A failed guide is reported and the batch exits unsuccessfully; existing
good videos are not replaced by a failed recording. Each successful recording
also writes a JSON timeline alongside its MP4/SRT for repeatable frame review.
Do not run multiple batches concurrently on a shared developer machine.

After recording all catalogue entries, run `pnpm guides:publish` to generate
`docs/guides/videos/index.html`: a categorized documentation page with a linked
table of contents, a step-by-step summary per guide, and desktop and mobile
players with subtitle links, recording dates and a journey search. Publishing
rejects timelines whose title/captions no longer match their template, so stale
footage cannot silently pass as refreshed coverage.
Publishing fails if any MP4/SRT/timeline is missing; pass
`--partial` to publish an in-progress library with "not published yet"
placeholders for missing recordings. Categories and stable journey IDs are
maintained in [`catalogue.json`](../../scripts/video-guides/catalogue.json).
`pnpm guides:review` extracts four end-of-scene frames per video into the
ignored `videos/review` directory for visual inspection; pass template IDs to
review only selected journeys. It requires the recording's JSON timeline.

## Browse the guides at /guides

The API server serves the published library at `/guides` (for example
`http://localhost:3001/guides/`), alongside the web and admin apps. It reads
from `docs/guides/videos` by default; set `GUIDES_DIRECTORY` to serve another
location. Until `pnpm guides:publish` has produced `index.html`, `/guides`
responds with 404. The Vite dev server proxies `/guides` to the API, and the
web app's service worker never intercepts `/guides` navigations. Video
responses support range requests, so players can seek without a full download.

Each step has:

- `caption`: instructional text, up to 110 characters.
- `holdMs` (optional): reading time after the actions.
- `actions`: `click`, `fill`, `waitFor`, `select`, or `upload`, using an exact
  accessible `label` or an exact `role` and `name`. `fill` and `select` need a
  `value` (`fill` accepts an empty string to clear a field); `upload` needs an
  `asset` name declared in the template.
  Use exact `text` for visible status content that has no accessible name.
- `waitFor` may set `state: "hidden"` to wait for a dialog to close after a
  successful save; its default is `"visible"`.
  Set `reveal: true` on a visible wait to scroll an explained control into view,
  especially for long mobile pages.
- Values and target names may use `{{variableName}}`. `{{demoPassword}}` is
  reserved for the runtime-generated password.
- A target may include `within: { "role": "dialog", "name": "Share a dub" }`
  (or another named region) to disambiguate controls.
- `navigate` takes a `destination`: `dubs`, `samples`, `library`, `profile`, `messenger`,
  `buddies`, `my-dubs`, `my-samples`, `shared-with-me`, `shared-samples`,
  `alist` or `alist-application`. It uses the actual sidebar on desktop and primary
  tabs/More menu on mobile, without copying navigation steps into templates.
- `include` takes a `fragment` from
  [`fragments.json`](../../scripts/video-guides/fragments.json). Shared setup
  fragments cover signup, adding Holik, and public/private fixture uploads.
- `download` uses the real browser action and requires a nonempty downloaded
  file. `press` sends a `value` such as `ArrowRight` to a control.
- `captureLink` reads a share-link textbox into runtime `sharedUrl`; `visit`
  takes a `value` such as `{{sharedUrl}}`, including public pack links. Both reject links outside the
  isolated app origin.

Example:

```json
{
  "caption": "Enter your artist name.",
  "actions": [
    { "type": "fill", "target": { "label": "Artist" }, "value": "{{artistName}}" }
  ],
  "holdMs": 4500
}
```

Shared viewport, caption-band height, pacing, timeouts and output location are in
[`defaults.json`](../../scripts/video-guides/defaults.json) and device presentation
is in [`profiles.json`](../../scripts/video-guides/profiles.json).
Viewport and band dimensions must be even for H.264.
By default the first scene starts at the sign-in page of an empty demo database.
An optional `setup` action array runs before the recorded journey, on a separate
page in the same isolated browser context. Use it to create a demo account and
start a guide already signed in without repeating the signup footage.

Journeys that need received packs, approved artists or admin access may use a
named `fixture`: `community`, `received`, `new-application`, `application` or
`admin`. [`fixtures.mjs`](../../scripts/video-guides/fixtures.mjs) creates these
prerequisites through the real local API, including real uploads, publishing,
friend grants and admin decisions. It signs in only the recording context.
The recorder configures a temporary admin allowlist in its own child process,
never the shared dev server. Accounts use runtime-generated passwords.
An optional `entryPath` starts at a local app/admin section (e.g.
`/admin/#applications`); off-origin entries are rejected. Build admin before
recording administration guides.

## Desktop and mobile reuse

The same journey template can be recorded with a named presentation profile:

```powershell
pnpm guides:record add-dub desktop
pnpm guides:record add-dub mobile
```

Desktop is the default and preserves existing output filenames. Mobile writes
`add-dub-mobile.mp4` and `add-dub-mobile.srt`, so it never overwrites desktop
footage. The mobile profile uses a portrait viewport, touch emulation and taps
instead of desktop hovering, with narrower caption wrapping and its own font
sizes and caption band. These are browser-emulated guides, not recordings from
a physical phone or its native file picker.

## Marketing videos and the Instagram advert

Templates marked `"marketing": true` reuse the same recorder but are excluded
from the guide catalogue, the `/guides` documentation page, and no-argument
`pnpm guides:batch` runs; record them explicitly with their intended profile.
The `instagram` profile in
[`profiles.json`](../../scripts/video-guides/profiles.json) records a 9:16
portrait video (720x1280, touch emulation) with the cre8 brand band: the
template title becomes the persistent orange tagline and captions act as
advert copy instead of numbered instructions.

[`cre8-advert`](../../scripts/video-guides/templates/cre8-advert.json) is the
branding advert. It tours key functionality in about 34 seconds — Dub Vault
discovery, playback with the persistent player, tag/BPM filters, publishing a
dub (with cre8 logo artwork), and Messenger sharing — ending on a join call to
action:

```powershell
$env:GUIDE_AUDIO_PATH = "C:\path\to\demo.wav"
pnpm guides:record cre8-advert instagram
```

This writes `cre8-advert-instagram.mp4` (plus SRT and timeline JSON) to
`docs/guides/videos`. Instagram recommends 1080x1920 for Reels and Stories;
upscale the final cut before uploading:

```powershell
ffmpeg -i cre8-advert-instagram.mp4 -vf "scale=1080:1920:flags=lanczos" `
  -c:v libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart cre8-advert-instagram-1080.mp4
```


Titles, assets, variables, captions, setup and actions are shared by default.
When navigation differs, add `profileOverrides.mobile` to **only the affected
step**, rather than copying the whole journey:

```json
{
  "caption": "Open Your Dubs from the sidebar.",
  "actions": [
    { "type": "click", "target": { "role": "link", "name": "Your Dubs" } }
  ],
  "profileOverrides": {
    "mobile": {
      "caption": "Open More, then choose Your Dubs.",
      "actions": [
        { "type": "click", "target": { "role": "button", "name": "More" } },
        { "type": "click", "target": { "role": "link", "name": "Your Dubs" } }
      ]
    }
  }
}
```

Step overrides can replace `caption`, `actions` and/or `holdMs`.
A top-level `profileOverrides.mobile` can replace `setup` or, for substantially
different journeys, `steps`. Profiles own device geometry and typography;
defaults and template fields own shared pacing. Caption and title fit are
validated before recording. Responsive action differences still need authoring
and a real recording check: shrinking a desktop video is not a mobile guide.
Verify both device profiles after changing shared actions or setup.

## Upload guides and local assets

The add-dub template declares local assets rather than embedding personal file
paths. Set `GUIDE_AUDIO_PATH` before recording:

```powershell
$env:GUIDE_AUDIO_PATH = "C:\path\to\your-track.wav"
pnpm guides:record add-dub
```

Artwork defaults to the repository's cre8 logo. Optionally set
`GUIDE_ARTWORK_PATH` to another local image. Files must exist before recording
starts. The source files are read, never modified or added to Git, and are only
uploaded to the temporary local guide server. Uploaded copies are removed with
the temporary database. The guide remains silent; uploaded audio is not mixed
into the MP4.

An `assets` entry accepts `path` (relative to the repository) and/or `env` (an
environment-variable override). A setup or step can select it using:

```json
{ "type": "upload", "target": { "label": "Audio fileUp to 100 MB" }, "asset": "audio" }
```

When replacing a source file, update any filename mentioned in the captions
and the track-title variable to match the intended example.

FFmpeg is supplied by the dev dependency `ffmpeg-static`; `FFMPEG_PATH` may
override it. Windows uses Segoe UI from the local Windows fonts directory.
On other systems, set `GUIDE_FONT_PATH` to an installed TrueType font.
Browser installation and encoding require local disk space and may take a minute.

Watch the result before publishing: verify the current labels, caption timing,
legibility, and that no personal information or local debugging UI is visible.
Rebuild and re-record after relevant application changes.

## Guide catalogue

Organize guides by the user's goal, not by individual screens. Each video
should demonstrate one outcome, usually in 45-90 seconds. Split larger journeys
into separate guides instead of extending an overview indefinitely. Category
and guide numbers below are navigation labels; template IDs remain stable.

### 1. Getting started

- **1.1 Sign up and get started** (`signup-get-started`): registration,
  automatic sign-in and a short orientation.
- **1.2 Edit your artist profile** (`edit-artist-profile`).

### 2. Discovering and listening

- **2.1 Find a dub** (`find-dub`): search, tags, BPM range and sorting.
- **2.2 Playback and mini player** (`playback-mini-player`).
- **Explore Dubs and Samples** (`sample-vault`): separate vaults and owned workspaces.
- **Fullscreen and minimized player** (`player-fullscreen`).
- **Choose your player layout** (`player-docking`): desktop docks and mobile header/footer.
- **Download and My Library** (`download-to-library`).

### 3. Publishing and managing dubs

- **3.1 Add and publish a dub** (`add-dub`): signed-in upload, title, artist,
  Worldwide distribution, local audio, cre8 artwork, publishing and Your Dubs.
- **3.2 Edit dub details** (`edit-dub-details`).
- **3.3 Revoke private access** (`revoke-private-access`).

### 4. Contacts and Messenger

- **4.1 Add a friend** (`add-friend`).
- **4.2 Send a message** (`send-message`).
- **4.3 Share a private dub with a contact** (`private-dub-share`): choose
  Private, select a friend at upload, publish, find the upload in Your Dubs and
  its message in Messenger. Uses the same `GUIDE_AUDIO_PATH` and artwork options
  as add-dub. Setup creates a demo artist and adds the seeded Holik account as a
  friend through the real Friend List UI before recording.
- **4.4 Share an existing dub** (`share-existing-dub`).

### 5. External sharing

- **5.1 External share link** (`external-share-link`): choose preview length and
  copy a link.
- **5.2 Preview, sign in and download** (`shared-preview-sign-in`): anonymous
  preview followed by authenticated playback and downloading.

### 6. Dub and Sample Packs

- **Create a Dub Pack** (`create-dub-pack`): existing files, uploads, arrangement and ZIP.
- **Create a Sample Pack** (`create-sample-pack`): licence, BPM and musical key.
- **Listen to a pack** (`pack-playlist`): scoped queue and fullscreen playback.
- **Manage pack details and access** (`manage-pack`): edit and revoke pack grants.
- **Send a pack in Messenger** (`share-pack-messenger`).
- **Share a private pack safely** (`private-pack-share`): explicit all-file confirmation.
- **Find packs shared with you** (`received-packs`): separate received Dub/Sample cards.
- **Share a public pack link** (`pack-external-preview`).

### 7. A-List artists and releases

- **Submit your artist story** (`alist-first-application`): the five-section application form.
- **Apply and resubmit for A-List** (`alist-application`): respond to reviewer feedback.
- **Recognise and play A-List releases** (`alist-releases`): orange distribution and media palette.

### 8. Community administration

- **Review A-List artists** (`admin-review`): approval, decision history and revocation confirmation.
- **Request artist information** (`admin-request-information`): required message and queue status.
- **Explore community administration** (`admin-community`): snapshot, member/release search and refresh.

### Approval and production

Refresh the complete catalogue on both desktop and mobile after relevant UX
changes. Check the real actions before recording, then verify exports and
captions before marking a guide complete.

Keep both device profiles captioned and silent unless a different format is
approved. Set up prerequisites off-camera, link related guide titles in the
catalogue, and avoid repeating signup or upload steps in every video.

See [journey UX notes](ux-review.md) for improvements encountered during
production; these are proposals, not application changes.
