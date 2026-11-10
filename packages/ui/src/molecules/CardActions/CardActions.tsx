import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreActions } from "@craft/icons";
import { Button, type ButtonProps } from "../../atoms/Button/Button";
import { Modal } from "../../organisms/Modal/Modal";
import { useMobileLayout } from "../../utils/useMobileLayout";
import "./CardActions.css";

export function CardActions({ title, children, className = "" }: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const mobile = useMobileLayout();
  const actions = Children.toArray(children);
  const row = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [visibleCount, setVisibleCount] = useState(actions.length);
  const [open, setOpen] = useState(false);
  const count = mobile ? Math.min(visibleCount, actions.length) : actions.length;
  const overflowing = count < actions.length;

  useLayoutEffect(() => {
    if (wasOpen.current && !open && overflowing) trigger.current?.focus();
    wasOpen.current = open;
  }, [open, overflowing]);

  useEffect(() => {
    if (!mobile || !overflowing) setOpen(false);
  }, [mobile, overflowing]);

  useLayoutEffect(() => {
    const element = row.current;
    if (!mobile || !element) return;
    function measure() {
      if (!element) return;
      const available = element.getBoundingClientRect().width;
      if (!available) return;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      const widths = Array.from(element.querySelectorAll<HTMLElement>(":scope > .card-actions__item"))
        .map((item) => item.firstElementChild?.getBoundingClientRect().width ?? 0);
      const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }
      let used = trigger.current?.getBoundingClientRect().width ?? 0;
      let fit = 0;
      for (const width of widths) {
        if (used + gap + width > available) break;
        used += gap + width;
        fit++;
      }
      setVisibleCount(fit);
    }
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const item of element.querySelectorAll(":scope > .card-actions__item > *")) observer.observe(item);
    return () => observer.disconnect();
  }, [mobile, actions.length]);

  return <div className={`card-actions ${className}`} ref={row}>
    {actions.map((action, index) => <span key={index}
      className={`card-actions__item${index === actions.length - 1 ? " card-actions__item--last" : ""}${index >= count ? " card-actions__item--overflow" : ""}`}
      aria-hidden={index >= count || undefined} inert={index >= count || undefined}>
      {action}
    </span>)}
    <span className={`card-actions__more${!overflowing ? " card-actions__more--hidden" : ""}`}
      aria-hidden={!overflowing || undefined} inert={!overflowing || undefined}>
      <Button ref={trigger} size="small" variant="secondary" leadingIcon={<MoreActions />}
        aria-label={`More actions for ${title}`} aria-haspopup="dialog" aria-expanded={open && overflowing}
        onClick={() => setOpen(true)} />
    </span>
    {mobile && overflowing && open && <Modal isOpen title={`More actions for ${title}`}
      className="card-actions__dialog" onClose={() => setOpen(false)}>
      <div className="card-actions__menu" onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button:not(:disabled)")) setOpen(false);
      }}>{actions.slice(count).map((action) => {
        if (isValidElement<ButtonProps>(action) && action.type === Button
          && (action.props.children === undefined || action.props.children === null || action.props.children === false)) {
          return cloneElement(action, { children: action.props["aria-label"] });
        }
        return action;
      })}</div>
    </Modal>}
  </div>;
}
