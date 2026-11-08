import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./ChatComposer";

afterEach(cleanup);

describe("ChatComposer", () => {
  it("keeps the send action accessible and submits only nonempty messages", () => {
    const submit = vi.fn((event) => event.preventDefault());
    const props = { recipientName: "Amber", onChange: vi.fn(), onSubmit: submit };
    const { rerender } = render(<ChatComposer {...props} value=" " />);
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    expect(send).toHaveClass("button--hide-label-mobile");
    expect(send.querySelector(".button__icon svg")).toBeInTheDocument();
    rerender(<ChatComposer {...props} value="Hello" />);
    fireEvent.click(send);
    expect(submit).toHaveBeenCalledOnce();
  });
});
