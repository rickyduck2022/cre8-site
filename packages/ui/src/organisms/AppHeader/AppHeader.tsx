import { Bell, Upload } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { AccountMenu } from "../../molecules/AccountMenu/AccountMenu";
import { Brand } from "../../molecules/Brand/Brand";
import { SearchField } from "../../molecules/SearchField/SearchField";
import "../Organisms.css";

export interface AppHeaderProps {
  userName?: string;
  searchPlaceholder?: string;
  variant?: "default" | "compact" | "mobile";
  onCreate?: () => void;
  onEditProfile?: () => void;
  onLogout?: () => void;
  onNotifications?: () => void;
  onSearchChange?: (query: string) => void;
  searchValue?: string;
  className?: string;
}

export function AppHeader({
  className,
  onCreate,
  onEditProfile,
  onLogout,
  onNotifications,
  onSearchChange,
  searchPlaceholder = "Search dubs, people, or genres",
  searchValue,
  userName = "MelaDee",
  variant = "default",
}: AppHeaderProps) {
  return (
    <header
      className={[
        "organism-card",
        "app-header",
        `app-header--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Brand />
      <SearchField
        aria-label={searchPlaceholder}
        className="app-header__search"
        compactOnMobile={variant !== "default"}
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder={searchPlaceholder}
        value={searchValue}
      />
      <div className="app-header__actions">
        <Button
          aria-label="Notifications"
          className="app-header__icon-button"
          leadingIcon={<Bell aria-hidden="true" />}
          onClick={onNotifications}
          size="small"
          variant="tertiary"
        >
          <span className="sr-only">Notifications</span>
        </Button>
        <Button
          compactOnMobile
          leadingIcon={<Upload aria-hidden="true" />}
          hideLabelOnMobile
          onClick={onCreate}
          size="small"
        >
          Share a dub
        </Button>
        {onEditProfile && onLogout && (
          <AccountMenu
            onEditProfile={onEditProfile}
            onLogout={onLogout}
            userName={userName}
          />
        )}
      </div>
    </header>
  );
}
