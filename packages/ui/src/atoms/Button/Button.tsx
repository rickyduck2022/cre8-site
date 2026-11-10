import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import "../../foundations/MediaPalette.css";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "audio";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  loading?: boolean;
  hideLabelOnMobile?: boolean;
  compactOnMobile?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  className,
  compactOnMobile = false,
  disabled = false,
  leadingIcon,
  hideLabelOnMobile = false,
  loading = false,
  size = "medium",
  type = "button",
  variant = "primary",
  ...props
}, ref) {
  const classes = cn(
    "button",
    `button--${variant}`,
    `button--${size}`,
    hideLabelOnMobile && "button--hide-label-mobile",
    compactOnMobile && "button--compact-on-mobile",
    className,
  );

  return (
    <button
      ref={ref}
      aria-busy={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span className="button__spinner" aria-hidden="true" />
      ) : (
        leadingIcon && (
          <span className="button__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )
      )}
      {children !== undefined && children !== null && children !== false && (
        <span className="button__label">{children}</span>
      )}
    </button>
  );
});
