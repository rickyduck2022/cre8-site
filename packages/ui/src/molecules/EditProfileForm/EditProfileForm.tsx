import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { ModalFooter } from "../ModalFooter/ModalFooter";
import { TagSelector } from "../TagSelector/TagSelector";
import "../Molecules.css";

export interface EditableProfile {
  displayName: string;
  bio: string;
  genre: string;
  role: string;
  avatarUrl?: string;
  bannerUrl?: string;
  links?: Array<{ label: string; url: string }>;
  avatarFile?: File;
  bannerFile?: File;
}

export interface EditProfileFormProps {
  profile: EditableProfile;
  onCancel: () => void;
  onSubmit: (profile: EditableProfile) => void;
}

export function EditProfileForm({ onCancel, onSubmit, profile }: EditProfileFormProps) {
  const formId = `edit-profile-form-${useId()}`;
  const linkLabels = ["SoundCloud", "Spotify", "YouTube", "Bandcamp", "Other website / custom link"];
  const [genres, setGenres] = useState(profile.genre.split(",").map((item) => item.trim()).filter((item) => ["Drum & Bass", "Jungle"].includes(item)));
  const [links, setLinks] = useState(linkLabels.map((label) => ({
    label,
    url: profile.links?.find((link) => link.label === label)?.url ?? "",
  })));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      displayName: String(formData.get("displayName") ?? "").trim(),
      role: String(formData.get("role") ?? "").trim(),
      genre: genres.join(", "),
      bio: String(formData.get("bio") ?? "").trim(),
      avatarFile: formData.get("avatarFile") instanceof File && (formData.get("avatarFile") as File).size ? formData.get("avatarFile") as File : undefined,
      bannerFile: formData.get("bannerFile") instanceof File && (formData.get("bannerFile") as File).size ? formData.get("bannerFile") as File : undefined,
      links: links.filter((link) => link.url.trim()),
    });
  }

  return (
    <>
    <form className="edit-profile-form" id={formId} onSubmit={submit}>
      <label className="edit-profile-form__field">
        <span>Artist name</span>
        <input autoFocus maxLength={100} name="displayName" required defaultValue={profile.displayName} />
      </label>
      <label className="edit-profile-form__field">
        <span>Role</span>
        <input maxLength={100} name="role" defaultValue={profile.role} />
      </label>
      <TagSelector label="Genres" options={["Drum & Bass", "Jungle"]} onChange={setGenres} value={genres} />
      <label className="edit-profile-form__field"><span>Profile picture <small>JPG, PNG or WebP · max 2 MB</small></span><input accept="image/jpeg,image/png,image/webp" name="avatarFile" type="file" /></label>
      <label className="edit-profile-form__field"><span>Cover banner <small>JPG, PNG or WebP · max 10 MB</small></span><input accept="image/jpeg,image/png,image/webp" name="bannerFile" type="file" /></label>
      <label className="edit-profile-form__field">
        <span>About me</span>
        <textarea maxLength={500} name="bio" rows={4} defaultValue={profile.bio} />
      </label>
      <fieldset className="edit-profile-form__links">
        <legend>Links</legend>
        {links.map((link, index) => (
          <label className="edit-profile-form__field" key={link.label}>
            <span>{link.label}</span>
            <input
              maxLength={300}
              onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.currentTarget.value } : item))}
              placeholder="https://"
              type="url"
              value={link.url}
            />
          </label>
        ))}
      </fieldset>
    </form>
    <ModalFooter>
      <Button form={formId} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
      <Button form={formId} type="submit">Save profile</Button>
    </ModalFooter>
    </>
  );
}
