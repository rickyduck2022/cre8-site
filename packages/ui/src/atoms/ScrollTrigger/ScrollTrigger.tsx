import type { HTMLAttributes, Ref } from "react";

export type ScrollTriggerProps = HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };

export function ScrollTrigger({ className, ...props }: ScrollTriggerProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={["scroll-trigger", className].filter(Boolean).join(" ")}
    />
  );
}
