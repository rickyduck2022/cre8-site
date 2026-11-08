import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuddyListTemplate } from "./BuddyListTemplate";

afterEach(cleanup);

describe("BuddyListTemplate profile pictures", () => {
  it("shows pictures for friends and suggestions, with initials when absent", () => {
    const onSelectProfile = vi.fn();
    render(<BuddyListTemplate
      buddies={[
        { id: "a", username: "amber", displayName: "Amber", avatarUrl: "/amber.png", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
        { id: "b", username: "ben", displayName: "Ben", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [] },
      ]}
      suggestedMembers={[{ username: "chris", displayName: "Chris", genre: "Jungle", avatarUrl: "/chris.png" }]}
      onAddFriend={vi.fn()}
      onOpenChat={vi.fn()}
      onRemoveFriend={vi.fn()}
      onSelectProfile={onSelectProfile}
    />);
    expect(screen.getByRole("img", { name: "Amber" }).querySelector("img")).toHaveAttribute("src", "/amber.png");
    expect(screen.getByRole("img", { name: "Chris" }).querySelector("img")).toHaveAttribute("src", "/chris.png");
    expect(screen.getByRole("img", { name: "Ben" })).toHaveTextContent("B");
    fireEvent.click(screen.getByRole("button", { name: "View Chris's profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Chris @chris · Jungle" }));
    expect(onSelectProfile).toHaveBeenCalledTimes(2);
    expect(onSelectProfile).toHaveBeenCalledWith("chris");
  });
});
