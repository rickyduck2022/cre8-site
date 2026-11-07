import type { FormEvent } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface EditableProfile {
  displayName: string;
  bio: string;
  genre: string;
  role: string;
}

export interface EditProfileFormProps {
  profile: EditableProfile;
  onCancel: () => void;
  onSubmit: (profile: EditableProfile) => void;
}

export function EditProfileForm({ onCancel, onSubmit, profile }: EditProfileFormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      displayName: String(formData.get("displayName") ?? "").trim(),
      role: String(formData.get("role") ?? "").trim(),
      genre: String(formData.get("genre") ?? "").trim(),
      bio: String(formData.get("bio") ?? "").trim(),
    });
  }

  return (
    <form className="edit-profile-form" onSubmit={submit}>
      <label className="edit-profile-form__field">
        <span>Artist name</span>
        <input autoFocus maxLength={100} name="displayName" required defaultValue={profile.displayName} />
      </label>
      <label className="edit-profile-form__field">
        <span>Role</span>
        <input maxLength={100} name="role" defaultValue={profile.role} />
      </label>
      <label className="edit-profile-form__field">
        <span>Genres</span>
        <input maxLength={100} name="genre" defaultValue={profile.genre} />
      </label>
      <label className="edit-profile-form__field">
        <span>About</span>
        <textarea maxLength={500} name="bio" rows={4} defaultValue={profile.bio} />
      </label>
      <div className="edit-profile-form__actions">
        <Button onClick={onCancel} variant="secondary">Cancel</Button>
        <Button type="submit">Save profile</Button>
      </div>
    </form>
  );
}
