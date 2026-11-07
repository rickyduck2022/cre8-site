import type { ButtonHTMLAttributes } from "react";
import "./FilterTab.css";

export interface FilterTabProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function FilterTab({
  active = false,
  children,
  className,
  type = "button",
  ...props
}: FilterTabProps) {
  const classes = ["filter-tab", active && "filter-tab--active", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-selected={active}
      className={classes}
      role="tab"
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
