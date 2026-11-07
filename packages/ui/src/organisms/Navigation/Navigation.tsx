import type { ReactNode } from "react";
import { Avatar } from "../../atoms/Avatar/Avatar";
import { Brand } from "../../molecules/Brand/Brand";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import "../Organisms.css";

export interface NavigationItem {
  label: string;
  icon: ReactNode;
  href?: string;
  badge?: string;
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
  footer?: ReactNode;
}

export interface NavigationProps {
  sections: NavigationSection[];
  activeItem?: string;
  userName?: string;
  userDetail?: string;
  variant?: "sidebar" | "horizontal" | "icons";
  hideOnMobile?: boolean;
  className?: string;
}

export function Navigation({
  activeItem,
  className,
  sections,
  userDetail = "Member",
  userName,
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
      <div className="navigation__brand">
        <Brand />
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
            <Avatar name={userName} size="small" />
            <span className="member-identity__copy">
              <span className="member-identity__name">{userName}</span>
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
  const resetKey = section.items.map((item) => item.label).join("\u0000");
  const pagination = usePagination(section.items, resetKey);

  return (
    <div className="navigation__section">
      {section.label && (
        <div className="navigation__section-label">{section.label}</div>
      )}
      <div className="navigation__items">
        {pagination.items.map((item) => (
          <a
            aria-current={activeItem === item.label ? "page" : undefined}
            aria-label={variant === "icons" ? item.label : undefined}
            className="navigation__item"
            href={item.href ?? "#"}
            key={item.label}
            title={variant === "icons" ? item.label : undefined}
          >
            <span aria-hidden="true" className="navigation__icon">
              {item.icon}
            </span>
            <span className="navigation__label">{item.label}</span>
            {item.badge && (
              <span className="navigation__badge">{item.badge}</span>
            )}
          </a>
        ))}
      </div>
      <Pagination
        className="pagination--compact"
        itemCount={section.items.length}
        label={section.label ?? "Navigation"}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />
      {section.footer && (
        <div className="navigation__section-footer">{section.footer}</div>
      )}
    </div>
  );
}
