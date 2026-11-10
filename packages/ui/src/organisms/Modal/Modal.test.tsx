import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ModalFooter, ModalFooterOutlet } from "../../molecules/ModalFooter/ModalFooter";

afterEach(cleanup);

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
