import type { HTMLAttributes } from "react";
import "./VaultLabel.css";

export function VaultLabel({ children, className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`vault-label ${className}`} {...props}>
    <svg aria-hidden="true" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M2 5h16v9H2zM5 5V2h3v3m2 0V1h3v4m2 0V3h2v2M6 9h8" />
    </svg>
    <span>{children}</span>
  </span>;
}
