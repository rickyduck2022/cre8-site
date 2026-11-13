import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TutorialStep } from "@craft/ui";
import "./TutorialFocus.css";

export function TutorialFocus({ step, onUnavailableSpace }: { step: TutorialStep | null; onUnavailableSpace?: () => void }) {
  const [focus, setFocus] = useState<{ mask: string; outlines: Array<{ left: number; top: number; width: number; height: number }> }>({ mask: "", outlines: [] });
  useLayoutEffect(() => {
    if (!step) { setFocus({ mask: "", outlines: [] }); return; }
    let frame = 0;
    let revealedNavigation: Element | null = null;
    let revealedResult: Element | null = null;
    const observed = new Set<Element>();
    const activityStacks = new Map<HTMLElement, boolean>();
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    function visibleBounds(element: Element) {
      if (element.matches(':disabled, [aria-disabled="true"]') || element.closest('[hidden], [aria-hidden="true"]')) return null;
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") return null;
        if (parent instanceof HTMLElement && (parent.inert || parent.hasAttribute("inert")) && activityStacks.get(parent) !== false) return null;
      }
      const bounds = element.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return null;
      let { left, top, right, bottom } = bounds;
      for (let parent = getComputedStyle(element).position === "fixed" ? null : element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const clipX = /auto|scroll|hidden|clip/.test(style.overflowX || style.overflow);
        const clipY = /auto|scroll|hidden|clip/.test(style.overflowY || style.overflow);
        if (clipX || clipY) {
          const clip = parent.getBoundingClientRect();
          if (clipX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
          if (clipY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
        }
        if (style.position === "fixed") break;
      }
      left = Math.max(0, left); top = Math.max(0, top);
      right = Math.min(window.innerWidth, right); bottom = Math.min(window.innerHeight, bottom);
      return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
    }
    function prominence(element: Element) {
      const panel = element.closest(".floating-window, dialog[open], [role='dialog']");
      if (panel) return (panel.matches(".floating-window--active, dialog[open]") ? 400 : 300) + (element.matches('button[type="submit"]') ? 20 : 0);
      if (element.matches(".navigation__section-toggle, .mobile-navigation > button:last-child")) return 0;
      if (element.closest(".navigation, .mobile-navigation")) return 100;
      return 200;
    }
    function measure() {
      frame = 0;
      const matches = Array.from(new Set((step?.focusTargets ?? []).flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
      const navigationTarget = matches.find((element) => {
        const panel = element.closest("dialog[open]");
        return element.matches(".navigation__item") && element.getBoundingClientRect().width > 0 && panel && visibleBounds(panel);
      });
      if (navigationTarget && navigationTarget !== revealedNavigation) {
        const bounds = navigationTarget.getBoundingClientRect();
        const visible = visibleBounds(navigationTarget);
        if (!visible || visible.width < bounds.width || visible.height < bounds.height) {
          navigationTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" });
          revealedNavigation = navigationTarget;
          schedule();
        }
      } else if (!navigationTarget) revealedNavigation = null;
      const candidates = matches.filter((element) =>
          visibleBounds(element) && (!step?.focusSubject || !element.hasAttribute("data-tutorial-subject") || element.getAttribute("data-tutorial-subject")?.split(" ").includes(step.focusSubject)))
          .sort((a, b) => prominence(b) - prominence(a));
      const activePanel = candidates[0]?.closest(".floating-window, dialog[open], [role='dialog']");
      const contextual = activePanel ? candidates.filter((element) => activePanel.contains(element)) : candidates;
      const unique = new Set<string>();
      const targets = step?.focusStrategy === "single" ? contextual.slice(0, 1) : contextual.filter((element) => {
        const label = element.getAttribute("aria-label") || element.textContent?.trim();
        if (!label || element.matches("input, select, textarea")) return true;
        const key = `${element.tagName}:${element.getAttribute("role") ?? ""}:${label}`;
        if (unique.has(key)) return false;
        unique.add(key); return true;
      });
      const resultMatches = Array.from(new Set((step?.resultTargets ?? []).flatMap((selector) => Array.from(document.querySelectorAll(selector)))))
        .filter((element) => {
          const subject = element.closest("[data-tutorial-subject]") ?? element.querySelector("[data-tutorial-subject]");
          return !step?.resultSubject || !subject || subject.getAttribute("data-tutorial-subject")?.split(" ").includes(step.resultSubject);
        });
      if (!revealedResult) revealedResult = resultMatches.find((element) => visibleBounds(element)) ?? null;
      if (!revealedResult && !resultMatches.some((element) => visibleBounds(element))) {
        for (const element of resultMatches) {
          const viewport = element.closest<HTMLElement>(".scroll-viewport, .modal__content, .feature-window__body");
          const bounds = element.getBoundingClientRect();
          if (!viewport || !visibleBounds(viewport) || bounds.width <= 0 || bounds.height <= 0 || viewport.scrollHeight <= viewport.clientHeight) continue;
          const clip = viewport.getBoundingClientRect();
          viewport.scrollTop += bounds.top < clip.top || bounds.height > clip.height
            ? bounds.top - clip.top : Math.max(0, bounds.bottom - clip.bottom);
          revealedResult = element;
          schedule();
          break;
        }
      }
      const results = resultMatches.filter((element) => visibleBounds(element));
      const related = [...targets, ...results];
      for (const stack of document.querySelectorAll<HTMLElement>(".workspace-activity-stack, .floating-window")) {
        if (!activityStacks.has(stack)) activityStacks.set(stack, Boolean(stack.inert));
        const inert = activityStacks.get(stack) || !related.some((target) => stack.contains(target));
        if (stack.inert !== inert) stack.inert = inert;
      }
      const guide = document.querySelector<HTMLElement>(".tutorial-guide:not(.tutorial-guide--collapsed)");
      const containers = targets.map((target) => target.closest(
        ".navigation__section, .mobile-navigation, .vault-view-switch, .pack-tabs, .dub-search__query, .dub-search__panel-heading, .dub-search__tags, .dub-search__select, .dub-search__panel, .dub-search__dialog, .modal__header, .modal__footer, .floating-window__header, .upload-choices, .dub-upload-form, .pack-editor, .share-dub-dialog, .pack-share, .friend-lookup, .suggestion-card, .chat-compose, .conversation-link, .dub-card, .dub-pack-card, .audio-player, .floating-window, .window-layer__minimized-group, .modal, dialog[open], form, [role='group'], fieldset",
      ) ?? target);
      const focusedElements = new Set<Element>([...related, ...containers]);
      const currentTargets = new Set<Element>([...focusedElements, ...(guide ? [guide] : [])]);
      const chrome = Array.from(document.querySelectorAll(".workspace-explorer:not(.workspace-explorer--maximized), .workspace-explorer--maximized .workspace-explorer__header button, .window-layer__dock, .audio-player.app-player, .mobile-navigation, dialog[open] .modal__header button, .floating-window[open] .floating-window__header button"));
      if (guide && ["absolute", "fixed"].includes(getComputedStyle(guide).position)) {
        guide.removeAttribute("data-tutorial-compact");
        const bounds = guide.getBoundingClientRect();
        const gap = 12;
        const obstacles = [...focusedElements, ...chrome].flatMap((element) => {
          const box = visibleBounds(element);
          return box ? [box] : [];
        });
        const navigation = document.querySelector(".mobile-navigation");
        const navigationBounds = navigation && visibleBounds(navigation);
        const bottom = navigationBounds ? navigationBounds.top - gap : window.innerHeight - gap;
        const fits = (x: number, y: number, width: number, height: number) => x >= gap && y >= gap
          && x + width <= window.innerWidth - gap && y + height <= bottom
          && obstacles.every((box) => x + width + gap <= box.left || x >= box.left + box.width + gap
            || y + height + gap <= box.top || y >= box.top + box.height + gap);
        function position(width: number, height: number) {
          const right = window.innerWidth - gap - width;
          const base = bottom - height;
          const xs = [right, gap, ...obstacles.flatMap((box) => [box.left - width - gap, box.left + box.width + gap])];
          const ys = [base, gap, ...obstacles.flatMap((box) => [box.top - height - gap, box.top + box.height + gap])];
          return xs.flatMap((x) => ys.map((y) => ({ x, y })))
            .filter(({ x, y }) => fits(x, y, width, height))
            .sort((a, b) => Math.hypot(right - a.x, base - a.y) - Math.hypot(right - b.x, base - b.y))[0];
        }
        let placement = position(bounds.width, bounds.height);
        if (!placement) {
          guide.dataset.tutorialCompact = "true";
          const compact = guide.getBoundingClientRect();
          placement = position(compact.width, compact.height);
          if (!placement) {
            guide.dataset.tutorialCompact = "icon";
            placement = position(44, 44);
          }
        }
        if (!placement && onUnavailableSpace) { onUnavailableSpace(); return; }
        if (placement) {
          guide.dataset.tutorialPositioned = "true";
          guide.style.setProperty("--tutorial-left", `${placement.x}px`);
          guide.style.setProperty("--tutorial-top", `${placement.y}px`);
        }
      }
      const watched = new Set([...currentTargets, ...chrome]);
      for (const element of observed) {
        if (!watched.has(element)) { resize?.unobserve(element); observed.delete(element); }
      }
      for (const element of watched) {
        if (!observed.has(element)) { resize?.observe(element); observed.add(element); }
      }
      const holes: string[] = [];
      const outlines: typeof focus.outlines = [];
      for (const element of currentTargets) {
        const bounds = visibleBounds(element);
        if (!bounds) continue;
        const { left, top, width, height } = bounds;
        holes.push(`<rect x="${left - 4}" y="${top - 4}" width="${width + 8}" height="${height + 8}" rx="8" fill="black"/>`);
        if (related.includes(element) && !results.some((result) => result !== element && result.contains(element))) {
          outlines.push({ left: left - 4, top: top - 4, width: width + 8, height: height + 8 });
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${window.innerWidth}" height="${window.innerHeight}"><defs><mask id="focus"><rect width="100%" height="100%" fill="white"/>${holes.join("")}</mask></defs><rect width="100%" height="100%" fill="white" mask="url(#focus)"/></svg>`;
      setFocus({ mask: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, outlines });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => !(record.target instanceof Element)
        || !record.target.matches(".tutorial-guide, .tutorial-focus, .tutorial-focus-outline, .tutorial-focus-outlines"))) schedule();
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "open", "hidden", "disabled", "inert", "aria-hidden", "aria-disabled", "aria-expanded"] });
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("pointermove", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect(); mutations.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", schedule);
      const guide = document.querySelector<HTMLElement>(".tutorial-guide");
      guide?.removeAttribute("data-tutorial-compact");
      guide?.removeAttribute("data-tutorial-positioned");
      for (const property of ["--tutorial-left", "--tutorial-top"]) guide?.style.removeProperty(property);
      for (const [stack, inert] of activityStacks) stack.inert = inert;
    };
  }, [step, onUnavailableSpace]);
  return step && focus.mask ? createPortal(<>
    <div className="tutorial-focus" aria-hidden="true" style={{ maskImage: focus.mask }} />
    <div className="tutorial-focus-outlines" aria-hidden="true">
      {focus.outlines.map((bounds, index) => <span className="tutorial-focus-outline" key={index} style={bounds} />)}
    </div>
  </>, document.body) : null;
}
