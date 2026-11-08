/**
 * Custom hook for managing keyboard navigation in menu components
 * 
 * Provides arrow key navigation (ArrowUp, ArrowDown, Home, End) for menu items
 * and automatic focus management.
 */

import { useCallback, useRef } from "react";

export interface UseMenuKeyboardOptions {
  /**
   * Selector for menu items (should have role="menuitem")
   */
  itemSelector?: string;
}

/**
 * Manages keyboard navigation for menu components
 * 
 * @param onOpenMenu - Callback to open the menu (called when navigation starts)
 * @param options - Configuration options
 * @returns Object with onKeyDown handler
 * 
 * @example
 * const menuRef = useRef<HTMLDivElement>(null);
 * const { onKeyDown } = useMenuKeyboard(() => setIsOpen(true));
 * 
 * <div ref={menuRef} onKeyDown={onKeyDown}>
 *   <button role="menuitem">Item 1</button>
 *   <button role="menuitem">Item 2</button>
 * </div>
 */
export function useMenuKeyboard(
  onOpenMenu?: () => void,
  options: UseMenuKeyboardOptions = {},
) {
  const { itemSelector = '[role="menuitem"]' } = options;
  const menuRef = useRef<HTMLDivElement | null>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

      const menuContainer = menuRef.current || event.currentTarget;
      const menuItems = Array.from(
        menuContainer.querySelectorAll<HTMLButtonElement>(itemSelector),
      );

      if (menuItems.length === 0) return;

      event.preventDefault();
      onOpenMenu?.();

      const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? menuItems.length - 1
            : event.key === "ArrowDown"
              ? (currentIndex + 1) % menuItems.length
              : currentIndex <= 0
                ? menuItems.length - 1
                : currentIndex - 1;

      menuItems[nextIndex]?.focus();
    },
    [onOpenMenu, itemSelector],
  );

  return { onKeyDown, setMenuRef: (ref: HTMLDivElement) => { menuRef.current = ref; } };
}
