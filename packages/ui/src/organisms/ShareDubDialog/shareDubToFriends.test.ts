import { describe, expect, it, vi } from "vitest";
import { shareDubToFriends } from "./shareDubToFriends";

describe("shareDubToFriends", () => {
  it("sends once per friend in order and reports individual outcomes", async () => {
    const send = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const result = await shareDubToFriends(["one", "two", "one"], "dub", "Listen", send);
    expect(send.mock.calls).toEqual([["one", "Listen", "dub"], ["two", "Listen", "dub"]]);
    expect(result).toEqual({ sent: ["one"], failed: ["two"] });
  });

  it("does not send anything when no friends are selected", async () => {
    const send = vi.fn();
    expect(await shareDubToFriends([], "dub", "Listen", send)).toEqual({ sent: [], failed: [] });
    expect(send).not.toHaveBeenCalled();
  });
});
