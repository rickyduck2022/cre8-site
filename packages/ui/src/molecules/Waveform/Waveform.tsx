import type { KeyboardEvent, MouseEvent } from "react";
import "../Molecules.css";

export interface WaveformProps {
  peaks?: number[];
  progress?: number;
  color?: "audio" | "primary";
  label?: string;
  className?: string;
  durationSeconds?: number;
  onSeek?: (progress: number) => void;
}

const defaultPeaks = Array.from({ length: 64 }, (_, index) => {
  const wave = Math.abs(
    Math.sin(index * 1.71) * 0.58 +
      Math.sin(index * 0.47) * 0.26 +
      Math.cos(index * 2.19) * 0.16,
  );
  return 0.14 + wave * 0.86;
});

export function Waveform({
  className,
  color = "audio",
  label = "Audio waveform",
  durationSeconds,
  onSeek,
  peaks = defaultPeaks,
  progress = 0.32,
}: WaveformProps) {
  const safeProgress = Math.max(0, Math.min(1, progress));

  function seekFromPointer(event: MouseEvent<SVGSVGElement>) {
    if (!onSeek) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    onSeek(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)));
  }

  function seekFromKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!onSeek) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    const offsets: Record<string, number> = {
      ArrowLeft: -step,
      ArrowRight: step,
      Home: -1,
      End: 1,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    onSeek(Math.max(0, Math.min(1, safeProgress + offset)));
  }

  return (
    <svg
      aria-label={label}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuenow={onSeek ? Math.round(safeProgress * 100) : undefined}
      aria-valuetext={
        onSeek && durationSeconds
          ? `${Math.round(safeProgress * durationSeconds)} seconds`
          : undefined
      }
      className={["waveform", `waveform--${color}`, className]
        .filter(Boolean)
        .join(" ")}
      onClick={seekFromPointer}
      onKeyDown={seekFromKeyboard}
      role={onSeek ? "slider" : "img"}
      tabIndex={onSeek ? 0 : undefined}
      viewBox={`0 0 ${peaks.length * 4} 32`}
      preserveAspectRatio="none"
    >
      {peaks.map((peak, index) => {
        const height = Math.max(2, Math.min(30, peak * 30));
        return (
          <rect
            key={index}
            x={index * 4 + 1}
            y={(32 - height) / 2}
            width="2"
            height={height}
            rx="1"
            className={
              index / peaks.length < safeProgress
                ? "waveform__played"
                : "waveform__unplayed"
            }
          />
        );
      })}
    </svg>
  );
}
