import { useState } from "react";
import { Bookmark, Download, Heart, MessageCircle } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface PostActionsProps {
  likes?: number;
  comments?: number;
  downloads?: number;
  liked?: boolean;
  saved?: boolean;
  onLikeChange?: (liked: boolean) => void;
  onSaveChange?: (saved: boolean) => void;
  onDownload?: () => void;
  className?: string;
}

export function PostActions({
  className,
  comments = 0,
  downloads = 0,
  liked: likedProp = false,
  likes = 0,
  onDownload,
  onLikeChange,
  onSaveChange,
  saved: savedProp = false,
}: PostActionsProps) {
  const [liked, setLiked] = useState(likedProp);
  const [saved, setSaved] = useState(savedProp);

  function toggleLike() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    onLikeChange?.(nextLiked);
  }

  function toggleSaved() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    onSaveChange?.(nextSaved);
  }

  return (
    <div className={["post-actions", className].filter(Boolean).join(" ")}>
      <Button
        aria-label={`${liked ? "Unlike" : "Like"} (${likes + Number(liked)})`}
        aria-pressed={liked}
        className={`molecule-icon-button${liked ? " is-active" : ""}`}
        leadingIcon={<Heart aria-hidden="true" />}
        onClick={toggleLike}
        size="small"
        type="button"
      >
        <span>{likes + Number(liked)}</span>
      </Button>
      <Button
        aria-label={`Comments (${comments})`}
        className="molecule-icon-button"
        leadingIcon={<MessageCircle aria-hidden="true" />}
        size="small"
      >
        <span>{comments}</span>
      </Button>
      <Button
        aria-label={saved ? "Remove bookmark" : "Bookmark"}
        aria-pressed={saved}
        className={`molecule-icon-button${saved ? " is-active" : ""}`}
        leadingIcon={<Bookmark aria-hidden="true" />}
        onClick={toggleSaved}
        size="small"
        type="button"
      >
        <span className="sr-only">{saved ? "Remove bookmark" : "Bookmark"}</span>
      </Button>
      <Button
        leadingIcon={<Download />}
        onClick={onDownload}
        size="small"
        variant="secondary"
      >
        {downloads ? `${downloads} Downloads` : "Download"}
      </Button>
    </div>
  );
}
