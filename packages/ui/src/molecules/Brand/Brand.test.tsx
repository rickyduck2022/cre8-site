import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Brand } from "./Brand";

afterEach(cleanup);

describe("Brand", () => {
  it("links to the home section by default", () => {
    render(<Brand />);

    expect(screen.getByRole("link", { name: "cre8 home" })).toHaveAttribute(
      "href",
      "#dubs",
    );
  });

  it("supports a custom destination", () => {
    render(<Brand href="/#dubs" />);

    expect(screen.getByRole("link", { name: "cre8 home" })).toHaveAttribute(
      "href",
      "/#dubs",
    );
  });

  it("adds an optional vault descriptor without replacing the cre8 mark or changing its home link", () => {
    const { rerender } = render(<Brand descriptor="Dub Vault" logoSrc="/cre8.svg" />);
    expect(screen.getByRole("link", { name: "cre8 home" })).toHaveAttribute("href", "#dubs");
    expect(screen.getByRole("img", { name: "Cre8 DnB silhouette mark" })).toHaveAttribute("src", "/cre8.svg");
    expect(screen.getByText("Dub Vault")).toBeVisible();
    expect(screen.getByText("Dub Vault").closest(".vault-label")?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<Brand />);
    expect(screen.queryByText("Dub Vault")).not.toBeInTheDocument();
    expect(screen.getByText("cre8")).toBeVisible();
  });
});
