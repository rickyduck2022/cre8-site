import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

describe("AccountMenu", () => {
  it("shows account actions on hover and invokes the selected action", () => {
    const onEditProfile = vi.fn();
    const onLogout = vi.fn();
    render(
      <AccountMenu
        onEditProfile={onEditProfile}
        onLogout={onLogout}
        userName="Meladee"
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Account menu for Meladee" }).parentElement!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    expect(onEditProfile).toHaveBeenCalledOnce();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Account menu for Meladee" }).parentElement!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
