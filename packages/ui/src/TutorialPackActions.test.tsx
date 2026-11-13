import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TutorialActivityContext, type DubPack } from "@craft/ui";
import { PackEditor } from "../../../apps/web/src/components/PackEditor";
import { packRequest } from "../../../apps/web/src/services/packs";

vi.mock("../../../apps/web/src/services/packs", async (original) => ({
  ...await original<typeof import("../../../apps/web/src/services/packs")>(), packRequest: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const pack: DubPack = {
  id: "tutorial-pack", title: "Tutorial pack", description: "", kind: "dub", status: "draft",
  distribution: "worldwide", aListPublic: false, licence: "", ownerUsername: "artist",
  ownerDisplayName: "Artist", items: [], createdAt: "", updatedAt: "", totalBytes: 0,
};

it("reports a pack save after persistence and refresh, never after failed requests or mere edits", async () => {
  vi.mocked(packRequest).mockRejectedValueOnce(new Error("Pack save unavailable.")).mockResolvedValue({ pack });
  const report = vi.fn();
  const refresh = vi.fn().mockRejectedValueOnce(new Error("Refresh unavailable.")).mockResolvedValue(undefined);
  const saved = vi.fn();
  render(<TutorialActivityContext.Provider value={{ report, subscribe: () => () => {} }}>
    <PackEditor pack={pack} dubs={[]} artists={[]} approved={false} onSaved={saved} onClose={vi.fn()} onCommunityChange={refresh} />
  </TutorialActivityContext.Provider>);
  fireEvent.change(screen.getByRole("textbox", { name: "Pack title" }), { target: { value: "Edited pack" } });
  expect(report).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Pack save unavailable.");
  expect(report).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not be refreshed"));
  expect(report).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  expect(packRequest).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
  await waitFor(() => expect(report).toHaveBeenCalledWith({ type: "pack-saved", subjectId: pack.id }));
  expect(report).toHaveBeenCalledTimes(1);
  expect(saved).toHaveBeenCalledWith(pack);
  expect(packRequest).toHaveBeenCalledTimes(2);
});
