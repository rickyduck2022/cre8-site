import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its content and defaults to a primary button", () => {
    render(<Button>Share a dub</Button>);

    const button = screen.getByRole("button", { name: "Share a dub" });
    expect(button).toHaveClass("button--primary", "button--medium");
    expect(button).toHaveAttribute("type", "button");
  });

  it("supports variants, native props, and click handlers", () => {
    const onClick = vi.fn();
    render(
      <Button
        aria-label="Add friend"
        className="custom-button"
        onClick={onClick}
        size="large"
        variant="secondary"
      >
        Add
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Add friend" });
    expect(button).toHaveClass(
      "button--secondary",
      "button--large",
      "custom-button",
    );
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports the disabled state", () => {
    render(<Button disabled>Unavailable</Button>);

    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });
});
