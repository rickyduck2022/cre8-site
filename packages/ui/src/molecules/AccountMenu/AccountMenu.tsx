import { useEffect, useRef, useState } from "react";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import "../Molecules.css";

export interface AccountMenuProps {
  userName: string;
  userAvatarUrl?: string;
  onEditProfile: () => void;
  onLogout: () => void;
  onHelp?: () => void;
}

export function AccountMenu({
  onEditProfile,
  onLogout,
  onHelp,
  userName,
  userAvatarUrl,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const keyboardTarget = useRef<"first" | "last" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (keyboardTarget.current) {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"], [role="menuitemcheckbox"]');
      (keyboardTarget.current === "last" ? items?.item(items.length - 1) : items?.item(0))?.focus();
      keyboardTarget.current = null;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function closeAndRun(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <div
      className="account-menu"
      onBlur={(event) => {
        const nextFocusedElement =
          event.relatedTarget instanceof Node ? event.relatedTarget : null;
        if (!event.currentTarget.contains(nextFocusedElement)) {
          setIsOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        if (!isOpen) {
          event.preventDefault();
          keyboardTarget.current = event.key === "ArrowUp" || event.key === "End" ? "last" : "first";
          setIsOpen(true);
          return;
        }
        const menuItems = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"], [role="menuitemcheckbox"]') ?? [],
        );
        if (menuItems.length === 0) return;
        event.preventDefault();
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? menuItems.length - 1
            : event.key === "ArrowDown"
              ? (currentIndex + 1) % menuItems.length
              : (currentIndex <= 0 ? menuItems.length : currentIndex) - 1;
        setIsOpen(true);
        menuItems[nextIndex]?.focus();
      }}
      ref={menuRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Account menu for ${userName}`}
        className="account-menu__trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Avatar name={userName} size="small" src={userAvatarUrl} />
      </button>
      {isOpen && (
        <div aria-label="Account options" className="account-menu__popover" role="menu">
          <span className="account-menu__name">{userName}</span>
          <ThemeToggle menuItem />
          {onHelp && <button onClick={() => closeAndRun(onHelp)} role="menuitem" type="button">Help &amp; tutorials</button>}
          <button
            onClick={() => closeAndRun(onEditProfile)}
            role="menuitem"
            type="button"
          >
            Edit profile
          </button>
          <button
            onClick={() => closeAndRun(onLogout)}
            role="menuitem"
            type="button"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
