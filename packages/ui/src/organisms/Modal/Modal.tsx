import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../atoms/Button/Button";
import { ModalFooterOutlet } from "../../molecules/ModalFooter/ModalFooter";
import { cn } from "../../utils/cn";
import { FloatingWindow, useFeatureWindowSystem, type FeatureWindowSystem } from "../Window/Window";
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
  presentation?: "feature" | "modal";
  nonModal?: boolean;
  openRequest?: number;
}

function FeatureDialogWindow({ title, onClose, closeDisabled, className, children, system, openRequest = 1 }: Omit<ModalProps, "isOpen"> & { system: FeatureWindowSystem }) {
  const generatedId = useId();
  const id = `dialog:${generatedId}`;
  const { onActivate, onRemove, stack } = system;
  const remove = useRef(onRemove);
  remove.current = onRemove;
  useEffect(() => { if (!stack.includes(id)) onActivate(id); });
  useEffect(() => () => remove.current(id), [id]);
  if (!stack.includes(id)) return null;
  return <FloatingWindow windowId={id} title={title} kind="dialog" autoGroup persistent={false} openRequest={openRequest}
    className={cn("feature-window", className)} active={stack.at(-1) === id} order={Math.max(0, stack.indexOf(id))}
    onActivate={() => onActivate(id)} onClose={onClose} closeDisabled={closeDisabled}>
    <ModalFooterOutlet>
      <div className="feature-window__body">
      {closeDisabled && <p role="status">Please wait for the current action to finish before closing.</p>}
      {children}
      </div>
    </ModalFooterOutlet>
  </FloatingWindow>;
}

export function Modal(props: ModalProps) {
  const system = useFeatureWindowSystem();
  if (system && props.presentation !== "modal") {
    return props.isOpen ? <FeatureDialogWindow {...props} system={system} /> : null;
  }
  return <BlockingModal key={props.nonModal ? "non-modal" : "modal"} {...props} />;
}

function BlockingModal({
  children,
  className,
  isOpen,
  onClose,
  title,
  closeDisabled = false,
  nonModal = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  function requestClose() {
    if (!closeDisabled) onClose();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) { if (nonModal) dialog.show(); else dialog.showModal(); }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen, nonModal]);

  const content = (
    <dialog
      aria-labelledby={titleId}
      className={cn("modal", nonModal && "modal--non-modal", className)}
      onKeyDown={(event) => {
        if (nonModal && event.key === "Escape") { event.preventDefault(); requestClose(); }
      }}
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
  return nonModal ? createPortal(content, document.body) : content;
}
