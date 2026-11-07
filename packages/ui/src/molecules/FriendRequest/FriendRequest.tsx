import { Check } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { MemberIdentity } from "../MemberIdentity/MemberIdentity";
import "../Molecules.css";

export interface FriendRequestProps {
  name: string;
  detail?: string;
  src?: string;
  onAccept?: () => void;
  onIgnore?: () => void;
  className?: string;
}

export function FriendRequest({
  className,
  detail = "Friend request",
  name,
  onAccept,
  onIgnore,
  src,
}: FriendRequestProps) {
  return (
    <div className={["friend-request", className].filter(Boolean).join(" ")}>
      <MemberIdentity detail={detail} name={name} src={src} />
      <div className="friend-request__actions">
        <Button leadingIcon={<Check />} onClick={onAccept} size="small">
          Accept
        </Button>
        <Button onClick={onIgnore} size="small" variant="tertiary">
          Ignore
        </Button>
      </div>
    </div>
  );
}
