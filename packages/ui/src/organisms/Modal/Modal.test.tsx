import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
});
