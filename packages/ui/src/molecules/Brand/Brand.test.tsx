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
});
