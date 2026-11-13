import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";
afterEach(cleanup);

describe("AccountMenu", () => {
  it("opens Help and tutorials and closes the account menu", () => {
    const onHelp = vi.fn();
    render(<AccountMenu userName="Meladee" onEditProfile={vi.fn()} onLogout={vi.fn()} onHelp={onHelp} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu for Meladee" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Help & tutorials" }));
    expect(onHelp).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("toggles account actions on click, ignores hover and invokes the selected action", () => {
    const onEditProfile = vi.fn();
    const onLogout = vi.fn();
    render(
      <AccountMenu
        onEditProfile={onEditProfile}
        onLogout={onLogout}
        userName="Meladee"
        userAvatarUrl="/meladee.png"
      />,
    );

    expect(screen.getByRole("img", { name: "Meladee" }).querySelector("img")).toHaveAttribute("src", "/meladee.png");
    const trigger = screen.getByRole("button", { name: "Account menu for Meladee" });
    fireEvent.mouseEnter(trigger.parentElement!);
    fireEvent.focus(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.getByRole("menu")).toBeVisible();
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit profile" }));
    expect(onEditProfile).toHaveBeenCalledOnce();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("opens with keyboard navigation and closes on Escape or outside interaction", () => {
    render(<AccountMenu userName="Meladee" onEditProfile={vi.fn()} onLogout={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Account menu for Meladee" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Edit profile" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
