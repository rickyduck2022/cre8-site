import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, NowPlaying, ProgressBar, SearchField, TrackArtwork, useReportTutorialActivity, type ArtistOption, type Dub } from "@craft/ui";
import { uploadFile } from "../services/uploadFile";
import { readAudioDurationSeconds } from "../services/readAudioDuration";
import { canAddDubToPack, packAudience, packFileCount, packRequest, packTypeLabel, type Pack, type PackDetails } from "../services/packs";
import { PackTrackFields, packTrackMetadata, type PackTrackValues } from "./PackTrackFields";
import "./AListApplication.css";

interface Props {
  pack: Pack;
  dubs: Dub[];
  artists: ArtistOption[];
  approved: boolean;
  onSaved: (pack: Pack) => void;
  onClose: () => void;
  onCommunityChange: () => Promise<void>;
  creating?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}
interface UploadRow extends PackTrackValues {
  id: number;
  file: File;
  progress: number;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
}

export function PackEditor({ pack: initial, dubs, artists, approved, onSaved, onClose, onCommunityChange, creating = false, onBusyChange, onDirtyChange }: Props) {
  const reportActivity = useReportTutorialActivity();
  const [pack, setPack] = useState(initial);
  const [details, setDetails] = useState<PackDetails>({
    title: initial.title, description: initial.description, kind: initial.kind,
    distribution: initial.distribution, aListPublic: initial.aListPublic, licence: initial.licence,
  });
  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState(initial.items.map(({ dub }) => dub.id));
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [artwork, setArtwork] = useState<File | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemDirty, setItemDirty] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [refreshNeeded, setRefreshNeeded] = useState<Pack | null>(null);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const artworkUpload = useRef<{ file: File; id: string } | null>(null);
  const licenceInput = useRef<HTMLTextAreaElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const stepTitleId = useId();
  const nextRow = useRef(0);
  const uploadIds = useRef(new Map<number, string>());
  const allDubs = new Map([...pack.items.map(({ dub }) => dub), ...dubs].map((dub) => [dub.id, dub]));
  const label = details.kind === "vocal" ? "vocals" : details.kind === "sample" ? "samples" : "tracks";
  const published = pack.status === "published";
  const addedMembers = selectedIds.some((id) => !pack.items.some(({ dub }) => dub.id === id));
  const needsConfirmation = published && pack.distribution === "private" && Boolean(pack.grants?.length) && addedMembers;
  const pendingRows = rows.filter((row) => row.state !== "done");
  const matchingDubs = dubs.filter((dub) => `${dub.title} ${dub.artist} ${dub.genre}`.toLowerCase().includes(query.trim().toLowerCase()));
  const detailsChanged = (Object.keys(details) as (keyof PackDetails)[]).some((key) => details[key] !== pack[key]);
  const orderChanged = selectedIds.length !== pack.items.length || selectedIds.some((id, index) => id !== pack.items[index]?.dub.id);
  const hasChanges = detailsChanged || orderChanged || Boolean(artwork) || itemDirty || pendingRows.length > 0;
  useEffect(() => { onBusyChange?.(pending); }, [pending, onBusyChange]);
  useEffect(() => { onDirtyChange?.(hasChanges); }, [hasChanges, onDirtyChange]);
  useEffect(() => () => { onBusyChange?.(false); onDirtyChange?.(false); }, [onBusyChange, onDirtyChange]);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  useEffect(() => {
    if (!hasChanges && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges, pending]);
  function goToStep(next: number) {
    if (busy.current || refreshNeeded) return;
    if (next > step) {
      if (!details.title.trim()) {
        setError("Provide a pack title."); titleInput.current?.focus(); return;
      }
      if (details.kind !== "dub" && !details.licence.trim()) {
        setStep(0); setError("Provide usage licence terms before continuing with a Sample or Vocal Pack.");
        requestAnimationFrame(() => licenceInput.current?.focus());
        return;
      }
      if (next === 2 && pendingRows.length) {
        void uploadRows(next); return;
      }
    }
    if (itemDirty && !window.confirm("Discard unsaved file details? Your saved pack files will remain.")) return;
    setEditingItem(null); setItemDirty(false);
    setStep(next);
    setError("");
  }

  function change<K extends keyof PackDetails>(key: K, value: PackDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
    setSaved("");
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true); setError(""); setSaved("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The pack could not be saved."); }
    finally { busy.current = false; setPending(false); }
  }
  async function save(nextIds = selectedIds) {
    if (!details.title.trim()) throw new Error("Provide a pack title.");
    if (published && !nextIds.length) throw new Error("A published pack must keep at least one file.");
    if (published && details.kind !== "dub" && !details.licence.trim()) throw new Error("Provide usage licence terms for this Sample or Vocal Pack.");
    if (needsConfirmation && !confirmed) throw new Error("Confirm access for existing recipients before adding files.");
    for (const id of nextIds) {
      const dub = allDubs.get(id);
      if (dub && !canAddDubToPack(details, dub)) throw new Error(`"${dub.title}" has an incompatible media type or audience. Dub Packs accept dubs; Sample Packs accept samples and vocals; Vocal Packs accept only vocals.`);
    }
    let artworkUploadId: string | undefined;
    if (artwork) {
      if (artworkUpload.current?.file !== artwork) {
        artworkUpload.current = { file: artwork, id: (await uploadFile(artwork, "artwork", () => {})).uploadId };
      }
      artworkUploadId = artworkUpload.current.id;
    }
    const { pack: updated } = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}`, "PATCH", {
      ...details, dubIds: nextIds, confirmNewAccess: confirmed, artworkUploadId,
    });
    setPack(updated); setSelectedIds(updated.items.map(({ dub }) => dub.id));
    setDetails({ title: updated.title, description: updated.description, kind: updated.kind,
      distribution: updated.distribution, aListPublic: updated.aListPublic, licence: updated.licence });
    setArtwork(null); artworkUpload.current = null; setConfirmed(false);
    setSaved(published ? "Changes saved." : "Draft saved.");
    return updated;
  }
  async function finish(updated: Pack) {
    try { await onCommunityChange(); }
    catch {
      setRefreshNeeded(updated);
      throw new Error("Your pack was saved, but the community could not be refreshed. Retry refresh without saving again.");
    }
    setRefreshNeeded(null);
    reportActivity({ type: "pack-saved", subjectId: updated.id });
    onSaved(updated);
  }
  function addFiles(files: FileList | null) {
    if (!files) return;
    const selected = [...files];
    const identities = new Set(rows.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`));
    for (const file of selected) {
      const identity = `${file.name}:${file.size}:${file.lastModified}`;
      if (identities.has(identity)) {
        setError(`${file.name} is already in this upload selection. Choose each file once.`);
        return;
      }
      identities.add(identity);
    }
    if (selected.length + rows.filter((row) => row.state !== "done").length + selectedIds.length > 50) {
      setError("A pack can contain up to 50 files. Remove some files before adding more."); return;
    }
    setRows((current) => [...current, ...selected.map((file): UploadRow => ({
      id: nextRow.current++, file, title: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
      bpm: "", key: "", tags: "", artistId: artists[0]?.id ?? "",
      progress: 0, state: "waiting",
    }))]);
    setSaved("");
  }
  function updateRow(id: number, patch: Partial<UploadRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    setSaved("");
  }
  async function uploadRows(nextStep: number) {
    await run(async () => {
      if (!details.title.trim()) throw new Error("Provide a pack title.");
      if (details.kind !== "dub" && !details.licence.trim()) throw new Error("Provide usage licence terms before continuing with a Sample or Vocal Pack.");
      for (const row of pendingRows) {
        try {
          packTrackMetadata(row);
          if (row.file.size > 100 * 1024 * 1024) throw new Error("Audio files must be 100 MB or smaller.");
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : "Check the file details.";
          updateRow(row.id, { state: "failed", error: message });
          throw new Error(`${row.file.name}: ${message}`);
        }
      }
      if (published && pack.distribution === "private" && pack.grants?.length && !confirmed) {
        throw new Error("Confirm that existing recipients may access the new files before uploading.");
      }
      let updated = await save();
      const ids = updated.items.map(({ dub }) => dub.id);
      let failures = 0;
      for (const row of rows.filter((item) => item.state === "waiting" || item.state === "failed")) {
        updateRow(row.id, { state: "uploading", error: "" });
        try {
          const metadata = packTrackMetadata(row);
          const durationSeconds = await readAudioDurationSeconds(row.file);
          let uploadId = uploadIds.current.get(row.id);
          if (!uploadId) {
            uploadId = (await uploadFile(row.file, "audio", (loaded, total) => updateRow(row.id, { progress: Math.round(loaded / total * 100) }))).uploadId;
            uploadIds.current.set(row.id, uploadId);
          }
          const response = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}/tracks`, "POST", {
            ...metadata, uploadId, durationSeconds, confirmNewAccess: confirmed,
          });
          updated = response.pack;
          uploadIds.current.delete(row.id);
          for (const { dub } of updated.items) if (!ids.includes(dub.id)) ids.push(dub.id);
          updateRow(row.id, { state: "done", progress: 100 });
          setPack(updated); setSelectedIds([...ids]);
        } catch (failure) {
          failures++;
          updateRow(row.id, { state: "failed", error: failure instanceof Error ? failure.message : "Upload failed. Retry this file." });
        }
      }
      let refreshError = "";
      try { await onCommunityChange(); }
      catch { refreshError = "Files were saved, but the community could not be refreshed. Reload the page to refresh the community."; }
      if (failures) throw new Error(`${failures} file upload${failures === 1 ? "" : "s"} failed. Successful files are saved; retry only failed files.${refreshError ? ` ${refreshError}` : ""}`);
      setSaved("All files uploaded and saved.");
      setStep(nextStep); setEditingItem(null); setItemDirty(false);
      if (refreshError) throw new Error(refreshError);
      reportActivity({ type: "file-uploaded", subjectId: updated.id });
    });
  }
  function close() {
    if (busy.current) return;
    if (!hasChanges) { onClose(); return; }
    if (window.confirm("Leave the editor? Unsaved edits and files not yet uploaded will be lost. Saved files remain in the pack.")) onClose();
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...selectedIds];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setSelectedIds(next); setSaved("");
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (refreshNeeded) return;
    if (step < 2) { goToStep(step + 1); return; }
    if (published) {
      if (!hasChanges || itemDirty || pendingRows.length || !selectedIds.length || (needsConfirmation && !confirmed)) return;
      await run(async () => { await finish(await save()); });
      return;
    }
    await run(async () => {
      if (rows.some((row) => row.state !== "done")) throw new Error("Upload or remove all pending and failed files before publishing.");
      if (itemDirty) throw new Error("Save or close the file details before publishing.");
      if (selectedIds.length === 0) throw new Error("Add at least one file before publishing.");
      if (details.kind !== "dub" && !details.licence.trim()) throw new Error("Provide usage licence terms before publishing a Sample or Vocal Pack.");
      await save();
      const { pack: updated } = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}/publish`, "POST");
      await finish(updated);
    });
  }
  return (
    <section className="pack-editor" aria-label="Pack editor" aria-busy={pending}>
      <header className="pack-toolbar"><div><span className="eyebrow">{packTypeLabel(details.kind)}</span><h1 ref={heading} tabIndex={-1}>{creating ? "Create pack" : "Edit pack"}</h1>
        <p className="pack-muted">{hasChanges ? "Unsaved changes" : published ? "Published release" : "Private draft"} · {packFileCount(details.kind, selectedIds.length)}</p></div>
        <Button onClick={close} disabled={pending} variant="tertiary">Close editor</Button></header>
      {published && <p className="pack-notice">You are editing <strong>{pack.title}</strong>. Saved changes are immediately visible to members who can access this release. Its audience stays unchanged.</p>}
      <nav className="pack-steps" aria-label={creating ? "Pack creation steps" : "Pack editing steps"}>
        {["Details", "Add files", "Arrange & review"].map((name, index) => <Button key={name}
          aria-current={step === index ? "step" : undefined} variant={step === index ? "primary" : "secondary"}
          disabled={pending} onClick={() => goToStep(index)}>{index + 1}. {name}</Button>)}
      </nav>
      <form className="pack-editor__form" onSubmit={(event) => void publish(event)}>
        <section className="pack-editor__section" aria-labelledby={stepTitleId}>
          <header className="pack-editor__section-heading">
            <span className="pack-editor__section-number" aria-hidden="true">{String(step + 1).padStart(2, "0")}</span>
            <div><h2 ref={stepHeading} tabIndex={-1} id={stepTitleId}>{["Release details", "Select your files", "Arrange & review"][step]}</h2>
              <p>{["Name your release, choose its audience and set sample/vocal usage terms.", "Choose existing uploads or add new audio. Next uploads queued files before review.", "Check the running order and file details before saving or publishing."][step]}</p></div>
          </header>
        <fieldset disabled={pending || Boolean(refreshNeeded)} className="pack-fields">
          {step === 0 && <>
            <div className="pack-field-grid">
            <label>Pack type<select value={details.kind} onChange={(event) => change("kind", event.currentTarget.value === "vocal" ? "vocal" : event.currentTarget.value === "sample" ? "sample" : "dub")}>
              <option value="dub">Dub Pack</option><option value="sample">Sample Pack</option><option value="vocal">Vocal Pack</option></select></label>
            <p className="pack-muted">Dub Packs accept dubs. Sample Packs accept samples and vocals. Vocal Packs accept only vocals. New uploads use the selected pack type.</p>
            <label>Pack title<input ref={titleInput} required maxLength={100} value={details.title} onChange={(event) => change("title", event.currentTarget.value)} /></label>
            </div>
            <label>Description<textarea maxLength={2000} value={details.description} onChange={(event) => change("description", event.currentTarget.value)} /></label>
            <label>Pack artwork (optional)<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => { setArtwork(event.currentTarget.files?.[0] ?? null); setSaved(""); }} /></label>
            {pack.artworkUrl && !artwork && <p className="pack-muted">Current artwork will be kept unless you choose a replacement.</p>}
            <p className="pack-muted">Without custom artwork, the first file's artwork is used.</p>
            <label>Distribution<select disabled={published || pack.items.length > 0} value={details.distribution} onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === "worldwide" || value === "private" || value === "alist") change("distribution", value);
            }}><option value="worldwide">Worldwide</option><option value="private">Private</option><option value="alist" disabled={!approved}>A-List</option></select></label>
            <p className="pack-muted">{published ? "The audience is fixed for this published pack." : pack.items.length ? "Remove all saved files before changing the audience." : "Choose the audience before adding files. Existing dubs must match it."} Publishing never broadens a dub's permissions.</p>
            {details.distribution === "alist" && <label className="pack-check"><input type="checkbox" checked={details.aListPublic}
              disabled={published || pack.items.length > 0} onChange={(event) => change("aListPublic", event.currentTarget.checked)} />Public A-List pack</label>}
            {details.kind !== "dub" && <label>Usage licence<textarea ref={licenceInput} aria-label="Usage licence" aria-invalid={Boolean(error && !details.licence.trim())} maxLength={4000} value={details.licence} onChange={(event) => change("licence", event.currentTarget.value)}
              placeholder="Explain permitted uses, attribution and any restrictions." />
              <small>Required to continue. Download access alone does not grant reuse rights. Only license content you have permission to distribute.</small></label>}
          </>}
          {step === 1 && <>
            <h2>Add {label}</h2><p className="pack-muted">Up to 50 files · 100 MB per file · 500 MB per pack. Successful uploads are saved individually.</p>
            {published && pack.distribution === "private" && Boolean(pack.grants?.length) && <label className="pack-check">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />
              Grant existing pack recipients access to files added in this session.</label>}
            <label>Upload audio files<input type="file" multiple accept=".wav,.mp3,.ogg,.m4a,.aac,.flac,.webm" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
            {rows.map((row) => <article className="pack-upload" key={row.id} aria-label={`Upload ${row.file.name}`}>
              <strong>{row.file.name}</strong><span role="status">{row.state === "uploading" ? `Uploading ${row.progress}%` : row.state === "done" ? "Uploaded" : row.state === "failed" ? "Failed" : "Ready to upload"}</span>
              {row.state === "uploading" && <ProgressBar label={`Uploading ${row.file.name}`} value={row.progress} />}
              {row.state !== "done" && <>
                <PackTrackFields values={row} artists={artists} sample={details.kind !== "dub"} onChange={(patch) => updateRow(row.id, patch)} />
                <Button variant="tertiary" aria-label={`Remove ${row.file.name}`} onClick={() => { uploadIds.current.delete(row.id); setRows((current) => current.filter((item) => item.id !== row.id)); setSaved(""); }}>Remove file</Button>
              </>}
              {row.error && <p role="alert">{row.error}</p>}
            </article>)}
            {pendingRows.length > 0 && <p className="pack-muted" role="status">{pendingRows.length} {pendingRows.length === 1 ? "file" : "files"} queued. Choose Next to upload{pendingRows.some((row) => row.state === "failed") ? " or retry failed files" : ""} and continue.</p>}
            <h2>Choose existing uploads</h2>
            <SearchField aria-label="Search your uploads" placeholder="Search titles, artists or genres" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
            {!matchingDubs.length && <p className="pack-empty">{dubs.length ? "No uploads match your search." : "No existing uploads yet. Add audio files above to get started."}</p>}
            <div className="pack-picker">{matchingDubs.map((dub) => {
              const compatible = canAddDubToPack(details, dub);
              return <label className="pack-check" key={dub.id}><input type="checkbox" disabled={(!compatible && !selectedIds.includes(dub.id)) || (selectedIds.length >= 50 && !selectedIds.includes(dub.id))}
                checked={selectedIds.includes(dub.id)} onChange={(event) => { setSelectedIds(event.currentTarget.checked ? [...selectedIds, dub.id] : selectedIds.filter((id) => id !== dub.id)); setSaved(""); }} />
                <span>{dub.title}<small>{compatible ? dub.artist : "Incompatible media type or audience. Remove this file or choose a compatible pack type."}</small></span></label>;
            })}</div>
          </>}
          {step === 2 && <>
            <h2>{packFileCount(details.kind, selectedIds.length)} · {packAudience(details)}</h2>
            <p className="pack-muted">Files play in this order. Drag to reorder, or use Move up and Move down. Metadata edits apply everywhere this dub appears.</p>
            {!selectedIds.length && <div className="pack-empty"><p>Add at least one file before publishing.</p><Button variant="secondary" onClick={() => goToStep(1)}>Add files</Button></div>}
            {pendingRows.length > 0 && <p className="pack-notice">{pendingRows.length} {pendingRows.length === 1 ? "file still needs" : "files still need"} uploading. Return to Add files to upload or remove {pendingRows.length === 1 ? "it" : "them"}.</p>}
            <ol className="pack-order">{selectedIds.map((id, index) => {
              const dub = allDubs.get(id);
              return <li key={id} draggable={!pending} onDragStart={() => setDraggedId(id)} onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => { if (draggedId) event.preventDefault(); }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggedId || draggedId === id) return;
                  const next = selectedIds.filter((item) => item !== draggedId);
                  next.splice(next.indexOf(id), 0, draggedId);
                  setSelectedIds(next); setDraggedId(null); setSaved("");
                }}>{dub ? <NowPlaying artist={dub.artist} title={dub.title} artworkContent={<TrackArtwork dub={dub} />} isPlaying={false} /> : <strong>Unavailable file</strong>}
                <div className="pack-toolbar">
                  <Button size="small" variant="secondary" disabled={index === 0} aria-label={`Move ${dub?.title} up`} onClick={() => move(index, -1)}>Move up</Button>
                  <Button size="small" variant="secondary" disabled={index === selectedIds.length - 1} aria-label={`Move ${dub?.title} down`} onClick={() => move(index, 1)}>Move down</Button>
                  <Button size="small" variant="tertiary" aria-expanded={editingItem === id} aria-label={`Edit details for ${dub?.title ?? "unavailable file"}`} onClick={() => {
                    if (itemDirty && !window.confirm("Discard unsaved file details? Your saved pack files will remain.")) return;
                    setEditingItem(editingItem === id ? null : id); setItemDirty(false);
                  }}>{editingItem === id ? "Close details" : "Edit details"}</Button>
                  <Button size="small" variant="tertiary" aria-label={`Remove ${dub?.title ?? "unavailable file"} from pack`} onClick={() => {
                    setSelectedIds(selectedIds.filter((item) => item !== id)); setSaved("");
                    if (editingItem === id) { setEditingItem(null); setItemDirty(false); }
                  }}>Remove from pack</Button>
                </div>
                {editingItem === id && dub && <PackItemEditor dub={dub} artists={artists} packId={pack.id} sample={details.kind !== "dub"} initialKey={pack.items.find((item) => item.dub.id === id)?.key}
                  onSave={(updated) => { setPack(updated); setEditingItem(null); setItemDirty(false); }} onDirty={() => setItemDirty(true)} onError={setError} onCommunityChange={onCommunityChange}
                  onBusyChange={(value) => { busy.current = value; setPending(value); }} />}
              </li>;
            })}</ol>
            {details.kind !== "dub" && <section><h3>Usage licence</h3><p className="pack-licence">{details.licence || "Add licence terms in Details before publishing."}</p></section>}
            {needsConfirmation && <label className="pack-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />Grant existing pack recipients access to newly added files. Separate dub grants are unaffected.</label>}
            <p>Removing a file from this pack does not delete the original upload. Removing private access cannot recall files already downloaded.</p>
          </>}
        </fieldset>
        </section>
        {error && <p role="alert" className="pack-error">{error}</p>}
        {saved && <p role="status">{saved}</p>}
        {refreshNeeded && <Button variant="secondary" disabled={pending} onClick={() => void run(() => finish(refreshNeeded))}>Retry refresh</Button>}
        <footer className="pack-editor__footer">
          {itemDirty && <p className="pack-muted">Save or close the file details before saving this pack.</p>}
          <Button variant={published ? "primary" : "secondary"} loading={pending}
            disabled={pending || Boolean(refreshNeeded) || (published && !hasChanges) || itemDirty || pendingRows.length > 0 || (published && !selectedIds.length) || (needsConfirmation && !confirmed)}
            onClick={() => void run(async () => { await finish(await save()); })}>Save {published ? "changes" : "draft"}</Button>
          {published && <Button variant="tertiary" disabled={pending} onClick={close}>Cancel</Button>}
          {step > 0 && <Button variant="tertiary" disabled={pending} onClick={() => goToStep(step - 1)}>Previous</Button>}
          {step < 2 ? <Button type="submit" disabled={pending || Boolean(refreshNeeded)} loading={pending}>Next</Button>
            : !published && <Button type="submit" disabled={pending || Boolean(refreshNeeded) || (needsConfirmation && !confirmed)} loading={pending}>Publish pack</Button>}
        </footer>
      </form>
    </section>
  );
}

