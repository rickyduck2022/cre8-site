import { useState, type FormEvent } from "react";
import { Heart, Upload } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface ShareEntryProps {
  name: string;
  variant?: "default" | "mobile";
  onSubmit?: (message: string) => void;
  onUpload?: () => void;
  className?: string;
}

export function ShareEntry({
  className,
  name,
  onSubmit,
  onUpload,
  variant = "default",
}: ShareEntryProps) {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content) return;
    onSubmit?.(content);
    setMessage("");
  }

  return (
    <form
      className={[
        "share-entry",
        variant !== "default" && `share-entry--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onSubmit={submit}
    >
      <Avatar name={name} size="small" />
      <label className="share-entry__input">
        <span className="sr-only">Share something with your friends</span>
        <textarea
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Say something the circle needs to hear?"
          rows={1}
          value={message}
        />
        <span className="share-entry__hint">
          Share a dub, tag your friends, keep it in the family.
        </span>
      </label>
      <div className="share-entry__actions">
        <Button
          leadingIcon={<Upload />}
          onClick={onUpload}
          size="small"
          type="button"
          variant="secondary"
        >
          Upload dub
        </Button>
        <Button
          disabled={!message.trim()}
          leadingIcon={<Heart />}
          size="small"
          type="submit"
        >
          Share a dub
        </Button>
      </div>
    </form>
  );
}
