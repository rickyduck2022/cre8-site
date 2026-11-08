import type { ReactNode } from "react";
import { Avatar, type AvatarSize } from "../../atoms/Avatar/Avatar";
import { AListBadge } from "../../atoms/AListBadge/AListBadge";
import "./ArtistCard.css";

export interface ArtistCardProps {
  name: string;
  username: string;
  avatarUrl?: string;
  aListApproved?: boolean;
  detail?: ReactNode;
  action?: ReactNode;
  onOpenProfile?: (username: string) => void;
  size?: AvatarSize;
  className?: string;
}

export function ArtistCard({ name, username, avatarUrl, aListApproved, detail, action, onOpenProfile, size = "small", className }: ArtistCardProps) {
  const identity = <><strong>{name}{aListApproved && <AListBadge />}</strong><span>@{username}{detail && <> · {detail}</>}</span></>;
  const avatar = <Avatar name={name} size={size} src={avatarUrl} />;
  return (
    <div className={["artist-card", className].filter(Boolean).join(" ")}>
      {onOpenProfile ? (
        <button aria-label={`View ${name}'s profile`} className="artist-card__avatar" onClick={() => onOpenProfile(username)} type="button">{avatar}</button>
      ) : avatar}
      {onOpenProfile ? (
        <button className="artist-card__identity" onClick={() => onOpenProfile(username)} type="button">{identity}</button>
      ) : <div className="artist-card__identity">{identity}</div>}
      {action && <div className="artist-card__action">{action}</div>}
    </div>
  );
}
