import { useId, type KeyboardEvent, type MouseEvent } from "react";
import "../Molecules.css";

export interface WaveformProps {
  peaks?: number[];
  progress?: number;
  color?: "audio" | "primary";
  label?: string;
  className?: string;
  durationSeconds?: number;
  onSeek?: (progress: number) => void;
  variant?: "bars" | "smooth";
  insetShadow?: boolean;
}

const defaultPeaks = Array.from({ length: 64 }, (_, index) => {
  const wave = Math.abs(
    Math.sin(index * 1.71) * 0.58 +
      Math.sin(index * 0.47) * 0.26 +
      Math.cos(index * 2.19) * 0.16,
  );
  return 0.14 + wave * 0.86;
});

function smoothPath(peaks: number[]) {
  if (peaks.length === 0) return "";
  const points = peaks.map((peak, index) => ({
    x: peaks.length === 1 ? 128 : index * 256 / (peaks.length - 1),
    height: Math.max(2, Math.min(30, peak * 30)) / 2,
  }));
  const edge = (values: typeof points, direction: number) => values.map((point, index) => {
    const next = values[index + 1];
    return next
      ? `Q ${point.x} ${16 + direction * point.height} ${(point.x + next.x) / 2} ${16 + direction * (point.height + next.height) / 2}`
      : `L ${point.x} ${16 + direction * point.height}`;
  }).join(" ");
  return `M 0 16 ${edge(points, -1)} L 256 16 ${edge([...points].reverse(), 1)} Z`;
}

export function Waveform({
  className,
  color = "audio",
  label = "Audio waveform",
  durationSeconds,
  onSeek,
  peaks = defaultPeaks,
  progress = 0.32,
  variant = "bars",
  insetShadow = false,
}: WaveformProps) {
  const clipId = useId();
  const shadowId = useId();
  const safeProgress = Math.max(0, Math.min(1, progress));
  const path = variant === "smooth" ? smoothPath(peaks) : "";

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
      viewBox={`0 0 ${variant === "smooth" ? 256 : peaks.length * 4} 32`}
      preserveAspectRatio="none"
    >
      {(variant === "smooth" || insetShadow) && (
        <defs>
          {variant === "smooth" && <clipPath id={clipId}><rect width={256 * safeProgress} height="32" /></clipPath>}
          {insetShadow && <filter id={shadowId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
            <feOffset in="blur" dy="1" result="offset" />
            <feComposite in="SourceAlpha" in2="offset" operator="out" result="edge" />
            <feFlood className="waveform__shadow-color" floodOpacity="0.8" result="color" />
            <feComposite in="color" in2="edge" operator="in" result="shadow" />
            <feComposite in="shadow" in2="SourceGraphic" operator="over" />
          </filter>}
        </defs>
      )}
      {variant === "smooth" ? (
        <>
          <path className="waveform__unplayed" d={path} />
          <path className="waveform__played" clipPath={`url(#${clipId})`} filter={insetShadow ? `url(#${shadowId})` : undefined} d={path} />
        </>
      ) : peaks.map((peak, index) => {
        const height = Math.max(2, Math.min(30, peak * 30));
        return (
          <rect
            key={index}
            x={index * 4 + 1}
            y={(32 - height) / 2}
            width="2"
            height={height}
            rx="1"
            filter={insetShadow && index / peaks.length < safeProgress ? `url(#${shadowId})` : undefined}
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
