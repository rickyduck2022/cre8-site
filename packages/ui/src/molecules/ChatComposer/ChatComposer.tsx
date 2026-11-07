import type { FormEvent } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface ChatComposerProps {
  recipientName: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
}

export function ChatComposer({
  disabled = false,
  onChange,
  onSubmit,
  recipientName,
  value,
}: ChatComposerProps) {
  return (
    <form className="chat-compose" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="chat-message">
        Message {recipientName}
      </label>
      <input
        id="chat-message"
        maxLength={2000}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Write a message..."
        value={value}
      />
      <Button
        aria-label="Send message"
        disabled={disabled || !value.trim()}
        size="small"
        type="submit"
      >
        Send
      </Button>
    </form>
  );
}
