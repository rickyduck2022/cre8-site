import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Navigation } from "./Navigation";

afterEach(cleanup);

describe("Navigation", () => {
  it("shows every navigation link without a pagination control", () => {
    const items = ["Dub Feed", "Friend List", "Messenger", "My Profile", "My Library", "My Dubs"]
      .map((label) => ({ label, icon: <span aria-hidden="true" />, href: `#${label}` }));
    render(<Navigation sections={[{ label: "Your space", items }]} />);

    for (const item of items) expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/page \d+ of \d+/i)).not.toBeInTheDocument();
  });
});
