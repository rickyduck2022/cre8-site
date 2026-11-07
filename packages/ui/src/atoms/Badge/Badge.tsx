import type { HTMLAttributes } from "react";
import "./Badge.css";

export type BadgeVariant = "default" | "accent" | "audio";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  children,
  className,
  dot = false,
  variant = "accent",
  ...props
}: BadgeProps) {
  const classes = ["badge", `badge--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
