import { createContext } from "react";

export const FilterHostContext = createContext<{
  host: HTMLElement | null;
  viewport: HTMLElement | null;
} | null>(null);
