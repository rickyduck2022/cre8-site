import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ModalFooter.css";

const ModalFooterContext = createContext<HTMLElement | null>(null);

export function ModalFooterOutlet({ children }: { children: ReactNode }) {
  const [footerElement, setFooterElement] = useState<HTMLElement | null>(null);

  return (
    <ModalFooterContext.Provider value={footerElement}>
      {children}
      <footer className="modal__footer" ref={setFooterElement} />
    </ModalFooterContext.Provider>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  const target = useContext(ModalFooterContext);
  const content = (
    <div className={["modal__footer-content", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );

  return target ? createPortal(content, target) : content;
}
