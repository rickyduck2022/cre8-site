import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface DubUploadFormValues {
  title: string;
  artistId: string;
  genre: string;
  bpm?: number;
  message: string;
  audioFile: File;
  artworkFile?: File;
}

export interface DubUploadFormProps {
  artists: Array<{ id: string; name: string }>;
  onSubmit: (values: DubUploadFormValues) => void;
  onCancel: () => void;
}

export function DubUploadForm({ artists, onCancel, onSubmit }: DubUploadFormProps) {
  const [fileError, setFileError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const audioFile = formData.get("audioFile");
    const artworkFile = formData.get("artworkFile");
    if (!(audioFile instanceof File) || audioFile.size === 0) {
      setFileError("Choose a WAV or audio file to upload.");
      return;
    }

    const bpmValue = String(formData.get("bpm") ?? "").trim();
    onSubmit({
      title: String(formData.get("title") ?? ""),
      artistId: String(formData.get("artistId") ?? ""),
      genre: String(formData.get("genre") ?? ""),
      bpm: bpmValue ? Number(bpmValue) : undefined,
      message: String(formData.get("message") ?? ""),
      audioFile,
      artworkFile:
        artworkFile instanceof File && artworkFile.size > 0
          ? artworkFile
          : undefined,
    });
    form.reset();
    setFileError("");
  }

  return (
    <form className="dub-upload-form" onSubmit={submit}>
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
        <label className="dub-upload-form__field">
          <span>Genre</span>
          <input maxLength={60} name="genre" placeholder="Optional" />
        </label>
        <label className="dub-upload-form__field">
          <span>BPM</span>
          <input max="300" min="1" name="bpm" placeholder="Optional" type="number" />
        </label>
      </div>
      <label className="dub-upload-form__field">
        <span>Audio file</span>
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
        <span>Track artwork <small>Optional · displays as whitelabel if omitted</small></span>
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
      <div className="dub-upload-form__actions">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancel
        </Button>
        <Button type="submit">Add dub</Button>
      </div>
    </form>
  );
}
