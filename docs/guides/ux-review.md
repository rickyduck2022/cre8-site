# Journey recording UX notes

These findings were collected while producing the desktop and mobile guides.
The implementation status below records the follow-up product changes; the
original observations are retained as evidence. Recordings use a fresh,
isolated demo database, Chromium and emulated touch at 390px. They are not a
physical-device usability study. Source-only observations are marked separately.

## Implemented follow-up

- Profile link editing captures input values before updating state. Existing
  genres and custom link labels remain editable instead of being silently lost.
  A logged, recoverable app error screen offers retry and reload.
- Applied search filters have removable chips and a direct Clear filters action.
  Clear filters keeps the query; Clear search resets both and closes the panel.
- My Library shows one card per dub, using its latest download date. Repeat
  downloads still use the existing server download/like accounting.
- The persistent player identifies its playback state without removing its
  existing transport, positioning or docking controls.
- Successful uploads offer a contextual View in My Dubs shortcut without
  changing the existing post-upload destination.
- Global artist lookup and saved contacts have distinct search labels; added
  artists offer a Message shortcut.
- Message submission blocks duplicates, shows progress/errors and retains
  drafts after failures and conversation changes.

- Share uses separate Friends and External link tabs, with Friends first.
  Restricted A-List sharing keeps its approval requirement. Copy failures offer
  explicit manual-copy guidance and a Select link fallback.
- Private releases offer Manage access with a recipient count. It opens and
  focuses the existing recipient list, retaining the download-recall disclaimer
  and showing an explicit empty state after the last revocation.
- Mobile download controls keep a visible Download and Like label. Completion
  notifications and the library empty state explain the combined action.

Verification: 364 tests across 70 UI suites pass, as do UI declaration/web
production builds and all 28 isolated desktop/mobile journey checks.
All 28 captioned recordings have been regenerated, decoded successfully and
republished in the [guide library](videos/index.html) and
[downloadable archive](videos/cre8-journey-guides.zip).
The standalone UI test typecheck
still reports existing test typing issues; the full legacy suite also has
unrelated CSS-source assertions and an empty FooterAudioPlayer test file.

## Observed during recording and preflight

| Priority | Journey | Friction | Suggested improvement |
| --- | --- | --- | --- |
| High | Edit artist profile | Filling a website link reproducibly crashes the page to a blank screen on desktop and mobile (`Cannot read properties of null (reading 'value')`). No successful link-editing footage is published; the profile guide covers the working name, role, genre and bio flow instead. | Capture the input value before updating link state; add an interaction regression test and an app-level recoverable error boundary. |
| Medium | Find a dub | Clearing a filtered search requires reopening Filters, selecting Clear search, then Apply filters to dismiss the panel. On mobile this is another modal round trip. | Add a visible clear-filters action beside the search field and removable active-filter chips. Make resetting filters close the mobile panel, or clearly distinguish Reset from Apply. |
| Medium | Download and My Library | Desktop says Download and Like; mobile shows an icon. The dual effect needs a caption to explain that downloading also registers appreciation. | Preserve a short visible label or a first-use explanation on mobile; use the same terminology in the completion notification and library empty state. |
| Medium | Playback and mini player | A track has inline controls and a second persistent player. The guide moves to My Library to make the persistent controls unambiguous. | Emphasize which controls belong to the current track and which control the persistent player; consider a simpler inline transport and a clear Now playing cue. |
| Medium | Download again | Downloading the same dub twice creates two My Library cards and changes the counter to 2 downloads, even though the like is counted once. This occurs in both desktop and mobile footage. | Show each dub once in the collection, with its latest download date or a compact download-history detail; keep repeat-download accounting separate from collection size. |
| Low | Find friends | The artist-lookup Add friend button remains present but disabled after adding Holik, while the actual saved contact is in a separate list farther down. | Replace the lookup action with an Added state and a Message shortcut; visually distinguish global lookup from saved-contact search. |
| Medium | Manage private access | The access list is inside collapsed Statistics. On mobile it is below the track and performance figures, requiring another scroll before the recipient is visible. | Add Manage access directly to a private release's actions, with a recipient count and the existing download-recall disclaimer. |
| Medium | Share with a contact | External-link settings appear before contact selection; on mobile a user scrolls past preview settings and the public URL to reach recipients. | Make Friends and External link distinct sections or tabs, and open the relevant one from each entry point. |

