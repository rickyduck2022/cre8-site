import type { ReactNode } from "react";
import { MoreActions } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { MemberIdentity, type MemberIdentityProps } from "../MemberIdentity/MemberIdentity";
import "../Molecules.css";

export interface PostAuthorProps extends MemberIdentityProps {
  timestamp?: string;
  action?: ReactNode;
}

export function PostAuthor({
  action,
  className,
  detail,
  name,
  size = "small",
  src,
  status,
  timestamp,
}: PostAuthorProps) {
  return (
    <div className={["post-author", className].filter(Boolean).join(" ")}>
      <MemberIdentity
        detail={[detail, timestamp].filter(Boolean).join(" · ")}
        name={name}
        size={size}
        src={src}
        status={status}
      />
      {action ?? (
        <Button
          aria-label={`More options for ${name}`}
          className="molecule-icon-button"
          leadingIcon={<MoreActions aria-hidden="true" />}
          size="small"
          type="button"
        >
          <span className="sr-only">More options</span>
        </Button>
      )}
    </div>
  );
}
