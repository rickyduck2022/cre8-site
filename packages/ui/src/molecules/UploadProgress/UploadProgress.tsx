import { ProgressBar } from "../../atoms/ProgressBar/ProgressBar";
import type { UploadProgressState } from "../notificationTypes";
import "./UploadProgress.css";

export interface UploadProgressProps {
  progress: UploadProgressState;
}

export function UploadProgress({ progress }: UploadProgressProps) {
  const publishing = progress.phase === "publishing";
  const label = publishing
    ? "Publishing your dub"
    : `Uploading ${progress.fileName}`;

  return (
    <section aria-label="Share progress" className="upload-progress">
      <div className="upload-progress__copy">
        <span>{label}</span>
        <span>{publishing ? "Almost there" : `${progress.progress}%`}</span>
      </div>
      <ProgressBar label={label} value={progress.progress} />
      <p className="upload-progress__hint">
        {publishing
          ? "Finishing your post and updating the Dub Feed."
          : "Keep this window open while your file uploads."}
      </p>
    </section>
  );
}
