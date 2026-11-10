import { useRef, useState } from "react";
import { Button, DubPackIdentity, PackPlaylist, PackPlaybackButton, SearchField, type PackQueueControls, type Buddy, type Dub } from "@craft/ui";
import { downloadPack, packRequest, packUrl, packTypeLabel, PackSignInRequired, signInForPack, type Pack } from "../services/packs";

export interface PackPlayback {
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackError: string | null;
}

interface Props extends PackQueueControls {
  pack: Pack;
  authenticated: boolean;
  owner: boolean;
  buddies?: Buddy[];
  playback: PackPlayback;
  onPlay: (dub: Dub) => void;
  onPlayAll: (dubs: Dub[], packId?: string) => void;
  onSeek: (progress: number, dub: Dub) => void;
  onVolume: (volume: number) => void;
  onDownloadDub: (dub: Dub) => Promise<void>;
  onEdit?: () => void;
  onRefresh: () => Promise<void>;
  onDelete?: () => void;
  standalone?: boolean;
}

export function PackView({ pack, authenticated, owner, buddies = [], playback, onPlay, onPlayAll, onSeek, onVolume, onDownloadDub, onEdit, onRefresh, onDelete, standalone = false, ...queueControls }: Props) {
  const [sharing, setSharing] = useState(false);
  const [section, setSection] = useState<"friends" | "external">(owner ? "friends" : "external");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [confirmRecipients, setConfirmRecipients] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const publicPack = pack.distribution === "worldwide" || (pack.distribution === "alist" && pack.aListPublic);
  const title = packTypeLabel(pack.kind);
  const current = queueControls.activePackId === undefined || queueControls.activePackId === pack.id
    ? pack.items.find(({ dub }) => dub.id === playback.nowPlayingId)?.dub : undefined;
  const published = pack.status === "published";
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(""); setMessage("");
    try { await action(); }
    catch (failure) {
      setMessage("");
      if (failure instanceof PackSignInRequired) signInForPack(pack.id);
      else setError(failure instanceof Error ? failure.message : "The action failed. Please try again.");
    } finally { busy.current = false; setPending(false); }
  }
  function download() {
    if (!authenticated) { signInForPack(pack.id); return; }
    void run(async () => {
      setDownloading(true);
      setMessage("Preparing ZIP download. Larger packs may take a moment.");
      try {
        await downloadPack(pack.id); await onRefresh();
        setMessage("Pack downloaded. Each dub's like is counted once.");
      } finally { setDownloading(false); }
    });
  }
  function selectLink() {
    linkRef.current?.focus(); linkRef.current?.select();
    setMessage("Link selected. Copy it using your browser or keyboard.");
  }
  const eligible = buddies.filter((buddy) => pack.distribution !== "alist" || pack.aListPublic || buddy.aListApproved);
  const matchingFriends = eligible.filter((buddy) => `${buddy.displayName} ${buddy.username}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <article className={`pack-view media-kind--${pack.kind}${pack.distribution === "alist" ? " pack-view--alist" : ""}`} aria-label={`${title}: ${pack.title}`}>
      <DubPackIdentity pack={pack} />
      {!published && <p className="pack-notice">Only you can see this draft. Add your files and review the pack before publishing.</p>}
      <div className="pack-actions">
        {published && <div className="pack-actions__primary">
          <PackPlaybackButton kind={pack.kind} playing={Boolean(current && playback.isPlaying)} preview={!authenticated}
            disabled={!pack.items.length || !published} onClick={() => {
              const tracks = pack.items.map(({ dub }) => dub);
              if (queueControls.onActivateQueue?.(tracks, pack.id) === false) return;
              if (current) onPlay(current);
              else onPlayAll(tracks, pack.id);
            }} />
          <Button variant="secondary" disabled={pending || !pack.items.length || !published} loading={downloading} onClick={download}>{authenticated ? "Download pack (ZIP)" : "Sign in to download pack"}</Button>
        </div>}
        <div className="pack-actions__secondary">
        {published && (owner || publicPack) && <Button variant="secondary" onClick={() => setSharing(!sharing)} aria-expanded={sharing}>Share pack</Button>}
        {owner && <Button variant={published ? "tertiary" : "primary"} onClick={onEdit}>{published ? "Edit pack" : "Continue editing"}</Button>}
        {owner && pack.distribution === "private" && published && <Button variant="tertiary" onClick={() => { setSharing(true); setSection("friends"); }}>
          Manage access · {pack.grants?.length ?? 0}</Button>}
        </div>
      </div>
      {error && <p role="alert" className="pack-error">{error}</p>}
      {message && <p role="status" className="pack-notice">{message}</p>}
      {!authenticated && <p className="pack-notice">Short previews only. Sign in to hear full files and download. Download access does not grant sample reuse rights.</p>}
      {current && !standalone && <p role="status">{playback.isPlaying ? "Now playing from this pack" : "Pack playback paused"}</p>}
      {standalone && current && <label className="pack-volume">Volume<input aria-label="Volume" type="range" min={0} max={100} value={Math.round(playback.volume * 100)} onChange={(event) => onVolume(Number(event.currentTarget.value) / 100)} /></label>}
      <section className="pack-playlist" aria-label="Playlist">
      <h2>{pack.kind === "sample" ? "Samples" : "Tracks"} <span className="pack-muted">({pack.items.length})</span></h2>
      {!pack.items.length && <p className="pack-empty">No files in this pack yet. Continue editing to add uploads.</p>}
      <PackPlaylist {...queueControls} pack={pack} label={pack.kind === "sample" ? "Pack samples" : "Pack tracks"}
        nowPlayingId={playback.nowPlayingId} isPlaying={playback.isPlaying}
        currentTimeSeconds={playback.currentTime} durationSeconds={playback.duration}
        volume={playback.volume} playbackError={playback.playbackError}
        onPlay={onPlay} onPlayAll={onPlayAll} onSeekProgress={onSeek} onVolumeChange={onVolume}
        disabled={!published} downloadDisabled={pending || !published}
        onDownload={(dub) => {
              if (!authenticated) signInForPack(pack.id);
              else void run(async () => { await onDownloadDub(dub); await onRefresh(); setMessage(`${dub.title} downloaded.`); });
        }} />
      </section>
      {published && <details className="pack-help"><summary>About downloads{pack.kind === "sample" ? " and usage rights" : ""}</summary>
        <p>Downloads count as likes on the individual dubs. Repeat downloads keep one copy of each in My Library.</p>
        <p>The ZIP contains all {pack.items.length} files ({pack.kind === "sample" ? "including usage licence terms" : "in pack order"}). Downloaded files cannot be recalled.</p>
      </details>}
      {pack.kind === "sample" && <section className="pack-notice"><h2>Usage licence</h2><p className="pack-licence">{pack.licence || "No reuse licence has been provided."}</p></section>}
      {sharing && <section className="pack-share" aria-label="Share pack">
        <div className="pack-toolbar"><h2>{owner ? "Share pack" : "External link"}</h2><Button variant="tertiary" onClick={() => setSharing(false)}>Close sharing</Button></div>
        {publicPack && owner && <div className="pack-toolbar" role="group" aria-label="Pack sharing options">
          <Button variant={section === "friends" ? "primary" : "secondary"} onClick={() => setSection("friends")} aria-pressed={section === "friends"}>Friends</Button>
          <Button variant={section === "external" ? "primary" : "secondary"} onClick={() => setSection("external")} aria-pressed={section === "external"}>External link</Button>
        </div>}
        {section === "external" && publicPack ? <>
          <h2>External link</h2><p>Anyone with this link can preview this pack. Full playback and downloads require sign-in.</p>
          <label>Pack share link<input ref={linkRef} readOnly value={packUrl(pack.id)} /></label>
          <div className="pack-toolbar"><Button disabled={pending} onClick={() => void run(async () => {
            if (!navigator.clipboard?.writeText) throw new Error("Copy is unavailable. Use Select link and copy it manually.");
            try { await navigator.clipboard.writeText(packUrl(pack.id)); }
            catch { throw new Error("We couldn't copy the link. Use Select link and copy it manually."); }
            setMessage("Pack link copied.");
          })}>Copy link</Button><Button variant="secondary" onClick={selectLink}>Select link</Button></div>
        </> : owner ? <>
          <h2>Share with friends</h2>
          <p>Recipients get access to this pack's current files. Adding files later requires explicit confirmation. Separately granted dub access is unaffected by pack revocation.</p>
          <SearchField aria-label="Search friends" placeholder="Search friends" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          <div className="pack-picker">{matchingFriends.map((buddy) =>
            <label key={buddy.id} className="pack-check"><input type="checkbox" checked={recipients.includes(buddy.id)} onChange={(event) => setRecipients(event.currentTarget.checked ? [...recipients, buddy.id] : recipients.filter((id) => id !== buddy.id))} />{buddy.displayName} @{buddy.username}</label>)}</div>
          {!eligible.length && <p>Add eligible friends in Friend List before sharing.</p>}
          {eligible.length > 0 && !matchingFriends.length && <p>No friends match your search.</p>}
          {recipients.length > 0 && <p className="pack-muted">{recipients.length} {recipients.length === 1 ? "friend" : "friends"} selected</p>}
          {pack.distribution === "private" && <label className="pack-check">
            <input type="checkbox" checked={confirmRecipients} onChange={(event) => setConfirmRecipients(event.currentTarget.checked)} />
            Grant selected friends access to all files currently in this pack.</label>}
          <Button disabled={pending || !recipients.length || (pack.distribution === "private" && !confirmRecipients)} onClick={() => void run(async () => {
            for (const buddyId of recipients) {
              await packRequest(`/api/conversations/${encodeURIComponent(buddyId)}/messages`, "POST", {
                text: `Shared a ${title}: ${pack.title}`, packId: pack.id, confirmPackAccess: confirmRecipients,
              });
              setRecipients((current) => current.filter((id) => id !== buddyId));
            }
            await onRefresh(); setRecipients([]); setConfirmRecipients(false); setMessage("Pack shared with the selected friends.");
          })}>Share with selected friends</Button>
          {pack.distribution === "private" && <section aria-label="Pack access"><h3>Current access</h3>
            {pack.grants?.length ? <ul>{pack.grants.map((grant) => <li key={grant.id} className="pack-toolbar"><span>{grant.displayName}</span>
              <Button size="small" variant="secondary" disabled={pending} aria-label={`Revoke pack access for ${grant.displayName}`} onClick={() => void run(async () => {
                await packRequest(`/api/packs/${pack.id}/grants/${encodeURIComponent(grant.id)}`, "DELETE");
                await onRefresh(); setMessage("Pack access revoked. Separate dub grants and downloaded files are unaffected.");
              })}>Revoke</Button></li>)}</ul> : <p>No friends currently have pack access.</p>}
          </section>}
          <p>Revoking access cannot recall files already downloaded.</p>
        </> : <p>Use External link to share this public pack. Private sharing is managed by its uploader.</p>}
      </section>}
      {owner && onDelete && <footer className="pack-danger"><Button variant="tertiary" disabled={pending} onClick={() => setConfirmDelete(!confirmDelete)}>Delete pack</Button>
        {confirmDelete && <div role="group" aria-label="Confirm pack deletion"><p>Delete this pack? Its files remain in Your Dubs or Your Samples based on their remaining published pack memberships. Pack-only access will be removed; downloaded files cannot be recalled.</p>
          <Button disabled={pending} onClick={() => void run(async () => { await packRequest(`/api/packs/${pack.id}`, "DELETE"); await onRefresh(); onDelete(); })}>Confirm delete pack</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button></div>}</footer>}
    </article>
  );
}
