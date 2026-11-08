# React Component Library - Refactoring Quick Reference

## 🎯 Key Changes at a Glance

| Area | What Changed | How to Use |
|------|-------------|-----------|
| **Design Tokens** | Hardcoded values → CSS variables | Use `var(--spacing-md)`, `var(--animation-duration-fast)` in CSS |
| **Domain Types** | Import from templates → Shared types layer | Import from `@craft/ui/types/domain` |
| **Classnames** | Filter + join pattern → `cn()` utility | Use `cn("class", condition && "class-alt")` |
| **Menu Keyboard** | Manual handling → Custom hook | Use `useMenuKeyboard()` hook |
| **Accessibility** | Ad hoc → Systematic WCAG | Modal has focus trap, AccountMenu has full keyboard nav |

---

## 📚 New APIs

### 1. Design Tokens (`foundations/design-tokens.css`)

```css
/* Available tokens */
--breakpoint-mobile: 520px
--animation-duration-fast: 120ms
--animation-duration-spinner: 800ms
--animation-easing-default: ease
--spacing-2xs through --spacing-5xl
--size-icon-small, --size-icon-medium
--focus-outline-width: 2px
--border-radius-default: 0.5rem
```

**Usage in CSS:**
```css
.component {
  padding: var(--spacing-md);
  border-radius: var(--border-radius-default);
  animation: spin var(--animation-duration-spinner);
}

@media (max-width: var(--breakpoint-mobile)) {
  .component { /* mobile styles */ }
}
```

---

### 2. Shared Domain Types (`types/domain.ts`)

```typescript
// Import from centralized types layer
import type {
  Dub,
  Buddy,
  MemberSearchResult,
  ChatMessage,
  Conversation,
  AListApplication,
  Presence,
  AListRole,
} from "@craft/ui/types/domain";

// ✅ DO THIS
import type { Dub } from "../../types/domain";

// ❌ DON'T DO THIS (old pattern)
import type { Dub } from "../templates/communityTypes";
```

**Available Types:**
- `Presence`, `AListRole`, `AListProvider`
- `AListApplication`, `AListApplicationFields`
- `ChatConnectionStatus`
- `Buddy`, `MemberSearchResult`, `MemberProfile`
- `Dub`, `LibraryDownload`
- `ChatMessage`, `Conversation`, `ChatMessagePage`
- `ArtistOption`

---

### 3. Classname Utility (`utils/cn.ts`)

```typescript
import { cn } from "../../utils/cn";

// Replaces the filter + join pattern
const className = cn(
  "button",
  variant && `button--${variant}`,
  size && `button--${size}`,
  disabled && "button--disabled",
  customClass
);

// Falsy values are automatically filtered out
// Returns: "button button--primary button--large" (if conditions met)
```

---

### 4. Menu Keyboard Hook (`utils/useMenuKeyboard.ts`)

```typescript
import { useMenuKeyboard } from "../../utils/useMenuKeyboard";

export function MyMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { onKeyDown } = useMenuKeyboard(() => setIsOpen(true));

  return (
    <div role="menu" onKeyDown={onKeyDown}>
      <button role="menuitem">Item 1</button>
      <button role="menuitem">Item 2</button>
      <button role="menuitem">Item 3</button>
    </div>
  );
}

// Supports: ArrowUp, ArrowDown, Home, End with automatic focus management
```

---

## 🏗️ Atomic Design Architecture

### Proper Import Hierarchy

```
Atoms
  └─ types, utils, foundations
  
Molecules
  └─ atoms, types/domain, utils, foundations
  
Organisms
  └─ atoms, molecules, types/domain, utils, foundations
  
Templates
  └─ atoms, molecules, organisms, types/domain, utils, templates/shared
```

### ✅ Good Imports

```typescript
// Atom or Molecule
import { cn } from "../../utils/cn";
import type { Dub } from "../../types/domain";
import { useMenuKeyboard } from "../../utils/useMenuKeyboard";

// Organism
import { Button } from "../../atoms/Button/Button";
import { SearchField } from "../../molecules/SearchField/SearchField";
import type { Buddy } from "../../types/domain";

// Template
import { DubCard } from "../../organisms/DubCard/DubCard";
import { LatestDubsTemplate } from "../LatestDubsTemplate/LatestDubsTemplate";
```

### ❌ Bad Imports

```typescript
// Molecule importing from organisms (wrong!)
import { AudioPlayer } from "../../organisms/AudioPlayer/AudioPlayer";

// Atom importing from templates (wrong!)
import type { Dub } from "../../../templates/communityTypes";

// Upward dependency (wrong!)
import { something } from "../templates";
```

---

## ♿ Accessibility Checklist

### Menu Components

- [ ] Has `role="menu"` on container
- [ ] Menu items have `role="menuitem"`
- [ ] Implements `useMenuKeyboard` hook
- [ ] Supports ArrowUp/Down/Home/End navigation
- [ ] First item focused when menu opens
- [ ] Focus management on close

### Modal Components

- [ ] Uses native `<dialog>` element
- [ ] Has `aria-labelledby` pointing to heading
- [ ] Has generated heading ID for a11y
- [ ] Focus trap on open
- [ ] Focus restore on close
- [ ] Escape key closes modal

### Button Components

