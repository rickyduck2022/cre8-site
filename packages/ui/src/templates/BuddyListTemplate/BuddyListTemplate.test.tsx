import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuddyListTemplate } from "./BuddyListTemplate";

afterEach(cleanup);

describe("BuddyListTemplate profile pictures", () => {
  it("distinguishes global discovery from saved-contact search and opens chat from a saved lookup result", () => {
    const onOpenChat = vi.fn();
    const onMemberSearchQueryChange = vi.fn();
    const onQueryChange = vi.fn();
    render(<BuddyListTemplate
      buddies={[{ id: "saved-amber", username: "amber", displayName: "Amber", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }]}
      memberSearchQuery="amber"
      memberSearchResults={[{ id: "account-amber", username: "amber", displayName: "Amber", genre: "Jungle" }]}
      onMemberSearchQueryChange={onMemberSearchQueryChange}
      onQueryChange={onQueryChange}
      onAddFriend={vi.fn()} onOpenChat={onOpenChat} onRemoveFriend={vi.fn()} onSelectProfile={vi.fn()}
    />);
    const lookup = screen.getByRole("region", { name: "Find artists" });
    expect(within(lookup).getByRole("heading", { name: "Find artists" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Search friends" })).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find artists by username or ID" }), { target: { value: "ben" } });
    expect(onMemberSearchQueryChange).toHaveBeenCalledWith("ben");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search friends" }), { target: { value: "Jungle" } });
    expect(onQueryChange).toHaveBeenCalledWith("Jungle");
    fireEvent.click(within(lookup).getByRole("button", { name: "Message Amber" }));
    expect(onOpenChat).toHaveBeenCalledWith("saved-amber");
    fireEvent.click(screen.getByRole("button", { name: "Find artists" }));
    expect(screen.getByRole("searchbox", { name: "Find artists by username or ID" })).toHaveFocus();
  });

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
