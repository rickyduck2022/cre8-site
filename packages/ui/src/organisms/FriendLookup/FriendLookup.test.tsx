import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FriendLookup } from "./FriendLookup";

afterEach(cleanup);

describe("FriendLookup", () => {
  it("shows matching artists and adds the selected account", async () => {
    const onAdd = vi.fn();
    render(<FriendLookup
      query="@amber"
      results={[{ id: "user-1", artistId: "artist-user-1", username: "amber", displayName: "Amber", genre: "Jungle" }]}
      onAdd={onAdd}
      onQueryChange={vi.fn()}
    />);
    expect(screen.getByText("@amber · ID: user-1 · Artist: artist-user-1")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Amber" })).toHaveClass("avatar", "friend-lookup__avatar");
    expect(screen.getByText("@amber · ID: user-1 · Artist: artist-user-1").parentElement).toHaveClass("friend-lookup__result-copy");
    fireEvent.click(screen.getByRole("button", { name: "Add Amber" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1", artistId: "artist-user-1" })));
  });
});
