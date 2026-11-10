import { useEffect, useRef, useState } from "react";
import { Button, CardActions, DubPackIdentity, SearchField, type PackQueueControls, type ArtistOption, type Buddy, type Dub, type MediaKind } from "@craft/ui";
import { PackEditor } from "./PackEditor";
import { PackView, type PackPlayback } from "./PackView";
import { canAddDubToPack, packRequest, type Pack } from "../services/packs";
import "./Packs.css";

interface Props extends PackQueueControls {
  mediaKind?: MediaKind;
  username: string;
  approved: boolean;
  dubs: Dub[];
  artists: ArtistOption[];
  buddies: Buddy[];
  playback: PackPlayback;
  onPlay: (dub: Dub) => void;
  onPlayAll: (dubs: Dub[], packId?: string) => void;
  onSeek: (progress: number, dub: Dub) => void;
  onVolume: (volume: number) => void;
  onDownloadDub: (dub: Dub) => Promise<void>;
  onCommunityChange: () => Promise<void>;
  onOpenPack?: (pack: Pack) => void;
  create?: boolean;
  pendingDub?: Dub | null;
  editPack?: Pack | null;
  onOpened?: () => void;
}

export function PackWorkspace(props: Props) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selected, setSelected] = useState<Pack | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const creating = useRef(false);
  const [attempt, setAttempt] = useState(0);
  async function refresh() {
    const result = await packRequest<{ packs: Pack[] }>("/api/packs");
    setPacks(result.packs);
    setSelected((current) => current ? result.packs.find((pack) => pack.id === current.id) ?? null : null);
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void packRequest<{ packs: Pack[] }>("/api/packs", "GET", undefined, controller.signal).then((result) => {
      if (!controller.signal.aborted) setPacks((current) => [...current.filter((pack) => !result.packs.some((item) => item.id === pack.id)), ...result.packs]);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Packs could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  async function create() {
    if (creating.current) return;
    creating.current = true; setPending(true); setError("");
    try {
      let { pack } = await packRequest<{ pack: Pack }>("/api/packs", "POST", { title: "Untitled pack", kind: props.mediaKind ?? "dub", distribution: props.pendingDub?.distribution ?? "worldwide", aListPublic: props.pendingDub?.aListPublic ?? false });
      if (props.pendingDub) {
        ({ pack } = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}`, "PATCH", { dubIds: [props.pendingDub.id] }));
      }
      setPacks((current) => [pack, ...current]); setSelected(pack); setEditing(true); props.onOpened?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The pack could not be created."); }
    finally { creating.current = false; setPending(false); }
  }
  useEffect(() => {
    if (props.create) void create();
  }, [props.create]);
  useEffect(() => {
    if (!props.editPack || props.editPack.ownerUsername !== props.username) return;
    setSelected(props.editPack);
    setEditing(true);
    props.onOpened?.();
  }, [props.editPack, props.username]);
  const scopedPacks = packs.filter((pack) => !props.mediaKind || (pack.kind === props.mediaKind && pack.ownerUsername === props.username));
  const filtered = scopedPacks.filter((pack) => (kind === "all" || pack.kind === kind)
    && `${pack.title} ${pack.ownerDisplayName}`.toLowerCase().includes(query.trim().toLowerCase()));
  const hasFilters = Boolean(query || kind !== "all");
  function clearFilters() { setQuery(""); setKind("all"); }
  if (selected) return <>
    {error && <p role="alert">{error}</p>}
    {!editing && <Button variant="tertiary" onClick={() => setSelected(null)}>All packs</Button>}
    {editing ? <PackEditor key={selected.id} pack={selected} dubs={props.dubs.filter((dub) => dub.uploader === props.username)} artists={props.artists} approved={props.approved}
      onCommunityChange={props.onCommunityChange} onClose={() => {
        setEditing(false);
        void refresh().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "The pack could not be refreshed."));
      }}
      onSaved={(pack) => { setPacks((current) => [pack, ...current.filter((item) => item.id !== pack.id)]); setSelected(pack); setEditing(false); }} />
      : <PackView key={selected.id} pack={selected} authenticated owner={selected.ownerUsername === props.username} buddies={props.buddies}
        activePackId={props.activePackId} onActivateQueue={props.onActivateQueue} onPrevious={props.onPrevious} onNext={props.onNext}
        shuffle={props.shuffle} repeat={props.repeat} onShuffleChange={props.onShuffleChange} onRepeatChange={props.onRepeatChange}
        playback={props.playback} onPlay={props.onPlay} onPlayAll={props.onPlayAll} onSeek={props.onSeek} onVolume={props.onVolume}
        onDownloadDub={props.onDownloadDub} onEdit={() => setEditing(true)} onDelete={() => setSelected(null)}
        onRefresh={async () => { await refresh(); await props.onCommunityChange(); }} />}
  </>;
  const packTitle = props.mediaKind === "sample" ? "Your Sample Packs" : props.mediaKind === "dub" ? "Your Dub Packs" : "Packs";
  return <section className="pack-workspace" aria-label={packTitle}>
    <header className="pack-toolbar"><div><h1>{packTitle}</h1><p className="pack-muted">{props.mediaKind ? "Manage your published releases and private drafts." : "Your releases and packs shared with you."}</p></div>
      <Button disabled={pending} loading={pending} onClick={() => void create()}>Create pack</Button></header>
    {props.pendingDub && <p className="pack-notice">Choose a compatible pack for <strong>{props.pendingDub.title}</strong>, or create a new pack.</p>}
    <div className="pack-filters">
      <SearchField aria-label="Search packs" placeholder="Search packs or uploaders" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      {!props.mediaKind && <label className="pack-filter-kind"><span className="sr-only">Pack type filter</span><select value={kind} onChange={(event) => setKind(event.currentTarget.value)}><option value="all">All packs</option><option value="dub">Dub Packs</option><option value="sample">Sample Packs</option></select></label>}
      {hasFilters && <Button variant="tertiary" onClick={clearFilters}>Clear filters</Button>}
    </div>
    {loading && <p role="status">Loading packs...</p>}
    {error && <div role="alert"><p>{error}</p><Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>Retry</Button></div>}
    {!loading && !error && !filtered.length && <div className="pack-empty">
      <h2>{scopedPacks.length ? "No matching packs" : "Your next release starts here"}</h2>
      <p>{scopedPacks.length ? "Try another search or clear your filters." : `Create ${props.mediaKind === "sample" ? "a Sample Pack" : props.mediaKind === "dub" ? "a Dub Pack" : "a Dub Pack or Sample Pack"} from new files or your existing uploads. Drafts stay private until you publish.`}</p>
      {hasFilters && <Button variant="secondary" onClick={clearFilters}>Show all packs</Button>}
    </div>}
    {!loading && !error && filtered.length > 0 && <p className="pack-muted" role="status">{filtered.length} {filtered.length === 1 ? "pack" : "packs"}</p>}
    <ul className="pack-grid">{filtered.map((pack) => {
      const alreadyAdded = Boolean(props.pendingDub && pack.items.some(({ dub }) => dub.id === props.pendingDub?.id));
      const compatible = !props.pendingDub || canAddDubToPack(pack, props.pendingDub);
      return <li key={pack.id}><article className="pack-card">
        <DubPackIdentity pack={pack} compact />
        <CardActions title={pack.title} className="pack-toolbar"><Button onClick={() => {
          if (props.onOpenPack) props.onOpenPack(pack);
          else { setSelected(pack); setEditing(false); }
        }}>Open pack</Button>
          {pack.ownerUsername === props.username && <Button variant="secondary" disabled={pending}
            onClick={() => { setSelected(pack); setEditing(true); }}>Edit pack</Button>}
          {props.pendingDub && pack.ownerUsername === props.username && <Button variant="secondary" disabled={pending || alreadyAdded || !compatible} onClick={async () => {
            if (creating.current) return;
            creating.current = true; setPending(true); setError("");
            try {
              const dub = props.pendingDub;
              if (!dub) throw new Error("Choose a dub to add first.");
              const requiresConfirmation = pack.status === "published" && pack.distribution === "private" && Boolean(pack.grants?.length);
              if (requiresConfirmation && !window.confirm("Grant existing pack recipients access to this newly added dub?")) return;
              const { pack: updated } = await packRequest<{ pack: Pack }>(`/api/packs/${pack.id}`, "PATCH", {
                dubIds: [...new Set([...pack.items.map(({ dub }) => dub.id), dub.id])], confirmNewAccess: requiresConfirmation,
              });
              await props.onCommunityChange();
              setPacks((current) => current.map((item) => item.id === updated.id ? updated : item));
              setSelected(updated); props.onOpened?.();
            } catch (failure) { setError(failure instanceof Error ? failure.message : "The dub could not be added."); }
            finally { creating.current = false; setPending(false); }
          }}>{alreadyAdded ? "Already in pack" : "Add selected dub"}</Button>}</CardActions>
        {props.pendingDub && pack.ownerUsername === props.username && !compatible && <p className="pack-muted">This pack has a different audience.</p>}
      </article></li>;
    })}</ul>
  </section>;
}
