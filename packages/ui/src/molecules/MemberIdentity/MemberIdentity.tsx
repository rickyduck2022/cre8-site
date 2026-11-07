import { Avatar } from "../../atoms/Avatar/Avatar";
import "../Molecules.css";

export interface MemberIdentityProps {
  name: string;
  detail?: string;
  src?: string;
  status?: "active" | "inactive";
  size?: "small" | "medium" | "large";
  className?: string;
}

export function MemberIdentity({
  className,
  detail,
  name,
  size = "small",
  src,
  status,
}: MemberIdentityProps) {
  return (
    <div className={["member-identity", className].filter(Boolean).join(" ")}>
      <Avatar
        className="member-identity__avatar"
        name={name}
        size={size}
        src={src}
        status={status}
      />
      <span className="member-identity__copy">
        <span className="member-identity__name">{name}</span>
        {detail && <span className="member-identity__detail">{detail}</span>}
      </span>
    </div>
  );
}
