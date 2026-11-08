import { useEffect, useState } from "react";
import { AudioLines } from "@craft/icons";
import type { Dub } from "../communityTypes";

interface TrackArtworkProps {
  dub: Dub;
  large?: boolean;
}

export function TrackArtwork({ dub, large = false }: TrackArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasArtwork = Boolean(dub.artworkUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [dub.id, dub.artworkUrl]);

  return (
    <div
      aria-label={`${dub.title} artwork`}
      className={[
        "track-artwork",
        hasArtwork ? "track-artwork--image" : "track-artwork--whitelabel",
        large && "track-artwork--large",
      ].filter(Boolean).join(" ")}
      role="img"
    >
      {hasArtwork ? (
        <img
          alt=""
          className="track-artwork__image"
          onError={() => setImageFailed(true)}
          src={dub.artworkUrl}
        />
      ) : (
        <AudioLines aria-hidden="true" />
      )}
    </div>
  );
}
