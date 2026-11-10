import { Pause, Play } from "@craft/icons";
import { Button, type ButtonProps } from "../../atoms/Button/Button";
import type { MediaKind } from "../../types/domain";
import "../../foundations/MediaPalette.css";

export interface PackPlaybackButtonProps extends Pick<ButtonProps, "disabled" | "onClick" | "size"> {
  kind: MediaKind;
  playing: boolean;
  preview?: boolean;
}

export function PackPlaybackButton({ kind, playing, preview = false, ...props }: PackPlaybackButtonProps) {
  return <Button {...props} className={`media-kind--${kind}`} variant="audio"
    leadingIcon={playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}>
    {playing ? "Pause pack" : preview ? "Preview all" : "Play all"}
  </Button>;
}
