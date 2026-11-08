import type { HTMLAttributes, Ref } from "react";

export type ScrollViewportProps = HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };

export function ScrollViewport({ className, ...props }: ScrollViewportProps) {
  return (
    <div
      {...props}
      className={["scroll-viewport", className].filter(Boolean).join(" ")}
    />
  );
}
