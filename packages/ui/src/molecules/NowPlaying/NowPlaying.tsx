import type { ReactNode } from "react";
import { AudioLines } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import "../Molecules.css";

export interface NowPlayingProps {
  title: string;
  artist: string;
  artwork?: string;
  artworkContent?: ReactNode;
  onArtistClick?: () => void;
  showArtwork?: boolean;
  className?: string;
}

export function NowPlaying({
  artist,
  artworkContent,
  artwork,
  className,
  onArtistClick,
  showArtwork = true,
  title,
}: NowPlayingProps) {
  return (
    <div
      className={[
        "now-playing",
        !showArtwork && "now-playing--text-only",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showArtwork &&
        (artworkContent ? (
          <span className="now-playing__artwork now-playing__artwork--custom">
            {artworkContent}
          </span>
        ) : artwork ? (
          <img className="now-playing__artwork" src={artwork} alt="" />
        ) : (
          <span className="now-playing__artwork now-playing__artwork--fallback">
            <AudioLines aria-hidden="true" />
          </span>
        ))}
      <span className="now-playing__copy">
        <span className="now-playing__title">{title}</span>
        {onArtistClick ? (
          <button
            className="now-playing__artist now-playing__artist-button"
            onClick={onArtistClick}
            type="button"
          >
            {artist}
          </button>
        ) : (
          <span className="now-playing__artist">{artist}</span>
        )}
      </span>
      <Badge dot variant="audio" aria-label="Now playing" />
    </div>
  );
}
