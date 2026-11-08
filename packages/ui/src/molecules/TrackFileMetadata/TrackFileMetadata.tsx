import { TrackTag, type TrackTagVariant } from "../../atoms/TrackTag/TrackTag";
import "./TrackFileMetadata.css";

export interface TrackFileMetadataProps {
  fileType?: string;
  audioFileName?: string;
  bitrateKbps?: number;
  className?: string;
  layout?: "wrap" | "inline";
  tagVariant?: TrackTagVariant;
}

export function TrackFileMetadata({
  audioFileName,
  bitrateKbps,
  className,
  fileType,
  layout = "wrap",
  tagVariant,
}: TrackFileMetadataProps) {
  const extension = audioFileName?.match(/\.([a-z0-9]+)$/i)?.[1];
  const format = fileType ?? extension?.toUpperCase();
  const hasBitrate = bitrateKbps !== undefined && Number.isFinite(bitrateKbps) && bitrateKbps >= 0;
  if (!format && !hasBitrate) return null;

  return (
    <span className={["track-file-metadata", layout === "inline" && "track-file-metadata--inline", className].filter(Boolean).join(" ")} aria-label="Audio file details">
      {format && <TrackTag variant={tagVariant ?? "audio"}>{format}</TrackTag>}
      {hasBitrate && (
        <TrackTag variant={tagVariant} title="Average bitrate calculated from the uploaded file size and audio duration">
          {Math.round(bitrateKbps).toLocaleString()} kbps avg
        </TrackTag>
      )}
    </span>
  );
}
