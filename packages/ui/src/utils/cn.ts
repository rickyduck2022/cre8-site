/**
 * Utility function for conditionally joining classnames
 * 
 * Filters out falsy values and joins class strings with spaces
 * 
 * @param classes - Variable number of class strings or falsy values
 * @returns Combined class string
 * 
 * @example
 * cn("button", isActive && "button--active", disabled && "button--disabled")
 * // Returns: "button button--active" (if isActive=true, disabled=false)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
