import { useEffect, useId, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Brand } from "../../molecules/Brand/Brand";
import type { MediaKind } from "../../types/domain";
import "../../foundations/MediaPalette.css";
import "../Organisms.css";
import "./Navigation.css";

export interface NavigationItem {
  label: string;
  displayLabel?: string;
  icon: ReactNode;
  href?: string;
  badge?: string;
  variant?: "alist" | "private";
  mediaKind?: MediaKind;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface NavigationSection {
  label?: string;
  mediaKind?: MediaKind;
  icon?: ReactNode;
  items: NavigationItem[];
  footer?: ReactNode;
}

export interface NavigationProps {
  sections: NavigationSection[];
  activeItem?: string;
  userName?: string;
  userAvatarUrl?: string;
  userDetail?: string;
  variant?: "sidebar" | "horizontal" | "icons";
  hideOnMobile?: boolean;
  className?: string;
  logoSrc?: string;
  brandDescriptor?: string;
  onUserProfile?: () => void;
}

export function Navigation({
  activeItem,
  className,
  sections,
  logoSrc,
  brandDescriptor,
  userDetail = "Member",
  userName,
  userAvatarUrl,
  onUserProfile,
  variant = "sidebar",
  hideOnMobile = false,
}: NavigationProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={[
        "organism-card",
        "navigation",
        `navigation--${variant}`,
        hideOnMobile && "navigation--hide-mobile",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="navigation__brand vault-rack">
        <Brand logoSrc={logoSrc} descriptor={brandDescriptor} />
      </div>
      <div className="navigation__sections">
        {sections.map((section, sectionIndex) => (
          <NavigationSectionView
            activeItem={activeItem}
            key={section.label ?? sectionIndex}
            section={section}
            variant={variant}
          />
        ))}
      </div>
      {userName && (
        <div className="navigation__footer">
          <div className="member-identity">
            {onUserProfile ? <button aria-label={`View ${userName}'s profile`} className="navigation__profile-avatar" onClick={onUserProfile} type="button"><Avatar name={userName} size="small" src={userAvatarUrl} /></button> : <Avatar name={userName} size="small" src={userAvatarUrl} />}
            <span className="member-identity__copy">
              {onUserProfile ? <button className="text-button member-identity__name navigation__profile-name" onClick={onUserProfile} type="button">{userName}</button> : <span className="member-identity__name">{userName}</span>}
              <span className="member-identity__detail">{userDetail}</span>
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}

interface NavigationSectionViewProps {
  section: NavigationSection;
  activeItem?: string;
  variant: NonNullable<NavigationProps["variant"]>;
}

function NavigationSectionView({
  activeItem,
  section,
  variant,
}: NavigationSectionViewProps) {
  const isActive = section.items.some((item) => item.label === activeItem);
  const [expanded, setExpanded] = useState(isActive);
  const itemsId = useId();
  useEffect(() => { if (isActive) setExpanded(true); }, [isActive]);
  const collapsible = Boolean(section.mediaKind && section.label);
  return (
    <div className="navigation__section">
      {collapsible ? (
        <Button className={`navigation__section-toggle media-kind--${section.mediaKind}`} variant="audio"
          leadingIcon={section.icon} aria-label={`${section.label} menu`} aria-expanded={expanded} aria-controls={itemsId} onClick={() => setExpanded((value) => !value)}>
          <span>{section.label}</span><ChevronDown aria-hidden="true" className="navigation__section-chevron" />
        </Button>
      ) : section.label && (
        <div className="navigation__section-label">{section.label}</div>
      )}
      <div className={`navigation__items${collapsible ? " navigation__items--nested" : ""}`} id={itemsId} hidden={collapsible && !expanded}>
        {section.items.map((item) => (
          <a
            aria-current={activeItem === item.label ? "page" : undefined}
            aria-label={variant === "icons" || item.displayLabel ? item.label : undefined}
            className={["navigation__item", item.variant && `navigation__item--${item.variant}`, item.mediaKind && `media-kind--${item.mediaKind}`].filter(Boolean).join(" ")}
            href={item.href ?? "#"}
            key={item.label}
            onClick={item.onClick}
            title={variant === "icons" ? item.label : undefined}
          >
            <span aria-hidden="true" className="navigation__icon">
              {item.icon}
            </span>
            <span className="navigation__label">{item.displayLabel ?? item.label}</span>
            {item.badge && (
              <span className="navigation__badge">{item.badge}</span>
            )}
          </a>
        ))}
      </div>
      {section.footer && (
        <div className="navigation__section-footer">{section.footer}</div>
      )}
    </div>
  );
}
