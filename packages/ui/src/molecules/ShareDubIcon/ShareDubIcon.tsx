import type { ReactNode } from "react";
import { Upload } from "@craft/icons";
import "./ShareDubIcon.css";

export function ShareDubIcon({ desktopIcon }: { desktopIcon?: ReactNode }) {
  return (
    <>
      {desktopIcon && <span className="share-dub-icon__desktop">{desktopIcon}</span>}
      <span className={desktopIcon ? "share-dub-icon__mobile" : undefined}>
        <Upload />
      </span>
    </>
  );
}
