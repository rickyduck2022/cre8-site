import { UserPlus } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { MemberIdentity } from "../MemberIdentity/MemberIdentity";
import "../Molecules.css";

export interface SuggestedFriendProps {
  name: string;
  detail?: string;
  src?: string;
  onAdd?: () => void;
  className?: string;
}

export function SuggestedFriend({
  className,
  detail = "People you may know",
  name,
  onAdd,
  src,
}: SuggestedFriendProps) {
  return (
    <div className={["suggested-friend", className].filter(Boolean).join(" ")}>
      <MemberIdentity detail={detail} name={name} src={src} />
      <Button
        aria-label={`Add ${name}`}
        leadingIcon={<UserPlus />}
        onClick={onAdd}
        size="small"
        variant="secondary"
      >
        Add
      </Button>
    </div>
  );
}
