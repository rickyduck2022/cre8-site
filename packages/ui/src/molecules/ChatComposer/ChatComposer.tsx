import { useId, type FormEvent } from "react";
import { Send } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";
import "./ChatComposer.css";

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
  const messageId = useId();
  return (
    <form className="chat-compose" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={messageId}>
        Message {recipientName}
      </label>
      <input
        id={messageId}
        maxLength={2000}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Write a message..."
        value={value}
      />
      <Button
        aria-label="Send message"
        className="chat-compose__send"
        disabled={disabled || !value.trim()}
        hideLabelOnMobile
        leadingIcon={<Send />}
        size="small"
        type="submit"
      >
        Send
      </Button>
    </form>
  );
}
