import { TrackTag } from "../../atoms/TrackTag/TrackTag";
import "../Molecules.css";

export interface TrackMetadataProps {
  tags?: string[];
  duration?: string;
  bpm?: string;
  keySignature?: string;
  className?: string;
}

export function TrackMetadata({
  bpm,
  className,
  duration,
  keySignature,
  tags = [],
}: TrackMetadataProps) {
  return (
    <div className={["track-metadata", className].filter(Boolean).join(" ")}>
      {tags.map((tag) => (
        <TrackTag key={tag}>{tag}</TrackTag>
      ))}
      {duration && <TrackTag>{duration}</TrackTag>}
      {bpm && <TrackTag>{bpm} BPM</TrackTag>}
      {keySignature && <TrackTag>{keySignature}</TrackTag>}
    </div>
  );
}
