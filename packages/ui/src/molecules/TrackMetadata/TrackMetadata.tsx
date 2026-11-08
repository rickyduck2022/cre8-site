import type { ReactNode } from "react";
import { TrackTag, type TrackTagVariant } from "../../atoms/TrackTag/TrackTag";
import "../Molecules.css";

export interface TrackMetadataProps {
  tags?: string[];
  duration?: string;
  bpm?: string;
  keySignature?: string;
  className?: string;
  children?: ReactNode;
  layout?: "wrap" | "inline";
  tagVariant?: TrackTagVariant;
}

export function TrackMetadata({
  bpm,
  className,
  children,
  duration,
  keySignature,
  layout = "wrap",
  tagVariant = "neutral",
  tags = [],
}: TrackMetadataProps) {
  return (
    <div
      aria-label={layout === "inline" ? "Track details" : undefined}
      className={["track-metadata", layout === "inline" && "track-metadata--inline", className].filter(Boolean).join(" ")}
      role={layout === "inline" ? "region" : undefined}
      tabIndex={layout === "inline" ? 0 : undefined}
    >
      {tags.map((tag) => (
        <TrackTag key={tag} variant={tagVariant}>{tag}</TrackTag>
      ))}
      {duration && <TrackTag variant={tagVariant}>{duration}</TrackTag>}
      {bpm && <TrackTag variant={tagVariant}>{bpm} BPM</TrackTag>}
      {keySignature && <TrackTag variant={tagVariant}>{keySignature}</TrackTag>}
      {children}
    </div>
  );
}
