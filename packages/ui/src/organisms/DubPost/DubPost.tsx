import { AudioPlayer } from "../AudioPlayer/AudioPlayer";
import { PostActions } from "../../molecules/PostActions/PostActions";
import { PostAuthor } from "../../molecules/PostAuthor/PostAuthor";
import { TrackMetadata } from "../../molecules/TrackMetadata/TrackMetadata";
import "../Organisms.css";

export interface DubPostTrack {
  title: string;
  artist: string;
  artwork?: string;
  duration?: string;
  bpm?: string;
  keySignature?: string;
  fileSize?: string;
  peaks?: number[];
}

export interface DubPostProps {
  author: string;
  authorDetail?: string;
  authorSrc?: string;
  timestamp?: string;
  message?: string;
  track: DubPostTrack;
  likes?: number;
  comments?: number;
  downloads?: number;
  onLikeChange?: (liked: boolean) => void;
  onDownload?: () => void;
  playing?: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  onPlayChange?: (playing: boolean) => void;
  onSeek?: (timeSeconds: number) => void;
  className?: string;
}

export function DubPost({
  author,
  authorDetail = "Friend",
  authorSrc,
  className,
  comments = 0,
  downloads = 0,
  likes = 0,
  message,
  onDownload,
  onLikeChange,
  onPlayChange,
  playing,
  currentTimeSeconds,
  durationSeconds,
  onSeek,
  timestamp,
  track,
}: DubPostProps) {
  return (
    <article
      className={["organism-card", "dub-post", className]
        .filter(Boolean)
        .join(" ")}
    >
      <PostAuthor
        detail={authorDetail}
        name={author}
        src={authorSrc}
        timestamp={timestamp}
      />
      {message && <p className="dub-post__message">{message}</p>}
      <div className="dub-post__track">
        <AudioPlayer
          onPlayChange={onPlayChange}
          playing={playing}
          currentTimeSeconds={currentTimeSeconds}
          durationSeconds={durationSeconds}
          onSeek={onSeek}
          track={{
            artist: track.artist,
            artwork: track.artwork,
            duration: track.duration,
            peaks: track.peaks,
            title: track.title,
          }}
          variant="full"
        />
        <div className="dub-post__track-details">
          <TrackMetadata
            bpm={track.bpm}
            keySignature={track.keySignature}
            tags={["Roller"]}
          />
          {track.fileSize && (
            <span className="dub-post__file-info">{track.fileSize}</span>
          )}
        </div>
      </div>
      <div className="dub-post__actions">
        <PostActions
          comments={comments}
          downloads={downloads}
          likes={likes}
          onDownload={onDownload}
          onLikeChange={onLikeChange}
        />
      </div>
    </article>
  );
}
