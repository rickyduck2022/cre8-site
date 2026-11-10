import { forwardRef, type ComponentProps } from "react";
import { Button } from "../Button/Button";
import "./EdgeTab.css";

export const EdgeTab = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(function EdgeTab({ className, ...props }, ref) {
  return <Button {...props} className={["edge-tab", className].filter(Boolean).join(" ")} ref={ref} size="small" variant="tertiary" />;
});
