import { createContext } from "react";

export const BrowseChromeContext = createContext<{
  compact: boolean;
  setCompact: (compact: boolean) => void;
} | null>(null);
