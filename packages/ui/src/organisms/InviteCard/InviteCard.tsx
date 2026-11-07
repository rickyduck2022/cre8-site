import { UserPlus } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "../Organisms.css";

export interface InviteCardProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onInvite?: () => void;
  className?: string;
}

export function InviteCard({
  actionLabel = "Invite a friend",
  className,
  description = "Bring your people together and share new sounds.",
  onInvite,
  title = "Better with your people.",
}: InviteCardProps) {
  return (
    <section
      className={["organism-card", "invite-card", className]
        .filter(Boolean)
        .join(" ")}
    >
      <UserPlus className="invite-card__icon" aria-hidden="true" />
      <div>
        <div className="invite-card__title">{title}</div>
        <p className="invite-card__description">{description}</p>
      </div>
      <Button
        leadingIcon={<UserPlus aria-hidden="true" />}
        onClick={onInvite}
        size="small"
        variant="secondary"
      >
        {actionLabel}
      </Button>
    </section>
  );
}