function PackItemEditor({ dub, artists, packId, sample, initialKey, onSave, onDirty, onError, onCommunityChange, onBusyChange }: {
  dub: Dub; artists: ArtistOption[]; packId: string; sample: boolean; initialKey?: string; onSave: (pack: Pack) => void; onDirty: () => void; onError: (message: string) => void; onCommunityChange: () => Promise<void>; onBusyChange: (pending: boolean) => void;
}) {
  const [values, setValues] = useState<PackTrackValues>({
    title: dub.title, bpm: String(dub.bpm || ""), key: initialKey ?? "",
    tags: dub.tags?.join(", ") ?? dub.genre, artistId: dub.artistId ?? artists[0]?.id ?? "",
  });
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function save() {
    if (busy.current) return;
    busy.current = true; setPending(true); onBusyChange(true); onError("");
    try {
      const result = await packRequest<{ pack: Pack }>(`/api/packs/${packId}/tracks/${dub.id}`, "PATCH", {
        ...packTrackMetadata(values), ...(!sample ? { key: initialKey ?? "" } : {}),
      });
      await onCommunityChange(); onSave(result.pack);
    } catch (failure) { onError(failure instanceof Error ? failure.message : "The file details could not be saved."); }
    finally { busy.current = false; setPending(false); onBusyChange(false); }
  }
  return <div className="pack-item-editor">
    <PackTrackFields values={values} artists={artists} sample={sample} editing onChange={(patch) => { setValues((current) => ({ ...current, ...patch })); onDirty(); }} />
    <Button disabled={pending} loading={pending} onClick={() => void save()}>Save file details</Button></div>;
}
