import { useState, type MouseEvent } from "react";
import { Ellipsis } from "@craft/icons";
import { Modal } from "../Modal/Modal";
import { Navigation, type NavigationItem, type NavigationSection } from "../Navigation/Navigation";
import "./MobileNavigation.css";

export interface MobileNavigationProps {
  sections: NavigationSection[];
  activeItem: string;
  primaryHrefs: string[];
}

export function MobileNavigation({ sections, activeItem, primaryHrefs }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const items = sections.flatMap((section) => section.items);
  const primary = primaryHrefs.map((href) => items.find((item) => item.href === href)).filter((item): item is NavigationItem => Boolean(item));
  const moreActive = !primary.some((item) => item.label === activeItem);
  const menuSections = sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => { item.onClick?.(event); setOpen(false); },
    })),
  }));
  return (
    <>
      <nav className="mobile-tabs mobile-navigation" aria-label="Main sections">
        {primary.map((item) => (
          <a aria-current={activeItem === item.label ? "page" : undefined}
            className={["mobile-navigation__item", item.variant && `mobile-navigation__item--${item.variant}`, item.mediaKind && `media-kind--${item.mediaKind}`].filter(Boolean).join(" ")}
            href={item.href ?? "#"} key={item.label} onClick={item.onClick}>
            <span className="mobile-navigation__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && <span className="mobile-navigation__count" aria-label={`${item.badge} ${item.label}`}>{item.badge}</span>}
          </a>
        ))}
        <button aria-haspopup="dialog" aria-expanded={open} aria-current={moreActive ? "page" : undefined}
          className="mobile-navigation__item" onClick={() => setOpen(true)} type="button">
          <span className="mobile-navigation__icon"><Ellipsis aria-hidden="true" /></span>
          <span>More</span>
        </button>
      </nav>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Navigation" className="mobile-navigation__dialog">
        <Navigation sections={menuSections} activeItem={activeItem} variant="horizontal" className="mobile-navigation__menu" />
      </Modal>
    </>
  );
}
