import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ArtistCard } from "./ArtistCard";

afterEach(cleanup);

it("opens the artist profile from the image and name without invoking the action", () => {
  const open = vi.fn();
  const action = vi.fn();
  render(<ArtistCard name="Amber" username="amber" avatarUrl="/avatar.png" aListApproved onOpenProfile={open} action={<button onClick={action}>Revoke</button>} />);
  fireEvent.click(screen.getByRole("button", { name: "View Amber's profile" }));
  fireEvent.click(screen.getByRole("button", { name: /Amber A-List approved/ }));
  expect(open).toHaveBeenNthCalledWith(1, "amber");
  expect(open).toHaveBeenNthCalledWith(2, "amber");
  fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
  expect(action).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledTimes(2);
});
