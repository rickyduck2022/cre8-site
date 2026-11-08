import type { InputHTMLAttributes } from "react";
import { Search } from "@craft/icons";
import "../Molecules.css";

export interface SearchFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
  compactOnMobile?: boolean;
}

export function SearchField({
  "aria-label": ariaLabel,
  className,
  compactOnMobile = false,
  shortcut,
  type: _type,
  ...props
}: SearchFieldProps) {
  return (
    <label
      className={[
        "search-field",
        compactOnMobile && "search-field--compact-on-mobile",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Search className="search-field__icon" aria-hidden="true" />
      <input
        {...props}
        aria-label={ariaLabel ?? props.placeholder ?? "Search"}
        type="search"
      />
      {shortcut && <kbd className="search-field__shortcut">{shortcut}</kbd>}
    </label>
  );
}
