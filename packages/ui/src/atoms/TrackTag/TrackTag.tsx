import type { HTMLAttributes, ReactNode } from "react";
import "./TrackTag.css";

export type TrackTagVariant = "neutral" | "accent" | "audio" | "dark";

export interface TrackTagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  icon?: ReactNode;
  variant?: TrackTagVariant;
}

export function TrackTag({
  children,
  className,
  icon,
  variant = "neutral",
  ...props
}: TrackTagProps) {
  const classes = ["track-tag", `track-tag--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {icon && (
        <span className="track-tag__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
