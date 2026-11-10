import { useState } from "react";
import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface TransportControlsProps {
  variant?: "full" | "minimal";
  playing?: boolean;
  shuffle?: boolean;
  repeat?: boolean;
  onPlayChange?: (playing: boolean) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  className?: string;
}

export function TransportControls({
  variant = "full",
  className,
  onNext,
  onPlayChange,
  onPrevious,
  onRepeatChange,
  onShuffleChange,
  playing: playingProp,
  repeat: repeatProp,
  shuffle: shuffleProp,
}: TransportControlsProps) {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [internalShuffle, setInternalShuffle] = useState(false);
  const [internalRepeat, setInternalRepeat] = useState(false);
  const isControlled = playingProp !== undefined;
  const playing = isControlled ? playingProp : internalPlaying;
  const shuffle = shuffleProp ?? internalShuffle;
  const repeat = repeatProp ?? internalRepeat;

  function togglePlaying() {
    const next = !playing;
    if (!isControlled) setInternalPlaying(next);
    onPlayChange?.(next);
  }

  function toggleShuffle() {
    const next = !shuffle;
    if (shuffleProp === undefined) setInternalShuffle(next);
    onShuffleChange?.(next);
  }

  function toggleRepeat() {
    const next = !repeat;
    if (repeatProp === undefined) setInternalRepeat(next);
    onRepeatChange?.(next);
  }

  return (
    <div className={["transport-controls", className].filter(Boolean).join(" ")}>
      {variant === "full" && (
        <Button
          aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
          aria-pressed={shuffle}
          className={`transport-controls__button transport-controls__shuffle${shuffle ? " is-active" : ""}`}
          leadingIcon={<Shuffle aria-hidden="true" />}
          onClick={toggleShuffle}
          size="small"
          variant="tertiary"
          type="button"
        />
      )}
      {variant === "full" && (
        <Button
          aria-label="Previous track"
          className="transport-controls__button transport-controls__previous"
          leadingIcon={<SkipBack aria-hidden="true" />}
          onClick={onPrevious}
          size="small"
          variant="tertiary"
          type="button"
        />
      )}
      <Button
        aria-label={playing ? "Pause" : "Play"}
        className={`transport-controls__play${playing ? " is-playing" : ""}`}
        leadingIcon={
          playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />
        }
        onClick={togglePlaying}
        size="small"
        variant="secondary"
        type="button"
      />
      {variant === "full" && (
        <Button
          aria-label="Next track"
          className="transport-controls__button transport-controls__next"
          leadingIcon={<SkipForward aria-hidden="true" />}
          onClick={onNext}
          size="small"
          variant="tertiary"
          type="button"
        />
      )}
      {variant === "full" && (
        <Button
          aria-label={repeat ? "Disable repeat" : "Enable repeat"}
          aria-pressed={repeat}
          className={`transport-controls__button transport-controls__repeat${repeat ? " is-active" : ""}`}
          leadingIcon={<Repeat aria-hidden="true" />}
          onClick={toggleRepeat}
          size="small"
          variant="tertiary"
          type="button"
        />
      )}
    </div>
  );
}
