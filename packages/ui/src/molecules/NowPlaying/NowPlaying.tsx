import type { ReactNode } from "react";
import { AudioLines } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import "../Molecules.css";

export interface NowPlayingProps {
  title: string;
  artist: string;
  artistAListApproved?: boolean;
  artwork?: string;
  artworkContent?: ReactNode;
  onArtistClick?: () => void;
  isPlaying?: boolean;
  showArtwork?: boolean;
  className?: string;
}

export function NowPlaying({
  artist,
  artistAListApproved,
  artworkContent,
  artwork,
  className,
  isPlaying = true,
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
            {artist}{artistAListApproved && <AListBadge />}
          </button>
        ) : (
          <span className="now-playing__artist">{artist}{artistAListApproved && <AListBadge />}</span>
        )}
      </span>
      {isPlaying && <Badge dot variant="audio" role="status" aria-label="Now playing" />}
    </div>
  );
}
