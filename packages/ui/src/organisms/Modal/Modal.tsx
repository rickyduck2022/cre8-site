import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../../atoms/Button/Button";
import { ModalFooterOutlet } from "../../molecules/ModalFooter/ModalFooter";
import { cn } from "../../utils/cn";
import "../Organisms.css";

export interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({
  children,
  className,
  isOpen,
  onClose,
  title,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={cn("modal", className)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="modal__surface">
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <Button onClick={onClose} size="small" variant="tertiary">
            Close
          </Button>
        </header>
        <ModalFooterOutlet>
          <div className="modal__content">{children}</div>
        </ModalFooterOutlet>
      </div>
    </dialog>
  );
}
