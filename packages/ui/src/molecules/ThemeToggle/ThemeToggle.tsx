import { Button } from "../../atoms/Button/Button";
import { Moon, Sun } from "@craft/icons";
import { useTheme } from "../../foundations/Theme";

export function ThemeToggle({ menuItem = false }: { menuItem?: boolean }) {
  const appearance = useTheme();
  if (!appearance) return null;
  const light = appearance.theme === "light";
  const toggle = () => appearance.setTheme(light ? "dark" : "light");
  return <span className={menuItem ? "theme-toggle-menu" : "theme-toggle"}>
    {menuItem ? (
      <button role="menuitemcheckbox" aria-checked={light} onClick={toggle} type="button">
        Light theme {light ? "(on)" : "(off)"}
      </button>
    ) : (
      <Button variant="tertiary" size="small" compactOnMobile aria-label="Light theme"
        aria-pressed={light} title={`Switch to ${light ? "dark" : "light"} theme`}
        onClick={toggle}
        leadingIcon={light ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />} />
    )}
    {appearance.error && <span role="alert">{appearance.error}</span>}
  </span>;
}
