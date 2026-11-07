import { UserPlus } from "@craft/icons";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Badge } from "../../atoms/Badge/Badge";
import "../Molecules.css";

export interface CircleShortcutProps {
  name: string;
  detail?: string;
  count?: number;
  members?: string[];
  className?: string;
}

export function CircleShortcut({
  className,
  count = 2,
  detail = "People you've shared tracks with",
  members = [],
  name,
}: CircleShortcutProps) {
  return (
    <div className={["circle-shortcut", className].filter(Boolean).join(" ")}>
      <span className="circle-shortcut__icon" aria-hidden="true">
        <UserPlus />
      </span>
      <span className="circle-shortcut__copy">
        <span className="circle-shortcut__name">{name}</span>
        <span className="circle-shortcut__detail">{detail}</span>
      </span>
      <span className="circle-shortcut__members" aria-label={`${count} members`}>
        {members.slice(0, 3).map((member) => (
          <Avatar key={member} name={member} size="small" />
        ))}
        <Badge>{count}</Badge>
      </span>
    </div>
  );
}
