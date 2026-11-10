import { useEffect, useId, useRef, useState } from "react";
import { MoreActions } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { DubManagementActions } from "../DubManagementActions/DubManagementActions";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { Modal } from "../../organisms/Modal/Modal";
import "./DubActionsMenu.css";

export interface DubActionsMenuProps {
  title: string;
  onEdit: () => void;
  onDelete: () => void;
  iconOnly?: boolean;
}

export function DubActionsMenu({ title, onEdit, onDelete, iconOnly = false }: DubActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const actionsId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  const mobile = useMobileLayout();

  useEffect(() => {
    if (!isOpen || mobile) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        actionsRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, mobile]);

  const actions = (
    <DubManagementActions
      onDelete={() => {
        setIsOpen(false);
        onDelete();
      }}
      onEdit={() => {
        setIsOpen(false);
        onEdit();
      }}
      showIcons
      title={title}
    />
  );

  return (
    <div
      className="dub-actions-menu"
      onBlur={(event) => {
        if (!mobile && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      ref={actionsRef}
    >
      <Button
        aria-controls={isOpen && !mobile ? actionsId : undefined}
        aria-expanded={isOpen}
        aria-haspopup={mobile ? "dialog" : undefined}
        aria-label={`Actions for ${title}`}
        className={iconOnly ? "dub-actions-menu__trigger--icon-only" : undefined}
        leadingIcon={<MoreActions />}
        onClick={() => setIsOpen((open) => !open)}
        size="small"
        variant="secondary"
      >
        {!iconOnly && "Actions"}
      </Button>
      {isOpen && (mobile ? (
        <Modal className="dub-actions-menu__dialog" isOpen onClose={() => setIsOpen(false)} title={`Actions for ${title}`}>
          {actions}
        </Modal>
      ) : (
        <div className="dub-actions-menu__popover" id={actionsId}>
          {actions}
        </div>
      ))}
    </div>
  );
}
