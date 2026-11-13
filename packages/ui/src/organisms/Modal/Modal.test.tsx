import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallback, useState } from "react";
import { ModalFooter, ModalFooterOutlet } from "../../molecules/ModalFooter/ModalFooter";
import { Modal } from "./Modal";
import { FloatingWindow, WindowLayer, type WindowWorkspace } from "../Window/Window";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("portals non-modal tutorial sheets out of header stacking contexts while preserving control state and Escape", () => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  const close = vi.fn();
  const { rerender } = render(<header style={{ position: "relative", zIndex: 1 }}>
    <Modal isOpen nonModal presentation="modal" title="Tutorial filters" onClose={close}>
      <label>Filter draft<input defaultValue="Keep it" /></label>
    </Modal>
  </header>);
  const sheet = screen.getByRole("dialog", { name: "Tutorial filters" });
  expect(sheet.parentElement).toBe(document.body);
  fireEvent.change(screen.getByRole("textbox", { name: "Filter draft" }), { target: { value: "Edited" } });
  rerender(<header style={{ position: "relative", zIndex: 1 }}>
    <Modal isOpen nonModal presentation="modal" title="Tutorial filters" onClose={close}>
      <label>Filter draft<input defaultValue="Keep it" /></label>
    </Modal>
  </header>);
  expect(screen.getByRole("textbox", { name: "Filter draft" })).toHaveValue("Edited");
  fireEvent.keyDown(sheet, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});

it.each([false, true])("uses grouped feature windows with retained drafts, guarded submissions and modal exceptions (mobile=%s)", async (mobile) => {
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} }));
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const save = vi.fn<(workspace: WindowWorkspace) => void>();
  const close = vi.fn();
  function Page() {
    const [stack, setStack] = useState(["pack:one"]);
    const [open, setOpen] = useState<string[]>([]);
    const activate = useCallback((id: string) => setStack((current) => [...current.filter((item) => item !== id), id]), []);
    const remove = useCallback((id: string) => setStack((current) => current.filter((item) => item !== id)), []);
    return <WindowLayer childrenInPage onWorkspaceChange={save} featureWindows={{ stack, onActivate: activate, onRemove: remove }}>
      <button onClick={() => setOpen((current) => [...current, "Profile"])}>Open profile</button>
      <button onClick={() => setOpen((current) => [...current, "Share"])}>Open share</button>
      <button onClick={() => setOpen((current) => [...current, "Confirm"])}>Open confirmation</button>
      <FloatingWindow windowId="pack:one" title="Pack" kind="sample" active={stack.at(-1) === "pack:one"}
        order={Math.max(0, stack.indexOf("pack:one"))} onActivate={() => activate("pack:one")} onClose={vi.fn()}>Tracks</FloatingWindow>
      {open.map((title) => <Modal key={title} isOpen title={title} onClose={close}
        closeDisabled={title === "Share"} presentation={title === "Confirm" ? "modal" : "feature"}>
        <form id={`${title}-form`}><label>{title} draft<input defaultValue="Keep my draft" /></label></form>
        <ModalFooter><button form={`${title}-form`} type="submit">Save {title}</button></ModalFooter>
      </Modal>)}
    </WindowLayer>;
  }
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
  const profile = screen.getByRole("dialog", { name: "Profile", exact: true });
  expect(profile).toHaveClass("feature-window", "floating-window");
  expect(profile.closest(".window-layer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save Profile" }).closest("footer")).toHaveClass("modal__footer");
  fireEvent.change(screen.getByRole("textbox", { name: "Profile draft" }), { target: { value: "Unsaved details" } });
  fireEvent.click(screen.getByRole("button", { name: "Open share" }));
  const share = screen.getByRole("dialog", { name: "Share", exact: true });
  expect(within(share).getByRole("button", { name: "Close Share", exact: true })).toBeDisabled();
  fireEvent.keyDown(share, { key: "Escape" });
  fireEvent(share, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(close).not.toHaveBeenCalled();
  const switcher = within(share).getByRole("tablist", { name: mobile ? "Open windows" : "Grouped packs" });
  expect(within(switcher).getByRole("tab", { name: "Profile", exact: true })).toHaveClass("window-kind--dialog");
  fireEvent.click(within(switcher).getByRole("tab", { name: "Profile", exact: true }));
  expect(screen.getByRole("textbox", { name: "Profile draft" })).toHaveValue("Unsaved details");
  expect(screen.getByRole("dialog", { name: "Profile", exact: true })).toBe(profile);
  expect(save.mock.calls.at(-1)?.[0].windows.map((entry) => entry.id)).toEqual(["pack:one"]);
  fireEvent.click(screen.getByRole("button", { name: "Open confirmation" }));
  expect(screen.getByRole("dialog", { name: "Confirm", exact: true })).toHaveClass("modal");
  expect(screen.getByRole("dialog", { name: "Confirm", exact: true })).not.toHaveClass("floating-window");
});

describe("ModalFooter", () => {
  it("renders descendant form actions in the shared modal footer", async () => {
    render(
      <ModalFooterOutlet>
        <div className="modal__content">Scrollable modal content</div>
        <ModalFooter>
          <button type="submit">Save changes</button>
        </ModalFooter>
      </ModalFooterOutlet>,
    );

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(saveButton.closest("footer")).toHaveClass("modal__footer"));
  });

  describe("responsive Modal layout", () => {
    it("uses a full-screen dialog and surface on mobile while retaining scrollable content", () => {
      const style = document.createElement("style");
      style.textContent = readFileSync(resolve("src", "organisms", "Organisms.css"), "utf8");
      document.head.append(style);
      try {
        const rules = Array.from(style.sheet?.cssRules ?? []);
        const mobile = rules.find((rule) => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)") as CSSMediaRule;
        const findRule = (selector: string) => {
          const rule = Array.from(mobile.cssRules).find((candidate) => candidate instanceof CSSStyleRule && candidate.selectorText.replace(/\s+/g, " ") === selector);
          if (!(rule instanceof CSSStyleRule)) throw new Error(`Missing mobile modal rule: ${selector}`);
          return rule.style;
        };
        const dialog = findRule(".modal");
        const surface = findRule(".modal .modal__surface");
        expect(dialog.getPropertyValue("height")).toBe("100dvh");
        expect(dialog.getPropertyValue("width")).toBe("100%");
        expect(dialog.getPropertyValue("max-width")).toBe("none");
        expect(dialog.getPropertyValue("margin")).toBe("0");
        expect(surface.getPropertyValue("height")).toBe("100%");
        expect(surface.getPropertyValue("border-radius")).toBe("0");
        expect(surface.getPropertyValue("padding")).toBe("0");
        const chrome = findRule(".modal__header, .modal__footer");
        expect(chrome.getPropertyValue("background")).toBe("var(--surface-canvas)");
        expect(chrome.getPropertyValue("flex")).toBe("none");
        expect(chrome.getPropertyValue("z-index")).toBe("1");
        expect(findRule(".modal__header").getPropertyValue("box-shadow")).toBe("var(--shadow-edge-bottom)");
        expect(findRule(".modal__footer").getPropertyValue("box-shadow")).toBe("var(--shadow-edge-top)");
        expect(findRule(".modal__footer").getPropertyValue("padding")).toContain("safe-area-inset-bottom");
        const content = rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === ".modal__content") as CSSStyleRule;
        expect(content.style.getPropertyValue("overflow-y")).toBe("auto");
      } finally {
        style.remove();
      }
    });
  });
});