- [ ] Has `type="button"` (or submit/reset as needed)
- [ ] Shows `aria-busy` when loading
- [ ] Loading icon has `aria-hidden="true"`
- [ ] Disabled state properly set
- [ ] Accessible color contrast (WCAG AA)

---

## 🔄 Migration Guide

### Step 1: Update CSS for Design Tokens
```css
/* Before */
.component { padding: 0.75rem; }
@media (max-width: 520px) { }

/* After */
.component { padding: var(--spacing-lg); }
@media (max-width: var(--breakpoint-mobile)) { }
```

### Step 2: Update Imports for Domain Types
```typescript
/* Before */
import type { Dub } from "../templates/communityTypes";

/* After */
import type { Dub } from "../../types/domain";
```

### Step 3: Replace Classname Patterns
```typescript
/* Before */
const cls = ["btn", variant && `btn--${variant}`].filter(Boolean).join(" ");

/* After */
import { cn } from "../../utils/cn";
const cls = cn("btn", variant && `btn--${variant}`);
```

### Step 4: Use Keyboard Navigation Hook
```typescript
/* Before */
const handleKeyDown = (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    // manual focus management...
  }
};

/* After */
import { useMenuKeyboard } from "../../utils/useMenuKeyboard";
const { onKeyDown } = useMenuKeyboard(() => setOpen(true));
<div onKeyDown={onKeyDown} role="menu" />
```

---

## 📊 Design Token Reference

### Spacing Scale
```
--spacing-2xs: 0.25rem  (4px)
--spacing-xs:  0.375rem (6px)
--spacing-sm:  0.5rem   (8px)
--spacing-md:  0.625rem (10px)
--spacing-lg:  0.75rem  (12px)
--spacing-xl:  0.875rem (14px)
--spacing-2xl: 1rem     (16px)
--spacing-3xl: 1.25rem  (20px)
--spacing-4xl: 1.5rem   (24px)
--spacing-5xl: 2rem     (32px)
```

### Animation Timings
```
--animation-duration-fast: 120ms
--animation-duration-spinner: 800ms
--animation-easing-default: ease
```

### Components & Icons
```
--size-icon-small: 1.125rem
--size-icon-medium: 1.25rem
```

### Layout & Focus
```
--breakpoint-mobile: 520px
--focus-outline-width: 2px
--focus-outline-offset: 3px
--border-radius-default: 0.5rem
```

---

## 🧪 Testing Tips

### Testing Menu Keyboard Navigation
```typescript
it("should focus next menu item on ArrowDown", () => {
  const { getByRole } = render(<MyMenu />);
  const menu = getByRole("menu");
  const items = getAllByRole("menuitem");
  
  // Focus first item
  items[0].focus();
  
  // Simulate ArrowDown
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  
  expect(items[1]).toHaveFocus();
});
```

### Testing Modal Focus Management
```typescript
it("should restore focus to trigger button on close", () => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { getByRole, queryByRole } = render(
    <>
      <button ref={triggerRef}>Open</button>
      <ModalComponent isOpen={true} />
    </>
  );
  
  // Focus is in modal
  expect(getByRole("dialog")).toBeInTheDocument();
  
  // Close modal
  // Focus should return to trigger button
  expect(triggerRef.current).toHaveFocus();
});
```

---

## 📞 Common Questions

### Q: Where should I import domain types from?
**A:** Always import from `types/domain`:
```typescript
import type { Dub } from "../../types/domain";
```

### Q: When should I use the `cn()` utility?
**A:** When combining multiple class strings with conditionals:
```typescript
cn("base-class", isActive && "active-class", disabled && "disabled-class")
```

### Q: How do I implement keyboard navigation for a custom menu?
**A:** Use the `useMenuKeyboard` hook:
```typescript
const { onKeyDown } = useMenuKeyboard(() => setOpen(true));
<div onKeyDown={onKeyDown} role="menu">...</div>
```

### Q: Can I add more design tokens?
**A:** Yes! Add them to `foundations/design-tokens.css` under the appropriate section (Breakpoints, Animation, Spacing, etc.)

### Q: How do I migrate an existing component?
**A:** Follow the Migration Guide above, step by step. Start with CSS tokens, then types, then classnames.

---

## 🎓 Resources

- **Refactoring Summary:** `COMPONENT_LIBRARY_REFACTORING.md`
- **Code Examples:** `REFACTORING_CODE_EXAMPLES.md`
- **Design Tokens:** `packages/ui/src/foundations/design-tokens.css`
- **Shared Types:** `packages/ui/src/types/domain.ts`
- **Utilities:** `packages/ui/src/utils/`
- **Atomic Design Principles:** https://bradfrost.com/blog/post/atomic-web-design/
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

---

## 🚀 Quick Start Template

```typescript
// New component following best practices
import { cn } from "../../utils/cn";
import type { Dub } from "../../types/domain";

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  dub: Dub;
  variant?: "default" | "compact";
  isHighlighted?: boolean;
}

export function MyComponent({
  dub,
  variant = "default",
  isHighlighted,
  className,
  ...rest
}: MyComponentProps) {
  return (
    <div
      className={cn(
        "my-component",
        variant && `my-component--${variant}`,
        isHighlighted && "my-component--highlighted",
        className,
      )}
      {...rest}
    >
      {dub.title}
    </div>
  );
}
```

---

**Last Updated:** November 8, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready
