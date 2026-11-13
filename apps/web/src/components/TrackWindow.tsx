import { AudioPlayer, Button, FloatingWindow, TrackArtwork, type Dub } from "@craft/ui";
import type { PlaybackState } from "../hooks/useAudioPlayback";

export interface TrackWindowState {
  dubId: string;
  openRequest: number;
  groupWith?: { id: string; request: number };
}

export function TrackWindow({ dub, entry, stack, state, onActivate, onClose, onActivateQueue, onPlay, onSeek,
  onVolume, onSettings, onDownload }: {
  dub: Dub; entry: TrackWindowState; stack: string[];
  state: PlaybackState & { packContexts?: Record<string, PlaybackState>; audibleContextId?: string | null };
  onActivate: (id: string) => void; onClose: () => void;
  onActivateQueue: (tracks: Dub[], contextId: string) => boolean;
  onPlay: (dub: Dub) => void; onSeek: (progress: number, dub: Dub) => void;
  onVolume: (volume: number) => void;
  onSettings: (contextId: string, settings: Partial<Pick<PlaybackState, "shuffle" | "repeat">>, tracks?: Dub[]) => void;
  onDownload: (dub: Dub) => void;
}) {
  const id = `track:${dub.id}`;
  const active = state.queuePackId === id && (state.audibleContextId === undefined || state.audibleContextId === id);
  const local = active ? state : state.packContexts?.[id];
  const playing = active && state.isPlaying;
  const play = () => { if (onActivateQueue([dub], id)) onPlay(dub); };
  return <FloatingWindow windowId={id} title={`${dub.mediaKind === "vocal" ? "Vocal" : dub.mediaKind === "sample" ? "Sample" : "Track"}: ${dub.title}`}
    kind={dub.mediaKind ?? "dub"} groupWith={entry.groupWith} openRequest={entry.openRequest}
    active={stack.at(-1) === id} order={Math.max(0, stack.indexOf(id))}
    onActivate={() => onActivate(id)} onClose={onClose} playback={{ isPlaying: playing, onToggle: play, trackTitle: dub.title }}>
    <AudioPlayer variant="window" colorVariant="controller" mediaKind={dub.mediaKind} distribution={dub.distribution}
      track={{ title: dub.title, artist: dub.artist, duration: dub.duration, artworkContent: <TrackArtwork dub={dub} /> }}
      playing={playing} currentTimeSeconds={local?.currentTime ?? 0} durationSeconds={local?.duration}
      playbackError={local?.playbackError} onPlayChange={play} volume={state.volume} onVolumeChange={onVolume}
      onSeekProgress={(progress) => { if (onActivateQueue([dub], id)) onSeek(progress, dub); }}
      shuffle={local?.shuffle ?? false} repeat={local?.repeat ?? false}
      onShuffleChange={(shuffle) => onSettings(id, { shuffle }, [dub])} onRepeatChange={(repeat) => onSettings(id, { repeat }, [dub])}
      onPrevious={() => { if (onActivateQueue([dub], id)) onSeek(0, dub); }}
      onNext={() => { if (onActivateQueue([dub], id)) onSeek(0, dub); }} />
    <Button variant="secondary" onClick={() => onDownload(dub)}>Download {dub.mediaKind === "vocal" ? "vocal" : dub.mediaKind === "sample" ? "sample" : "track"}</Button>
  </FloatingWindow>;
}
