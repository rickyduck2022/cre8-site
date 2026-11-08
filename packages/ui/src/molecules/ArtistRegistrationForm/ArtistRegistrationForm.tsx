import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface ArtistRegistrationValues {
  displayName: string;
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
      displayName: String(formData.get("displayName") ?? ""),
      password,
    });
  }

  return (
    <form className="artist-registration-form" onSubmit={submit}>
      <label className="artist-registration-form__field">
        <span>Artist</span>
        <input autoComplete="name" maxLength={60} name="displayName" required />
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
