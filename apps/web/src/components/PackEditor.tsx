import { useRef, useState, type FormEvent } from "react";
import { Button, NowPlaying, ProgressBar, SearchField, TrackArtwork, type ArtistOption, type Dub } from "@craft/ui";
import { uploadFile } from "../services/uploadFile";
import { readAudioDurationSeconds } from "../services/readAudioDuration";
import { canAddDubToPack, packAudience, packFileCount, packRequest, packTypeLabel, type Pack, type PackDetails } from "../services/packs";
import { PackTrackFields, packTrackMetadata, type PackTrackValues } from "./PackTrackFields";

interface Props {
  pack: Pack;
  dubs: Dub[];
  artists: ArtistOption[];
  approved: boolean;
  onSaved: (pack: Pack) => void;
  onClose: () => void;
  onCommunityChange: () => Promise<void>;
}
interface UploadRow extends PackTrackValues {
  id: number;
  file: File;
  progress: number;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
}

export function PackEditor({ pack: initial, dubs, artists, approved, onSaved, onClose, onCommunityChange }: Props) {
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
  const [dirty, setDirty] = useState(false);
  const busy = useRef(false);
  const nextRow = useRef(0);
  const uploadIds = useRef(new Map<number, string>());
  const allDubs = new Map([...dubs, ...pack.items.map(({ dub }) => dub)].map((dub) => [dub.id, dub]));
  const label = details.kind === "sample" ? "samples" : "tracks";
  const published = pack.status === "published";
  const addedMembers = selectedIds.some((id) => !initial.items.some(({ dub }) => dub.id === id));
  const needsConfirmation = published && pack.distribution === "private" && Boolean(pack.grants?.length) && addedMembers;
  const pendingRows = rows.filter((row) => row.state !== "done");
  const matchingDubs = dubs.filter((dub) => `${dub.title} ${dub.artist} ${dub.genre}`.toLowerCase().includes(query.trim().toLowerCase()));
  const hasChanges = dirty || itemDirty || pendingRows.length > 0;
  function goToStep(next: number) {
    if (busy.current) return;
    if (itemDirty && !window.confirm("Discard unsaved file details? Your saved pack files will remain.")) return;
    setEditingItem(null); setItemDirty(false);
    setStep(next);
    setError("");
  }

  function change<K extends keyof PackDetails>(key: K, value: PackDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
    setDirty(true);
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
    let artworkUploadId: string | undefined;
    if (artwork) artworkUploadId = (await uploadFile(artwork, "artwork", () => {})).uploadId;
    const { pack: updated } = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}`, "PATCH", {
      ...details, dubIds: nextIds, confirmNewAccess: confirmed, artworkUploadId,
    });
    setPack(updated); setArtwork(null); setDirty(false); setSaved(published ? "Changes saved." : "Draft saved.");
    return updated;
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
    setDirty(true); setSaved("");
  }
  function updateRow(id: number, patch: Partial<UploadRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    setDirty(true);
  }
  async function uploadRows() {
    await run(async () => {
      if (published && pack.distribution === "private" && pack.grants?.length && !confirmed) {
        throw new Error("Confirm that existing recipients may access the new files before uploading.");
      }
      await save();
      let updated = pack;
      const ids = [...selectedIds];
      let failures = 0;
      for (const row of rows.filter((item) => item.state === "waiting" || item.state === "failed")) {
        updateRow(row.id, { state: "uploading", error: "" });
        try {
          const metadata = packTrackMetadata(row);
          if (row.file.size > 100 * 1024 * 1024) throw new Error("Audio files must be 100 MB or smaller.");
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
      await onCommunityChange();
      if (failures) throw new Error(`${failures} file upload${failures === 1 ? "" : "s"} failed. Successful files are saved; retry only failed files.`);
      setDirty(false); setSaved("All files uploaded and saved.");
    });
  }
  function close() {
    if (!hasChanges) { onClose(); return; }
    if (window.confirm("Leave the editor? Unsaved edits and files not yet uploaded will be lost. Saved files remain in the pack.")) onClose();
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...selectedIds];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setSelectedIds(next); setDirty(true);
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (step < 2) { goToStep(step + 1); return; }
    await run(async () => {
      if (rows.some((row) => row.state !== "done")) throw new Error("Upload or remove all pending and failed files before publishing.");
      if (itemDirty) throw new Error("Save or close the file details before publishing.");
      if (selectedIds.length === 0) throw new Error("Add at least one file before publishing.");
      if (details.kind === "sample" && !details.licence.trim()) throw new Error("Provide usage licence terms before publishing a Sample Pack.");
      await save();
      const { pack: updated } = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}/publish`, "POST");
      await onCommunityChange();
      onSaved(updated);
    });
  }
  return (
    <section className="pack-editor" aria-label="Pack editor" aria-busy={pending}>
      <header className="pack-toolbar"><div><span className="eyebrow">{packTypeLabel(details.kind)}</span><h1>{published ? "Edit pack" : "Create pack"}</h1>
        <p className="pack-muted">{hasChanges ? "Unsaved changes" : published ? "Published release" : "Private draft"} · {packFileCount(details.kind, selectedIds.length)}</p></div>
        <Button onClick={close} disabled={pending} variant="tertiary">Close editor</Button></header>
      <nav className="pack-steps" aria-label="Pack creation steps">
        {["Details", "Add files", "Arrange & review"].map((name, index) => <Button key={name}
          aria-current={step === index ? "step" : undefined} variant={step === index ? "primary" : "secondary"}
          disabled={pending} onClick={() => goToStep(index)}>{index + 1}. {name}</Button>)}
      </nav>
      <form onSubmit={(event) => void publish(event)}>
        <fieldset disabled={pending} className="pack-fields">
          {step === 0 && <>
            <div className="pack-field-grid">
            <label>Pack type<select value={details.kind} onChange={(event) => change("kind", event.currentTarget.value === "sample" ? "sample" : "dub")}>
              <option value="dub">Dub Pack</option><option value="sample">Sample Pack</option></select></label>
            <label>Pack title<input required maxLength={100} value={details.title} onChange={(event) => change("title", event.currentTarget.value)} /></label>
            </div>
            <label>Description<textarea maxLength={2000} value={details.description} onChange={(event) => change("description", event.currentTarget.value)} /></label>
            <label>Pack artwork (optional)<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => { setArtwork(event.currentTarget.files?.[0] ?? null); setDirty(true); }} /></label>
            <p className="pack-muted">Without custom artwork, the first file's artwork is used.</p>
            <label>Distribution<select disabled={published || pack.items.length > 0} value={details.distribution} onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === "worldwide" || value === "private" || value === "alist") change("distribution", value);
            }}><option value="worldwide">Worldwide</option><option value="private">Private</option><option value="alist" disabled={!approved}>A-List</option></select></label>
            <p className="pack-muted">{published ? "The audience is fixed for this published pack." : pack.items.length ? "Remove all saved files before changing the audience." : "Choose the audience before adding files. Existing dubs must match it."} Publishing never broadens a dub's permissions.</p>
            {details.distribution === "alist" && <label className="pack-check"><input type="checkbox" checked={details.aListPublic}
              disabled={published || pack.items.length > 0} onChange={(event) => change("aListPublic", event.currentTarget.checked)} />Public A-List pack</label>}
            {details.kind === "sample" && <label>Usage licence<textarea aria-label="Usage licence" maxLength={4000} value={details.licence} onChange={(event) => change("licence", event.currentTarget.value)}
              placeholder="Explain permitted uses, attribution and any restrictions." />
              <small>Required to publish. Download access alone does not grant reuse rights. Only license content you have permission to distribute.</small></label>}
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
                <PackTrackFields values={row} artists={artists} sample={details.kind === "sample"} onChange={(patch) => updateRow(row.id, patch)} />
                <Button variant="tertiary" aria-label={`Remove ${row.file.name}`} onClick={() => { uploadIds.current.delete(row.id); setRows((current) => current.filter((item) => item.id !== row.id)); setDirty(true); }}>Remove file</Button>
              </>}
              {row.error && <p role="alert">{row.error}</p>}
            </article>)}
            {pendingRows.length > 0 && <Button loading={pending} onClick={() => void uploadRows()}>{pendingRows.some((row) => row.state === "failed") ? "Retry failed uploads" : "Upload files"} ({pendingRows.length})</Button>}
            <h2>Choose existing uploads</h2>
            <SearchField aria-label="Search your uploads" placeholder="Search titles, artists or genres" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
            {!matchingDubs.length && <p className="pack-empty">{dubs.length ? "No uploads match your search." : "No existing uploads yet. Add audio files above to get started."}</p>}
            <div className="pack-picker">{matchingDubs.map((dub) => {
              const compatible = canAddDubToPack(details, dub);
              return <label className="pack-check" key={dub.id}><input type="checkbox" disabled={!compatible || (selectedIds.length >= 50 && !selectedIds.includes(dub.id))}
                checked={selectedIds.includes(dub.id)} onChange={(event) => { setSelectedIds(event.currentTarget.checked ? [...selectedIds, dub.id] : selectedIds.filter((id) => id !== dub.id)); setDirty(true); }} />
                <span>{dub.title}<small>{compatible ? dub.artist : "Different distribution: this dub cannot be added."}</small></span></label>;
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
                  setSelectedIds(next); setDraggedId(null); setDirty(true);
                }}>{dub ? <NowPlaying artist={dub.artist} title={dub.title} artworkContent={<TrackArtwork dub={dub} />} isPlaying={false} /> : <strong>Unavailable file</strong>}
                <div className="pack-toolbar">
                  <Button size="small" variant="secondary" disabled={index === 0} aria-label={`Move ${dub?.title} up`} onClick={() => move(index, -1)}>Move up</Button>
                  <Button size="small" variant="secondary" disabled={index === selectedIds.length - 1} aria-label={`Move ${dub?.title} down`} onClick={() => move(index, 1)}>Move down</Button>
                  <Button size="small" variant="tertiary" aria-expanded={editingItem === id} aria-label={`Edit details for ${dub?.title ?? "unavailable file"}`} onClick={() => {
                    if (itemDirty && !window.confirm("Discard unsaved file details? Your saved pack files will remain.")) return;
                    setEditingItem(editingItem === id ? null : id); setItemDirty(false);
                  }}>{editingItem === id ? "Close details" : "Edit details"}</Button>
                  <Button size="small" variant="tertiary" aria-label={`Remove ${dub?.title ?? "unavailable file"} from pack`} onClick={() => {
                    setSelectedIds(selectedIds.filter((item) => item !== id)); setDirty(true);
                    if (editingItem === id) { setEditingItem(null); setItemDirty(false); }
                  }}>Remove from pack</Button>
                </div>
                {editingItem === id && dub && <PackItemEditor dub={dub} artists={artists} packId={pack.id} sample={details.kind === "sample"} initialKey={pack.items.find((item) => item.dub.id === id)?.key}
                  onSave={(updated) => { setPack(updated); setEditingItem(null); setItemDirty(false); }} onDirty={() => setItemDirty(true)} onError={setError} onCommunityChange={onCommunityChange}
                  onBusyChange={(value) => { busy.current = value; setPending(value); }} />}
              </li>;
            })}</ol>
            {details.kind === "sample" && <section><h3>Usage licence</h3><p className="pack-licence">{details.licence || "Add licence terms in Details before publishing."}</p></section>}
            {needsConfirmation && <label className="pack-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />Grant existing pack recipients access to newly added files. Separate dub grants are unaffected.</label>}
            <p>Removing a pack keeps its dubs. Removing private access cannot recall files already downloaded.</p>
          </>}
        </fieldset>
        {error && <p role="alert" className="pack-error">{error}</p>}
        {saved && <p role="status">{saved}</p>}
        <footer className="pack-editor__footer">
          {itemDirty && <p className="pack-muted">Save or close the file details before saving this pack.</p>}
          <Button variant="secondary" disabled={pending || itemDirty || rows.some((row) => row.state !== "done") || (needsConfirmation && !confirmed)}
            onClick={() => void run(async () => { const updated = await save(); await onCommunityChange(); onSaved(updated); })}>Save {published ? "changes" : "draft"}</Button>
          {step > 0 && <Button variant="tertiary" disabled={pending} onClick={() => goToStep(step - 1)}>Previous</Button>}
          {step < 2 ? <Button disabled={pending} onClick={() => goToStep(step + 1)}>Next</Button>
            : <Button type="submit" disabled={pending || (needsConfirmation && !confirmed)} loading={pending}>{published ? "Save & publish" : "Publish pack"}</Button>}
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
