import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { SharePackDialog, canSharePack } from "./SharePackDialog";
import type { DubPack, Buddy } from "../../types/domain";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);
const pack: DubPack = { id: "pack", title: "Toolkit", description: "", kind: "sample", status: "published",
  distribution: "private", aListPublic: false, licence: "Original works", ownerUsername: "you", ownerDisplayName: "You",
  items: [], totalBytes: 0, createdAt: "2026-11-10", updatedAt: "2026-11-10" };
const buddies: Buddy[] = ["Amber", "Ben"].map((displayName) => ({ id: displayName.toLowerCase(), username: displayName.toLowerCase(),
  displayName, presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] }));

it.each(["dub", "sample"] as const)("requires private %s pack access confirmation and prevents duplicate sends", async (kind) => {
  let finish!: (value: boolean) => void;
  const onSend = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
  render(<SharePackDialog pack={{ ...pack, kind }} buddies={buddies} onClose={vi.fn()} onSend={onSend} initialBuddyIds={["amber"]} />);
  const send = screen.getByRole("button", { name: "Send pack" });
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Grant selected friends access/ }));
  fireEvent.click(send); fireEvent.click(send);
  expect(onSend).toHaveBeenCalledOnce();
  expect(onSend).toHaveBeenCalledWith("amber", expect.objectContaining({ kind }), true);
  finish(true);
  expect(await screen.findByRole("status")).toHaveTextContent("Pack sent to Amber.");
});

it("retries only failed recipients and gates private forwarding", async () => {
  const onSend = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true);
  render(<SharePackDialog pack={{ ...pack, distribution: "worldwide" }} buddies={buddies} onClose={vi.fn()} onSend={onSend}
    initialBuddyIds={["amber", "ben"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Send pack" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Some friends did not receive");
  fireEvent.click(screen.getByRole("button", { name: "Send pack" }));
  await waitFor(() => expect(onSend).toHaveBeenCalledTimes(3));
  expect(onSend.mock.calls.map(([id]) => id)).toEqual(["amber", "ben", "ben"]);
  expect(canSharePack(pack, "other")).toBe(false);
  expect(canSharePack({ ...pack, distribution: "worldwide" }, "other")).toBe(true);
  expect(canSharePack({ ...pack, status: "draft" }, "you")).toBe(false);
});

it("offers only approved friends for restricted A-List packs", () => {
  render(<SharePackDialog pack={{ ...pack, distribution: "alist" }}
    buddies={buddies.map((buddy) => ({ ...buddy, aListApproved: buddy.id === "amber" }))}
    onClose={vi.fn()} onSend={vi.fn()} />);
  expect(screen.getByRole("checkbox", { name: /Amber.*@amber/ })).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: "Ben @ben" })).not.toBeInTheDocument();
});
