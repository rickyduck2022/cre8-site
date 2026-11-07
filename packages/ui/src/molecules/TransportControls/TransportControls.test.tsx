import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransportControls } from "./TransportControls";

describe("TransportControls", () => {
  it("keeps the play button icon as its only flex item", () => {
    render(<TransportControls />);

    const playButton = screen.getByRole("button", { name: "Play" });
    expect(playButton.children).toHaveLength(1);
    expect(playButton.firstElementChild).toHaveClass("button__icon");
  });
});
