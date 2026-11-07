import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface ArtistRegistrationValues {
  username: string;
  displayName: string;
  genre: string;
  password: string;
}

export interface ArtistRegistrationFormProps {
  error?: string;
  isSubmitting?: boolean;
  onSubmit: (values: ArtistRegistrationValues) => void;
  onSwitchToSignIn: () => void;
}

export function ArtistRegistrationForm({
  error,
  isSubmitting = false,
  onSubmit,
  onSwitchToSignIn,
}: ArtistRegistrationFormProps) {
  const [passwordError, setPasswordError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError("");
    onSubmit({
      username: String(formData.get("username") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      genre: String(formData.get("genre") ?? ""),
      password,
    });
  }

  return (
    <form className="artist-registration-form" onSubmit={submit}>
      <label className="artist-registration-form__field">
        <span>Artist name</span>
        <input autoComplete="name" maxLength={60} name="displayName" required />
      </label>
      <label className="artist-registration-form__field">
        <span>Username</span>
        <input
          autoComplete="username"
          maxLength={24}
          minLength={3}
          name="username"
          pattern="[A-Za-z0-9._-]{3,24}"
          required
          title="Use 3-24 letters, numbers, dots, underscores, or hyphens."
        />
      </label>
      <label className="artist-registration-form__field">
        <span>Genres <small>Optional</small></span>
        <input maxLength={60} name="genre" placeholder="e.g. UK Garage, Bassline" />
      </label>
      <label className="artist-registration-form__field">
        <span>Password</span>
        <input
          autoComplete="new-password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="artist-registration-form__field">
        <span>Confirm password</span>
        <input
          autoComplete="new-password"
          maxLength={128}
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {(error || passwordError) && (
        <span className="artist-registration-form__error" role="alert">
          {passwordError || error}
        </span>
      )}
      <div className="artist-registration-form__actions">
        <Button
          disabled={isSubmitting}
          onClick={onSwitchToSignIn}
          type="button"
          variant="tertiary"
        >
          Back to sign in
        </Button>
        <Button loading={isSubmitting} type="submit">
          Create artist account
        </Button>
      </div>
    </form>
  );
}
