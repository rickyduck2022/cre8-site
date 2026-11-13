import type { ReactNode } from "react";
import { Mail, Upload } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { AccountMenu } from "../../molecules/AccountMenu/AccountMenu";
import { Brand } from "../../molecules/Brand/Brand";
import type { NotificationMessage } from "../../molecules/notificationTypes";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { NotificationCenter } from "../NotificationCenter/NotificationCenter";
import { ThemeToggle } from "../../molecules/ThemeToggle/ThemeToggle";
import "../Organisms.css";

export interface AppHeaderProps {
  userName?: string;
  userAvatarUrl?: string;
  searchPlaceholder?: string;
  variant?: "default" | "compact" | "mobile";
  onCreate?: () => void;
  createLabel?: string;
  onEditProfile?: () => void;
  onLogout?: () => void;
  onHelp?: () => void;
  onNotifications?: () => void;
  onMessages?: () => void;
  unreadMessageCount?: number;
  notifications?: NotificationMessage[];
  unreadNotificationCount?: number;
  onDismissNotification?: (id: string) => void;
  onClearNotifications?: () => void;
  onActivateNotification?: (notification: NotificationMessage) => void;
  pushSettings?: ReactNode;
  onSearchChange?: (query: string) => void;
  searchValue?: string;
  className?: string;
  logoSrc?: string;
  brandDescriptor?: string;
  leading?: ReactNode;
}

export function AppHeader({
  className,
  leading,
  logoSrc,
  brandDescriptor,
  onCreate,
  createLabel = "Share a dub",
  onEditProfile,
  onLogout,
  onHelp,
  onMessages,
  onNotifications,
  notifications = [],
  unreadNotificationCount = 0,
  unreadMessageCount = 0,
  onDismissNotification,
  onClearNotifications,
  onActivateNotification,
  pushSettings,
  onSearchChange,
  searchPlaceholder = "Search dubs, people, or genres",
  searchValue,
  userName = "MelaDee",
  userAvatarUrl,
  variant = "default",
}: AppHeaderProps) {
  return (
    <header
      className={[
        "organism-card",
        "app-header",
        "vault-rack",
        brandDescriptor && "app-header--described",
        `app-header--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {leading}
      <Brand logoSrc={logoSrc} descriptor={brandDescriptor} />
      <SearchField
        aria-label={searchPlaceholder}
        className="app-header__search"
        compactOnMobile={variant !== "default"}
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder={searchPlaceholder}
        value={searchValue}
      />
      <div className="app-header__actions">
        <ThemeToggle />
        {onMessages && (
          <button
            aria-label={unreadMessageCount > 0
              ? `Messages, ${unreadMessageCount} unread`
              : "Messages"}
            className="app-header__messages"
            onClick={onMessages}
            type="button"
          >
            <Mail aria-hidden="true" />
            {unreadMessageCount > 0 && (
              <span aria-hidden="true" className="app-header__messages-count">
                {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
              </span>
            )}
          </button>
        )}
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadNotificationCount}
          onClear={onClearNotifications ?? (() => undefined)}
          onDismiss={onDismissNotification ?? (() => undefined)}
          onActivate={onActivateNotification}
          onOpen={onNotifications ?? (() => undefined)}
          pushSettings={pushSettings}
        />
        <Button
          aria-label={createLabel}
          compactOnMobile
          leadingIcon={<Upload aria-hidden="true" />}
          onClick={onCreate}
          size="small"
        />
        {onEditProfile && onLogout && (
          <AccountMenu
            onHelp={onHelp}
            onEditProfile={onEditProfile}
            onLogout={onLogout}
            userName={userName}
            userAvatarUrl={userAvatarUrl}
          />
        )}
      </div>
    </header>
  );
}
