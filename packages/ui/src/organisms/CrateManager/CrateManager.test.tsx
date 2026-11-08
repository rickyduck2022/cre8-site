import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrateManager } from "./CrateManager";
import type { Dub } from "../../types/domain";

afterEach(cleanup);

const crates = [
  { id: "night", name: "Night Drive", dubIds: [] },
  { id: "warmup", name: "Warm Up", dubIds: [] },
];

const dubs: Dub[] = [
  {
    id: "roller",
    title: "Roller",
    artist: "Meladee",
    uploader: "meladee",
    uploaderDisplayName: "Meladee",
    uploadedAt: "2026-11-05T15:42:00.000Z",
    bpm: 128,
    genre: "Garage",
    duration: "04:10",
    likes: 0,
    downloads: 0,
    artwork: "whitelabel",
    message: "A new dub.",
  },
];

function renderManager() {
  const onSetDubInCrate = vi.fn(async () => true);
  const result = render(
    <CrateManager
      crates={crates}
      dubs={dubs}
      onCreateCrate={vi.fn(async () => true)}
      onRenameCrate={vi.fn(async () => true)}
      onDeleteCrate={vi.fn(async () => true)}
      onSetDubInCrate={onSetDubInCrate}
      onOpenCrate={vi.fn()}
    />,
  );
  return { ...result, onSetDubInCrate };
}

describe("CrateManager", () => {
  it("searches crates and adds a dub inline", async () => {
    const { container, onSetDubInCrate } = renderManager();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search crates" }), {
      target: { value: "night" },
    });
    expect(screen.getByText("Night Drive")).toBeTruthy();
    expect(screen.queryByText("Warm Up")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Manage tracks" }));
    const addButton = await screen.findByRole("button", { name: "Add Roller to Night Drive" });
    fireEvent.click(addButton);
    await waitFor(() => expect(onSetDubInCrate).toHaveBeenCalledWith("night", "roller", true));
    expect(container.querySelector(".crate-manager__track-list")).toBeTruthy();
  });

  it("deduplicates crate rows and adds the selected dub from the add flow", async () => {
    const onAddPendingDub = vi.fn(async () => true);
    const { container } = render(
      <CrateManager
        crates={[
          { id: "night", name: "Night Drive", dubIds: [] },
          { id: "night-duplicate", name: " night drive ", dubIds: ["roller"] },
        ]}
        dubs={dubs}
        pendingDub={dubs[0]}
        onCreateCrate={vi.fn(async () => true)}
        onRenameCrate={vi.fn(async () => true)}
        onDeleteCrate={vi.fn(async () => true)}
        onSetDubInCrate={vi.fn(async () => true)}
        onAddPendingDub={onAddPendingDub}
        onOpenCrate={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".crate-manager__item")).toHaveLength(1);
    expect(screen.getByText("1 dub")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Roller is already in Night Drive" })).toBeTruthy();
  });

  it("adds a selected dub to a crate from the shared manager", async () => {
    const onAddPendingDub = vi.fn(async () => true);
    render(
      <CrateManager
        crates={[crates[0]]}
        dubs={dubs}
        pendingDub={dubs[0]}
        onCreateCrate={vi.fn(async () => true)}
        onRenameCrate={vi.fn(async () => true)}
        onDeleteCrate={vi.fn(async () => true)}
        onSetDubInCrate={vi.fn(async () => true)}
        onAddPendingDub={onAddPendingDub}
        onOpenCrate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Roller to Night Drive" }));
    await waitFor(() => expect(onAddPendingDub).toHaveBeenCalledWith("night", "roller"));
  });

  it("creates, renames, and deletes crates from the manager", async () => {
    const onCreateCrate = vi.fn(async () => true);
    const onRenameCrate = vi.fn(async () => true);
    const onDeleteCrate = vi.fn(async () => true);
    render(
      <CrateManager
        crates={[crates[0]]}
        dubs={dubs}
        onCreateCrate={onCreateCrate}
        onRenameCrate={onRenameCrate}
        onDeleteCrate={onDeleteCrate}
        onSetDubInCrate={vi.fn(async () => true)}
        onOpenCrate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add crate" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Crate name" }), {
      target: { value: "Studio picks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create crate" }));
    await waitFor(() => expect(onCreateCrate).toHaveBeenCalledWith("Studio picks"));

    fireEvent.click(screen.getByRole("button", { name: "Edit Night Drive" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Crate name" }), {
      target: { value: "Late drive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(onRenameCrate).toHaveBeenCalledWith("night", "Late drive"));

    fireEvent.click(screen.getByRole("button", { name: "Delete Night Drive" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete crate" }));
    await waitFor(() => expect(onDeleteCrate).toHaveBeenCalledWith("night"));
  });
});
