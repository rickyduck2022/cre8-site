import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../../atoms/Button/Button";
import { ModalFooterOutlet } from "../../molecules/ModalFooter/ModalFooter";
import { cn } from "../../utils/cn";
import "../Organisms.css";

/**
 * Mobile dialogs use dark, shadowed header/footer surfaces around scrollable content.
 * Place actions in ModalFooter; submit buttons must reference their form's id.
 * Use closeDisabled for non-cancellable submissions, with guarded onClose handlers.
 */
export interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
}

export function Modal({
  children,
  className,
  isOpen,
  onClose,
  title,
  closeDisabled = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  function requestClose() {
    if (!closeDisabled) onClose();
  }

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
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onClose={requestClose}
      ref={dialogRef}
    >
      <div className="modal__surface">
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <Button disabled={closeDisabled} onClick={requestClose} size="small" variant="tertiary">
            Close
          </Button>
        </header>
        <ModalFooterOutlet>
          <div className="modal__content">
            {closeDisabled && <p role="status">Please wait for the current action to finish before closing.</p>}
            {children}
          </div>
        </ModalFooterOutlet>
      </div>
    </dialog>
  );
}
