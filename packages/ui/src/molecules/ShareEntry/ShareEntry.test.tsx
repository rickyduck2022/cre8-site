import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareEntry } from "./ShareEntry";

afterEach(cleanup);

describe("ShareEntry", () => {
  it("keeps its share action accessible and uses the mobile upload icon", () => {
    const onSubmit = vi.fn();
    render(<ShareEntry name="Amber" onSubmit={onSubmit} />);
    const button = screen.getByRole("button", { name: "Share a dub" });
    expect(button).toHaveClass("button--hide-label-mobile");
    expect(button.querySelector(".share-dub-icon__mobile svg")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Share something with your friends/ }), { target: { value: "Hello" } });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith("Hello");
  });
});
