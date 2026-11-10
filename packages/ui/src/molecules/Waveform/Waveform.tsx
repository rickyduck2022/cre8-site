import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
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

/** Resamples peaks so the rendered density stays constant at any width. */
function resamplePeaks(peaks: number[], count: number) {
  if (peaks.length === 0 || count <= 0) return [];
  if (count === peaks.length) return peaks;
  if (count > peaks.length) {
    return Array.from({ length: count }, (_, index) => {
      const position = count === 1 ? 0 : index * (peaks.length - 1) / (count - 1);
      const low = Math.floor(position);
      const high = Math.min(peaks.length - 1, low + 1);
      return peaks[low] + (peaks[high] - peaks[low]) * (position - low);
    });
  }
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * peaks.length / count);
    const end = Math.max(start + 1, Math.floor((index + 1) * peaks.length / count));
    let bucketPeak = 0;
    for (let source = start; source < end; source += 1) bucketPeak = Math.max(bucketPeak, peaks[source]);
    return bucketPeak;
  });
}

function smoothPath(peaks: number[], width = 256, height = 32) {
  if (peaks.length === 0) return "";
  const mid = height / 2;
  const amplitude = mid - 1;
  const points = peaks.map((peak, index) => ({
    x: peaks.length === 1 ? width / 2 : index * width / (peaks.length - 1),
    height: Math.max(1, Math.min(amplitude, peak * amplitude)),
  }));
  const edge = (values: typeof points, direction: number) => values.map((point, index) => {
    const next = values[index + 1];
    return next
      ? `Q ${point.x} ${mid + direction * point.height} ${(point.x + next.x) / 2} ${mid + direction * (point.height + next.height) / 2}`
      : `L ${point.x} ${mid + direction * point.height}`;
  }).join(" ");
  return `M 0 ${mid} ${edge(points, -1)} L ${width} ${mid} ${edge([...points].reverse(), 1)} Z`;
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
  const dragPointerId = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const safeProgress = Math.max(0, Math.min(1, progress));

  // Render geometry at the element's actual size so bars keep a constant
  // density and curves are never stretched, whatever the container width.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMeasured(width >= 8 && height >= 8 ? { width: Math.round(width), height: Math.round(height) } : null);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const viewWidth = measured?.width ?? (variant === "smooth" ? 256 : peaks.length * 4);
  const viewHeight = measured?.height ?? 32;
  const barPeaks = variant === "bars" && measured
    ? resamplePeaks(peaks, Math.max(2, Math.floor(measured.width / 4)))
    : peaks;
  const barOffset = measured ? Math.max(0, (viewWidth - barPeaks.length * 4) / 2) : 0;
  const path = variant === "smooth" ? smoothPath(peaks, viewWidth, viewHeight) : "";

  function seekFromPointer(event: MouseEvent<SVGSVGElement>) {
    if (!onSeek) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    onSeek(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)));
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (!onSeek || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    seekFromPointer(event);
  }

  function dragSeek(event: PointerEvent<SVGSVGElement>) {
    if (dragPointerId.current !== event.pointerId) return;
    seekFromPointer(event);
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (dragPointerId.current !== event.pointerId) return;
    dragPointerId.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
      ref={svgRef}
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
      onPointerCancel={endDrag}
      onPointerDown={startDrag}
      onPointerMove={dragSeek}
      onPointerUp={endDrag}
      role={onSeek ? "slider" : "img"}
      tabIndex={onSeek ? 0 : undefined}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
    >
      {(variant === "smooth" || insetShadow) && (
        <defs>
          {variant === "smooth" && <clipPath id={clipId}><rect width={viewWidth * safeProgress} height={viewHeight} /></clipPath>}
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
      ) : barPeaks.map((peak, index) => {
        const maxHeight = viewHeight - 2;
        const height = Math.max(2, Math.min(maxHeight, peak * maxHeight));
        return (
          <rect
            key={index}
            x={barOffset + index * 4 + 1}
            y={(viewHeight - height) / 2}
            width="2"
            height={height}
            rx="1"
            filter={insetShadow && index / barPeaks.length < safeProgress ? `url(#${shadowId})` : undefined}
            className={
              index / barPeaks.length < safeProgress
                ? "waveform__played"
                : "waveform__unplayed"
            }
          />
        );
      })}
    </svg>
  );
}
