import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button, FloatingWindow, WindowLayer, packTypeLabel, type ArtistOption, type Dub, type DubPack, type WindowWorkspace, type ActiveWindowGroup, type WindowTracklistControl } from "@craft/ui";
import { PackView } from "./PackView";
import { PackEditor } from "./PackEditor";
import { packRequest } from "../services/packs";
import type { PlaybackState } from "../hooks/useAudioPlayback";
import "./Packs.css";

export interface PackWindowState {
  pack: DubPack;
  openRequest: number;
  groupWith?: { id: string; request: number };
}

interface Props extends Omit<ComponentProps<typeof PackView>, "pack" | "owner" | "onEdit" | "onDelete" | "onRefresh"> {
  windows: PackWindowState[];
  stack: string[];
  username: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onEdit: (pack: DubPack) => void;
  onCommunityChange: () => Promise<void>;
  children?: ReactNode;
  contexts?: Record<string, PlaybackState>;
  onActivateWindowQueue?: (tracks: Dub[], packId: string) => boolean;
  onWindowSettingsChange?: (packId: string, settings: Partial<Pick<PlaybackState, "shuffle" | "repeat">>, tracks?: Dub[]) => void;
  initialWorkspace?: WindowWorkspace | null;
  onWorkspaceChange?: (workspace: WindowWorkspace) => void;
  playerTrackId?: string | null;
  audibleContextId?: string | null;
  onActiveGroupChange?: (group: ActiveWindowGroup | null) => void;
  tracklistControl?: WindowTracklistControl;
  withinLayer?: boolean;
  editor?: { dubs: Dub[]; artists: ArtistOption[]; approved: boolean };
}

type PackWindowProps = Omit<Props, "windows" | "children" | "initialWorkspace" | "onWorkspaceChange" | "playerTrackId" | "onActiveGroupChange" | "tracklistControl" | "withinLayer"> & PackWindowState;

export function PackWindows({ windows, children, initialWorkspace, onWorkspaceChange, playerTrackId, onActiveGroupChange, tracklistControl, withinLayer, ...props }: Props) {
  // Raising a window must not move its DOM node during a pointer gesture.
  const ranked = [...windows].sort((a, b) => a.pack.id.localeCompare(b.pack.id));
  const content = <>{ranked.map((entry) => <PackWindow key={entry.pack.id} {...props} {...entry} />)}{children}</>;
  return withinLayer ? content : <WindowLayer className="vault-theme" initialWorkspace={initialWorkspace} onWorkspaceChange={onWorkspaceChange}
    playerTrackId={playerTrackId} onActiveGroupChange={onActiveGroupChange} tracklistControl={tracklistControl}>{content}</WindowLayer>;
}

function PackWindow({ pack: originalPack, openRequest, groupWith, stack, username, onActivate, onClose, onEdit, onCommunityChange,
  contexts = {}, onActivateWindowQueue, onWindowSettingsChange, audibleContextId, editor, ...playback }: PackWindowProps) {
  const [pack, setPack] = useState(originalPack);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { setPack(originalPack); }, [originalPack]);
  useEffect(() => () => request.current?.abort(), []);
  async function edit() {
    if (!editor) { onClose(pack.id); onEdit(pack); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setEditing(true); setLoading(true); setError("");
    try {
      const { pack: latest } = await packRequest<{ pack: DubPack }>(`/api/packs/${encodeURIComponent(pack.id)}`, "GET", undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (latest.ownerUsername !== username) throw new Error("Only the pack owner can edit this release.");
      setPack(latest);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The pack could not be loaded for editing.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function close() {
    if (busy || loading) return;
    if (dirty && !window.confirm("Close this pack? Unsaved edits and files not yet uploaded will be lost. Saved files remain in the pack.")) return;
    onClose(pack.id);
  }
  const activeId = stack[stack.length - 1];
  const active = (audibleContextId === undefined || audibleContextId === pack.id) && playback.activePackId === pack.id;
  const local = active ? playback.playback : contexts[pack.id];
  const track = pack.items.find(({ dub }) => dub.id === local?.nowPlayingId)?.dub;
  return <FloatingWindow windowId={`pack:${pack.id}`} groupWith={groupWith} title={`${packTypeLabel(pack.kind)}: ${pack.title}`}
      autoGroup kind={pack.kind}
      playback={(pack.status === "published" || pack.ownerUsername === username) && pack.items.length ? {
        isPlaying: active && playback.playback.isPlaying,
        trackTitle: track?.title,
        onToggle: () => {
          if (onActivateWindowQueue && !onActivateWindowQueue(pack.items.map(({ dub }) => dub), pack.id)) return;
          if (active && track) playback.onPlay(track);
          else {
            playback.onPlay(track ?? pack.items[0].dub);
          }
        },
      } : undefined}
      active={pack.id === activeId} order={Math.max(0, stack.indexOf(pack.id))} openRequest={openRequest}
      onActivate={() => onActivate(pack.id)} onClose={close} closeDisabled={busy || loading}
      className={`pack-window media-kind--${pack.kind}${pack.distribution === "alist" ? " pack-view--alist" : ""}`}>
      {editing && editor ? loading ? <section aria-label="Loading pack editor"><p role="status">Loading the latest pack details...</p>
          <Button variant="tertiary" onClick={() => { request.current?.abort(); setLoading(false); setEditing(false); }}>Cancel</Button></section>
        : error ? <section aria-label="Pack editor unavailable"><p role="alert">{error}</p>
          <Button onClick={() => void edit()}>Retry loading pack</Button>
          <Button variant="tertiary" onClick={() => setEditing(false)}>Back to pack</Button></section>
        : <PackEditor pack={pack} dubs={editor.dubs.filter((dub) => dub.uploader === username)} artists={editor.artists} approved={editor.approved}
          onBusyChange={setBusy} onDirtyChange={setDirty} onCommunityChange={onCommunityChange}
          onClose={() => setEditing(false)} onSaved={(updated) => { setPack(updated); setEditing(false); }} />
        : <PackView {...playback} pack={pack} owner={pack.ownerUsername === username} showPlayer
        activePackId={pack.id}
        playback={{ ...playback.playback, nowPlayingId: track?.id ?? null,
          isPlaying: active && playback.playback.isPlaying,
          currentTime: local?.currentTime ?? 0, duration: local?.duration ?? 0,
          playbackError: local?.playbackError ?? null }}
        shuffle={active ? playback.shuffle : contexts[pack.id]?.shuffle ?? false}
        repeat={active ? playback.repeat : contexts[pack.id]?.repeat ?? false}
        onShuffleChange={onWindowSettingsChange ? (shuffle) => onWindowSettingsChange(pack.id, { shuffle }, pack.items.map(({ dub }) => dub)) : playback.onShuffleChange}
        onRepeatChange={onWindowSettingsChange ? (repeat) => onWindowSettingsChange(pack.id, { repeat }, pack.items.map(({ dub }) => dub)) : playback.onRepeatChange}
        onActivateQueue={(tracks) => onActivateWindowQueue
          ? onActivateWindowQueue(tracks, pack.id) : playback.onActivateQueue?.(tracks, pack.id)}
        onEdit={() => void edit()} onDelete={() => onClose(pack.id)}
        onRefresh={onCommunityChange} />}
    </FloatingWindow>;
}
