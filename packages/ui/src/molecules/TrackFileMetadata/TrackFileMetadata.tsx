import { TrackTag } from "../../atoms/TrackTag/TrackTag";
import "./TrackFileMetadata.css";

export interface TrackFileMetadataProps {
  fileType?: string;
  audioFileName?: string;
  bitrateKbps?: number;
  className?: string;
}

export function TrackFileMetadata({
  audioFileName,
  bitrateKbps,
  className,
  fileType,
}: TrackFileMetadataProps) {
  const extension = audioFileName?.match(/\.([a-z0-9]+)$/i)?.[1];
  const format = fileType ?? extension?.toUpperCase();
  if (!format && !bitrateKbps) return null;

  return (
    <span className={["track-file-metadata", className].filter(Boolean).join(" ")} aria-label="Audio file details">
      {format && <TrackTag variant="audio">{format}</TrackTag>}
      {bitrateKbps && bitrateKbps > 0 && (
        <TrackTag title="Average bitrate calculated from the uploaded file size and audio duration">
          {bitrateKbps.toLocaleString(undefined, { maximumFractionDigits: 1 })} kbps avg
        </TrackTag>
      )}
    </span>
  );
}
