import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { ModalFooter } from "../ModalFooter/ModalFooter";
import { UploadProgress } from "../UploadProgress/UploadProgress";
import { TagSelector } from "../TagSelector/TagSelector";
import { FriendPicker } from "../FriendPicker/FriendPicker";
import type { UploadProgressState } from "../notificationTypes";
import type { Buddy, Dub } from "../../templates/communityTypes";
import "../Molecules.css";

export interface DubUploadFormValues {
  title: string;
  artistId: string;
  tags: string[];
  bpm?: number;
  message: string;
  audioFile?: File;
  artworkFile?: File;
  distribution?: "worldwide" | "private" | "alist";
  buddyIds?: string[];
}

export interface DubUploadFormProps {
  artists: Array<{ id: string; name: string }>;
  onSubmit: (values: DubUploadFormValues) => unknown | Promise<unknown>;
  onCancel: () => void;
  uploadProgress?: UploadProgressState | null;
  submissionError?: string;
  initialDub?: Dub;
  aListApproved?: boolean;
  buddies?: Buddy[];
  initialBuddyIds?: string[];
}

export function DubUploadForm({
  artists,
  onCancel,
  onSubmit,
  uploadProgress = null,
  submissionError = "",
  initialDub,
  aListApproved = false,
  buddies = [],
  initialBuddyIds = [],
}: DubUploadFormProps) {
  const isEditing = Boolean(initialDub);
  const formId = `dub-upload-form-${useId()}`;
  const [tags, setTags] = useState<string[]>(initialDub?.tags ?? [initialDub?.genre ?? ""].filter(Boolean));
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [distribution, setDistribution] = useState<"worldwide" | "private" | "alist">("worldwide");
  const [buddyIds, setBuddyIds] = useState<string[]>(initialBuddyIds);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const audioFile = formData.get("audioFile");
    const artworkFile = formData.get("artworkFile");
    const selectedAudioFile = audioFile instanceof File && audioFile.size > 0
      ? audioFile
      : undefined;
    if (!selectedAudioFile && !initialDub) {
      setFileError("Choose a WAV or audio file to upload.");
      return;
    }

    const bpmValue = String(formData.get("bpm") ?? "").trim();
    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        title: String(formData.get("title") ?? ""),
        artistId: String(formData.get("artistId") ?? ""),
        tags,
        bpm: bpmValue ? Number(bpmValue) : undefined,
        message: String(formData.get("message") ?? ""),
        distribution: isEditing ? initialDub?.distribution : distribution,
        buddyIds: isEditing || distribution === "private" ? buddyIds.filter((id) => buddies.some((buddy) => buddy.id === id)) : undefined,
        audioFile: selectedAudioFile,
        artworkFile:
          artworkFile instanceof File && artworkFile.size > 0
            ? artworkFile
            : undefined,
      });
      if (result !== false && result !== null) {
        form.reset();
        setTags([]);
        setDistribution("worldwide");
        setBuddyIds([]);
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
          <input autoFocus defaultValue={initialDub?.title} maxLength={100} name="title" required />
        </label>
        <label className="dub-upload-form__field">
          <span>Artist profile</span>
          <select defaultValue={initialDub?.artistId} name="artistId" required>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>
        </label>
        {!isEditing && (
          <label className="dub-upload-form__field">
            <span>Distribution</span>
            <select aria-label="Distribution" aria-describedby={!aListApproved ? `${formId}-alist-help` : undefined} value={distribution} onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === "worldwide" || value === "private" || value === "alist") setDistribution(value);
            }} name="distribution">
              <option value="worldwide">Worldwide - visible to all members</option>
              <option value="private">Private - share with selected friends</option>
              <option value="alist" disabled={!aListApproved}>A-List - approved members only</option>
            </select>
            {!aListApproved && <small id={`${formId}-alist-help`}>A-List approval is required for exclusive uploads.</small>}
          </label>
        )}
        {!isEditing && distribution === "private" && (
          <div className="dub-upload-form__private-friends">
            <p>Optional: send this private dub to friends in Messenger when it uploads. Manage access in My Dubs; unsending does not revoke access or recall downloaded files.</p>
            <FriendPicker buddies={buddies} selectedIds={buddyIds} onChange={setBuddyIds} />
          </div>
        )}
        {isEditing && <p>Distribution: {initialDub?.distribution === "alist" ? "A-List" : initialDub?.distribution === "private" ? "Private" : "Worldwide"} (cannot be changed after upload)</p>}
        {isEditing && (
          <div className="dub-upload-form__private-friends">
            <p>Optional: send the saved track to friends in Messenger. Changes create a new version; friends marked Shared received the current version.</p>
            {initialDub?.distribution === "private" && <p>Sending grants private access. Unsend does not revoke access or recall downloaded files.</p>}
            {initialDub?.distribution === "alist" && <p>Only approved A-List members can receive this dub.</p>}
            <FriendPicker buddies={buddies} sharedIds={initialDub?.sharedBuddyIds} selectedIds={buddyIds} onChange={setBuddyIds} />
          </div>
        )}
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
              defaultValue={initialDub?.bpm || ""}
              max="300"
              min="1"
              name="bpm"
              placeholder="Optional"
              type="number"
            />
          </label>
        </div>
        <label className="dub-upload-form__field">
          <span>
            {isEditing ? "Replace audio" : "Audio file"}
            <small>{isEditing ? initialDub?.audioFileName ?? "Optional · up to 100 MB" : "Up to 100 MB"}</small>
          </span>
          <input
            accept="audio/*,.wav"
            name="audioFile"
            onChange={() => setFileError("")}
            required={!isEditing}
            type="file"
          />
        </label>
        {fileError && (
          <span className="dub-upload-form__error" role="alert">
            {fileError}
          </span>
        )}
        <label className="dub-upload-form__field">
          <span>{isEditing ? "Replace artwork" : "Track artwork"} <small>Optional · up to 10 MB</small></span>
          <input
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            name="artworkFile"
            type="file"
          />
        </label>
        <label className="dub-upload-form__field">
          <span>Message</span>
          <textarea defaultValue={initialDub?.message} maxLength={400} name="message" rows={3} />
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
        {isSubmitting ? (isEditing ? "Saving dub" : "Sharing dub") : (isEditing ? "Save changes" : "Share dub")}
      </Button>
    </ModalFooter>
    </>
  );
}
