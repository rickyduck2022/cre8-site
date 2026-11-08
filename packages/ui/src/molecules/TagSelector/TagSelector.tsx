import { useId } from "react";
import "../Molecules.css";

export interface TagSelectorProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export function TagSelector({ className, label, onChange, options, value }: TagSelectorProps) {
  const id = useId();
  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag]);
  }
  return (
    <fieldset aria-labelledby={id} className={["tag-selector", className].filter(Boolean).join(" ")}>
      <legend id={id}>{label}</legend>
      <div className="tag-selector__options">
        {options.map((tag) => (
          <button
            aria-pressed={value.includes(tag)}
            className={value.includes(tag) ? "is-selected" : undefined}
            key={tag}
            onClick={() => toggle(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
