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

  it("preserves successful sends and reports rejected recipients without aborting the batch", async () => {
    const error = new Error("Offline");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const send = vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(error).mockResolvedValueOnce(true);
      expect(await shareDubToFriends(["one", "two", "three"], "dub", "Listen", send))
        .toEqual({ sent: ["one", "three"], failed: ["two"] });
      expect(warning).toHaveBeenCalledWith("Unable to share dub with recipient.", error);
    } finally {
      warning.mockRestore();
    }
  });
});
