import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Action.css";

export type ActionVariant = "neutral" | "primary" | "audio";

export interface ActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: ActionVariant;
}

export function Action({
  children,
  className,
  icon,
  type = "button",
  variant = "neutral",
  ...props
}: ActionProps) {
  const classes = ["action", `action--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...props}>
      {icon && (
        <span className="action__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
