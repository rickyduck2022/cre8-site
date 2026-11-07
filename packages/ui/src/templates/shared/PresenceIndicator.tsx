import type { Presence } from "../communityTypes";

export function PresenceIndicator({ presence }: { presence: Presence }) {
  return (
    <span
      aria-label={presence}
      className={`presence-dot presence-dot--${presence}`}
      title={presence}
    />
  );
}
