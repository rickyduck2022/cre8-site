import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("exposes accessible progress and clamps values to its range", () => {
    render(<ProgressBar label="Uploading audio" value={140} />);

    expect(screen.getByRole("progressbar", { name: "Uploading audio" }))
      .toHaveAttribute("aria-valuenow", "100");
  });
});
