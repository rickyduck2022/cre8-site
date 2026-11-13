import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";
const storageKey = "cre8:theme";
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  error: string | null;
} | null>(null);

export function initializeTheme(): Theme {
  let theme: Theme = "dark";
  try {
    if (window.localStorage.getItem(storageKey) === "light") theme = "light";
  } catch (error) {
    console.error("Unable to read the saved theme preference.", error);
  }
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(initializeTheme);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        updateTheme(event.newValue === "light" ? "light" : "dark");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function setTheme(next: Theme) {
    updateTheme(next);
    setError(null);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch (failure) {
      console.error("Unable to save the theme preference.", failure);
      setError("Theme changed, but this browser could not save your preference.");
    }
  }
  return <ThemeContext.Provider value={{ theme, setTheme, error }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
