import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtistRegistrationForm } from "./ArtistRegistrationForm";

afterEach(cleanup);

describe("ArtistRegistrationForm", () => {
  it("keeps registration focused on the artist name and password", () => {
    const onSubmit = vi.fn();
    const { container } = render(<ArtistRegistrationForm onSubmit={onSubmit} onSwitchToSignIn={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Artist" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Username" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Artist"), { target: { value: "Amber" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-enough-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "long-enough-password" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalledWith({ displayName: "Amber", password: "long-enough-password" });
  });
});
