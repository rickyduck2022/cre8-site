import { useState } from "react";
import { AudioLines, DownloadSolid as Download, PauseSolid as Pause } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { MemberIdentity } from "../MemberIdentity/MemberIdentity";
import { TrackMetadata } from "../TrackMetadata/TrackMetadata";
import { Waveform } from "../Waveform/Waveform";
import type { NowPlayingProps } from "../NowPlaying/NowPlaying";
import "../Molecules.css";

export interface AudioPreviewTrack extends NowPlayingProps {
  duration?: string;
  peaks?: number[];
}

export interface AudioPreviewProps {
  tracks: AudioPreviewTrack[];
  className?: string;
  onPlay?: (track: AudioPreviewTrack) => void;
  onDownload?: (track: AudioPreviewTrack) => void;
}

export function AudioPreview({
  className,
  onDownload,
  onPlay,
  tracks,
}: AudioPreviewProps) {
  const [activeTrack, setActiveTrack] = useState<string>();

  return (
    <div className={["audio-preview", className].filter(Boolean).join(" ")}>
      {tracks.map((track) => {
        const playing = activeTrack === track.title;
        return (
          <article className="audio-preview__track" key={track.title}>
            <Button
              aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}
              aria-pressed={playing}
              className="audio-preview__play"
              leadingIcon={
                track.artwork ? (
                  <img src={track.artwork} alt="" />
                ) : (
                  <AudioLines aria-hidden="true" />
                )
              }
              onClick={() => {
                setActiveTrack(playing ? undefined : track.title);
                onPlay?.(track);
              }}
              size="small"
              variant="secondary"
              type="button"
            >
              <span className="sr-only">
                {playing ? "Pause" : "Play"} {track.title}
              </span>
              {playing && (
                <Pause
                  className="audio-preview__pause"
                  aria-hidden="true"
                />
              )}
            </Button>
            <div className="audio-preview__body">
              <div className="audio-preview__heading">
                <MemberIdentity
                  className="audio-preview__identity"
                  detail={track.artist}
                  name={track.title}
                />
                <span className="audio-preview__duration">{track.duration}</span>
              </div>
              <TrackMetadata tags={["New", "Dub"]} />
              <Waveform
                className="audio-preview__waveform"
                label={`${track.title} waveform`}
                peaks={track.peaks}
                progress={playing ? 0.48 : 0.12}
                variant="smooth"
              />
            </div>
            <Button
              aria-label={`Download ${track.title}`}
              leadingIcon={<Download />}
              onClick={() => onDownload?.(track)}
              size="small"
              variant="secondary"
            >
              Download
            </Button>
          </article>
        );
      })}
    </div>
  );
}
