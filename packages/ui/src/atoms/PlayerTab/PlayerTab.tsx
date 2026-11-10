import { forwardRef, type ComponentProps } from "react";
import { Button } from "../Button/Button";
import { cn } from "../../utils/cn";
import "./PlayerTab.css";

export const PlayerTab = forwardRef<HTMLButtonElement, ComponentProps<typeof Button>>(
  function PlayerTab({ className, ...props }, ref) {
    return <Button {...props} className={cn("player-tab", className)} ref={ref} size="small" variant="tertiary" />;
  },
);
