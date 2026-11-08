import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { ModalFooter } from "../ModalFooter/ModalFooter";
import "../Molecules.css";

export interface CreateCrateFormProps {
  onSubmit: (name: string) => void | boolean | Promise<void | boolean>;
  onCancel?: () => void;
  initialName?: string;
  submitLabel?: string;
}

export function CreateCrateForm({
  onCancel,
  onSubmit,
  initialName = "",
  submitLabel = "Create crate",
}: CreateCrateFormProps) {
  const formId = `create-crate-form-${useId()}`;
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const crateName = name.trim();
    if (!crateName || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const succeeded = await onSubmit(crateName);
      if (succeeded !== false) setName("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <form className="crate-form" id={formId} onSubmit={submit}>
      <label className="crate-form__field">
        <span>Crate name</span>
        <input
          autoFocus={!initialName}
          maxLength={60}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="e.g. Late-night weapons"
          required
          value={name}
        />
      </label>
    </form>
    <ModalFooter>
      {onCancel && <Button disabled={isSubmitting} form={formId} onClick={onCancel} type="button" variant="secondary">Cancel</Button>}
      <Button disabled={!name.trim() || isSubmitting} form={formId} loading={isSubmitting} type="submit">{submitLabel}</Button>
    </ModalFooter>
    </>
  );
}
