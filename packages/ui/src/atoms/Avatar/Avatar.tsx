import { useState, type HTMLAttributes } from "react";
import "./Avatar.css";

export type AvatarSize = "small" | "medium" | "large";
export type AvatarStatus = "active" | "inactive";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  initials?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  hideOnMobile?: boolean;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  className,
  initials,
  hideOnMobile = false,
  name,
  size = "medium",
  src,
  status,
  ...props
}: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const showFallback = !src || failedSource === src;
  const classes = [
    "avatar",
    `avatar--${size}`,
    status && `avatar--${status}`,
    hideOnMobile && "avatar--hide-on-mobile",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-label={name}
      className={classes}
      role="img"
      {...props}
    >
      {!showFallback ? (
        <img
          alt=""
          className="avatar__image"
          src={src}
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span aria-hidden="true">{initials || getInitials(name)}</span>
      )}
      {status && <span className="avatar__status" aria-hidden="true" />}
    </span>
  );
}
