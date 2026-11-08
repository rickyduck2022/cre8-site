import { cn } from "../../utils/cn";
import "./ProgressBar.css";

export interface ProgressBarProps {
  label: string;
  value: number;
  className?: string;
}

export function ProgressBar({ className, label, value }: ProgressBarProps) {
  const progress = Math.max(0, Math.min(100, value));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={progress}
      className={cn("progress-bar", className)}
      role="progressbar"
    >
      <span className="progress-bar__value" style={{ width: `${progress}%` }} />
    </div>
  );
}
