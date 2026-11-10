import type { CSSProperties, ReactNode } from "react";
import "./SnapPreview.css";

export interface SnapPreviewProps {
  label: string;
  style: CSSProperties;
  active?: boolean;
  icon?: ReactNode;
}

export function SnapPreview({ label, style, active = false, icon }: SnapPreviewProps) {
  return <div aria-hidden="true" aria-label={label || undefined} className={active ? "snap-preview snap-preview--active" : "snap-preview"} style={style}>{icon ?? label}</div>;
}