Implementation evidence:

- Search reset and apply behavior:
  [DubSearch](../../packages/ui/src/organisms/DubSearch/DubSearch.tsx).
- Icon-only mobile download and its desktop wording:
  [DubCard](../../packages/ui/src/organisms/DubCard/DubCard.tsx).
- Inline playback and persistent player composition:
  [DubCard](../../packages/ui/src/organisms/DubCard/DubCard.tsx) and
  [AppPlayer](../../apps/web/src/components/AppPlayer.tsx).
- Repeat-download behavior: final scenes of the
  [desktop](videos/download-to-library.mp4) and
  [mobile](videos/download-to-library-mobile.mp4) guides; collection entries are
  rendered by [DubCardList](../../packages/ui/src/templates/shared/DubCardList.tsx).
- Profile-link failure: desktop and mobile preflight stopped at the Links field
  with the same page exception. The link updater in
  [EditProfileForm](../../packages/ui/src/molecules/EditProfileForm/EditProfileForm.tsx)
  reads the event's current target from inside a deferred state update.
  No broken recording was exported.
- Friend-list action state: the saved-contact scene of
  [Add a friend, mobile](videos/add-friend-mobile.mp4).
- Private access location: [Revoke private access, mobile](videos/revoke-private-access-mobile.mp4).
- Sharing hierarchy: [Share an existing dub, mobile](videos/share-existing-dub-mobile.mp4).

## Additional source-backed opportunities

- **Secondary navigation discoverability:** Friend List and My Dubs are behind
  More, while the primary tabs contain Dub Vault, My Library, My Profile and
  Messenger. Consider contextual links after upload and contact discovery so a
  user does not need to discover the secondary navigation first.
  Evidence: [MobileNavigation](../../packages/ui/src/organisms/MobileNavigation/MobileNavigation.tsx)
  and [app navigation](../../apps/web/src/app/App.tsx).
- **Preserve profile genres:** profile editing filters saved genres against the
  current option list. Keep existing unrecognized genres visible until the user
  explicitly removes them, rather than silently dropping them on another edit.
  Evidence: [EditProfileForm](../../packages/ui/src/molecules/EditProfileForm/EditProfileForm.tsx).
- **Message submission feedback:** the message composer does not have the same
  pending-submit guard used by the shared dialog forms. Disable duplicate sends
  while the current request is pending, show progress, and retain the draft on
  failure. Evidence: [MessengerTemplate](../../packages/ui/src/templates/MessengerTemplate/MessengerTemplate.tsx).
- **External-link entry point:** the card's action is labeled Share with a
  friend even though the dialog also handles public links. A general Share
  label or explicit Copy public link entry would make this discoverable.
  Evidence: [DubCard](../../packages/ui/src/organisms/DubCard/DubCard.tsx).
- **Clipboard fallback:** offer a Select link action and clear manual-copy
  guidance when clipboard access fails, rather than relying only on the error.
  Headless Chromium initially reproduced a raw permission-denied error; granting
  access for the isolated origin fixed recording. This is not evidence that
  normal browsers always fail.
  Evidence: [ShareDubDialog](../../packages/ui/src/organisms/ShareDubDialog/ShareDubDialog.tsx).

## Patterns worth keeping

- Anonymous share pages clearly distinguish a short preview from signed-in
  full playback; preview settings explain that changes apply to all links.
- Private sharing explains that unsending is not revocation and downloaded
  copies cannot be recalled.
- Mobile forms retain a visible submit/cancel footer while their fields scroll.
- Saved profile changes and sent messages remain present after navigating away
  and returning; the guides show that persisted result, not just a success toast.

The observations above describe the original recordings. Follow-up changes keep
existing permission, download accounting and sharing semantics.
