import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface CreateCrateFormProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function CreateCrateForm({ onCancel, onSubmit }: CreateCrateFormProps) {
  const [name, setName] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const crateName = name.trim();
    if (!crateName) return;
    onSubmit(crateName);
    setName("");
  }

  return (
    <form className="crate-form" onSubmit={submit}>
      <label className="crate-form__field">
        <span>Crate name</span>
        <input
          autoFocus
          maxLength={60}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="e.g. Late-night weapons"
          required
          value={name}
        />
      </label>
      <div className="crate-form__actions">
        <Button onClick={onCancel} variant="secondary">Cancel</Button>
        <Button disabled={!name.trim()} type="submit">Create crate</Button>
      </div>
    </form>
  );
}
