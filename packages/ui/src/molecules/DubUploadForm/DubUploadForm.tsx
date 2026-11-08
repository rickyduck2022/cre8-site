import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { ModalFooter } from "../ModalFooter/ModalFooter";
import { UploadProgress } from "../UploadProgress/UploadProgress";
import { TagSelector } from "../TagSelector/TagSelector";
import type { UploadProgressState } from "../notificationTypes";
import "../Molecules.css";

export interface DubUploadFormValues {
  title: string;
  artistId: string;
  tags: string[];
  bpm?: number;
  message: string;
  audioFile: File;
  artworkFile?: File;
}

export interface DubUploadFormProps {
  artists: Array<{ id: string; name: string }>;
  onSubmit: (values: DubUploadFormValues) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
  uploadProgress?: UploadProgressState | null;
  submissionError?: string;
}

export function DubUploadForm({
  artists,
  onCancel,
  onSubmit,
  uploadProgress = null,
  submissionError = "",
}: DubUploadFormProps) {
  const formId = `dub-upload-form-${useId()}`;
  const [tags, setTags] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const audioFile = formData.get("audioFile");
    const artworkFile = formData.get("artworkFile");
    if (!(audioFile instanceof File) || audioFile.size === 0) {
      setFileError("Choose a WAV or audio file to upload.");
      return;
    }

    const bpmValue = String(formData.get("bpm") ?? "").trim();
    setIsSubmitting(true);
    try {
      const succeeded = await onSubmit({
        title: String(formData.get("title") ?? ""),
        artistId: String(formData.get("artistId") ?? ""),
        tags,
        bpm: bpmValue ? Number(bpmValue) : undefined,
        message: String(formData.get("message") ?? ""),
        audioFile,
        artworkFile:
          artworkFile instanceof File && artworkFile.size > 0
            ? artworkFile
            : undefined,
      });
      if (succeeded !== false) {
        form.reset();
        setTags([]);
        setFileError("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <form className="dub-upload-form" id={formId} onSubmit={submit}>
      <fieldset className="dub-upload-form__fields" disabled={isSubmitting}>
        <label className="dub-upload-form__field">
          <span>Track title</span>
          <input autoFocus maxLength={100} name="title" required />
        </label>
        <label className="dub-upload-form__field">
          <span>Artist profile</span>
          <select name="artistId" required>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>
        </label>
        <div className="dub-upload-form__row">
          <TagSelector
            label="Tags"
            options={["Jump Up", "Rollers", "Dancefloor", "Jungle", "Liquid", "Neurofunk", "Vocal", "Deep", "Minimal", "Techstep", "Atmospheric", "Old School"]}
            onChange={setTags}
            value={tags}
          />
          <label className="dub-upload-form__field dub-upload-form__field--bpm">
            <span>BPM</span>
            <input
              max="300"
              min="1"
              name="bpm"
              placeholder="Optional"
              type="number"
            />
          </label>
        </div>
        <label className="dub-upload-form__field">
          <span>Audio file <small>Up to 100 MB</small></span>
          <input
            accept="audio/*,.wav"
            name="audioFile"
            onChange={() => setFileError("")}
            required
            type="file"
          />
        </label>
        {fileError && (
          <span className="dub-upload-form__error" role="alert">
            {fileError}
          </span>
        )}
        <label className="dub-upload-form__field">
          <span>Track artwork <small>Optional · up to 10 MB</small></span>
          <input
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            name="artworkFile"
            type="file"
          />
        </label>
        <label className="dub-upload-form__field">
          <span>Message</span>
          <textarea maxLength={400} name="message" rows={3} />
        </label>
      </fieldset>
      {submissionError && (
        <p className="dub-upload-form__error" role="alert">
          {submissionError}
        </p>
      )}
    </form>
    <ModalFooter>
      {uploadProgress && <UploadProgress progress={uploadProgress} />}
      <Button disabled={isSubmitting} form={formId} onClick={onCancel} type="button" variant="secondary">
        Cancel
      </Button>
      <Button disabled={isSubmitting} form={formId} loading={isSubmitting} type="submit">
        {isSubmitting ? "Sharing dub" : "Share dub"}
      </Button>
    </ModalFooter>
    </>
  );
}
