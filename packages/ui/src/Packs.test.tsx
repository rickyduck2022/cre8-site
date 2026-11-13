import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackEditor } from "../../../apps/web/src/components/PackEditor";
import { PackView } from "../../../apps/web/src/components/PackView";
import { PackWorkspace } from "../../../apps/web/src/components/PackWorkspace";
import { PackWindows } from "../../../apps/web/src/components/PackWindows";
import { Workspace } from "@craft/ui";
import type { Pack } from "../../../apps/web/src/services/packs";

const mocks = vi.hoisted(() => ({ request: vi.fn(), upload: vi.fn(), duration: vi.fn(), download: vi.fn() }));
vi.mock("../../../apps/web/src/services/packs", async (original) => ({
  ...await original<typeof import("../../../apps/web/src/services/packs")>(),
  packRequest: mocks.request, downloadPack: mocks.download,
}));
vi.mock("../../../apps/web/src/services/uploadFile", () => ({ uploadFile: mocks.upload }));
vi.mock("../../../apps/web/src/services/readAudioDuration", () => ({ readAudioDurationSeconds: mocks.duration }));

const dub = {
  id: "one", title: "Night Drive", artist: "Amber", artistId: "artist",
  uploader: "amber", uploaderDisplayName: "Amber", uploadedAt: "2026-11-10",
  bpm: 174, genre: "Jungle", tags: ["Jungle"], duration: "03:00",
  likes: 0, downloads: 0, artwork: "", message: "", audioUrl: "/api/dubs/one/audio", distribution: "worldwide" as const,
};
const pack: Pack = {
  id: "pack", title: "Night sessions", description: "", kind: "dub", status: "draft",
  distribution: "worldwide", aListPublic: false, licence: "", ownerUsername: "amber", ownerDisplayName: "Amber",
  items: [{ dub }], totalBytes: 1234, createdAt: "2026-11-10", updatedAt: "2026-11-10",
};
const artists = [{ id: "artist", name: "Amber" }];
const editorProps = { pack, dubs: [dub], artists, approved: true, onSaved: vi.fn(), onClose: vi.fn(), onCommunityChange: vi.fn().mockResolvedValue(undefined) };
const playback = { nowPlayingId: null, isPlaying: false, currentTime: 0, duration: 0, volume: 0.7, playbackError: null };
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it.each(["sample", "dub", "vocal"] as const)("scopes the owned %s workspace and creates that pack type", async (mediaKind) => {
  const owned = { ...pack, kind: mediaKind, title: "Owned release" };
  mocks.request.mockImplementation(async (_path: string, method: string) => method === "POST"
    ? { pack: { ...owned, id: "new", title: "Untitled pack" } }
    : { packs: [owned, { ...owned, id: "other-kind", kind: mediaKind === "sample" ? "dub" : "sample", title: "Other kind" },
      { ...owned, id: "other-owner", ownerUsername: "someone", title: "Other owner" }] });
  render(<PackWorkspace mediaKind={mediaKind} username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
    onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()}
    onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
  expect(await screen.findByText("Owned release", { exact: true })).toBeVisible();
  expect(screen.getByText("Release archive")).toBeVisible();
  expect(screen.getByRole("heading", { name: mediaKind === "vocal" ? "Your Vocal Packs" : mediaKind === "sample" ? "Your Sample Packs" : "Your Dub Packs" })).toBeVisible();
  expect(screen.queryByText("Other kind")).not.toBeInTheDocument();
  expect(screen.queryByText("Other owner")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Pack type filter" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open pack", exact: true })).toHaveClass("button--primary");
  expect(screen.getByRole("button", { name: "Open pack" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Play pack" })).toHaveStyle({ width: "100%" });
  fireEvent.click(screen.getByRole("button", { name: "Add Pack" }));
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs", "POST", expect.objectContaining({ kind: mediaKind })));
  expect(await screen.findByLabelText("Pack type")).toHaveValue(mediaKind);
});

describe("Pack editor", () => {
  it.each(["dub", "sample", "vocal"] as const)("limits the %s existing-file picker to compatible media", (kind) => {
    const files = (["dub", "sample", "vocal"] as const).map((mediaKind) => ({ ...dub, id: mediaKind, title: `${mediaKind} file`, mediaKind }));
    render(<PackEditor {...editorProps} pack={{ ...pack, kind, licence: "Original works.", items: [] }} dubs={files} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    for (const file of files) {
      const compatible = kind === "sample" ? file.mediaKind !== "dub" : kind === file.mediaKind;
      const option = screen.getByRole("checkbox", { name: new RegExp(file.title) });
      if (compatible) expect(option).toBeEnabled();
      else expect(option).toBeDisabled();
    }
  });

  it("allows removing an incompatible selection after changing pack type and blocks saving it", async () => {
    const sample = { ...dub, mediaKind: "sample" as const };
    mocks.request.mockResolvedValue({ pack: { ...pack, kind: "vocal", items: [] } });
    render(<PackEditor {...editorProps} pack={{ ...pack, kind: "sample", licence: "Original works.", items: [{ dub: sample }] }} dubs={[sample]} />);
    fireEvent.change(screen.getByLabelText("Pack type"), { target: { value: "vocal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("incompatible media type");
    expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    const selected = screen.getByRole("checkbox", { name: /Night Drive/ });
    expect(selected).toBeEnabled();
    fireEvent.click(selected);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "PATCH", expect.objectContaining({ kind: "vocal", dubIds: [] })));
  });

  it.each(["dub", "sample", "vocal"] as const)("uploads directly inside an owned %s pack window without replacing it", async (kind) => {
    HTMLDialogElement.prototype.show = function () { this.open = true; };
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const typedDub = { ...dub, mediaKind: kind };
    const published = { ...pack, kind, items: [{ dub: typedDub }], status: "published" as const, licence: kind !== "dub" ? "Use in your own productions." : "" };
    const uploaded = { ...published, items: [...published.items, { dub: { ...dub, id: "new", title: "New" } }] };
    let finish!: (value: { uploadId: string }) => void;
    mocks.duration.mockResolvedValue(60);
    mocks.upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mocks.request.mockImplementation(async (path: string) => ({ pack: path.endsWith("/tracks") ? uploaded : published }));
    const close = vi.fn(); const externalEdit = vi.fn(); const refresh = vi.fn().mockResolvedValue(undefined);
    render(<Workspace><PackWindows withinLayer windows={[{ pack: published, openRequest: 0 }]} stack={[pack.id]} username="amber"
      editor={{ dubs: [typedDub], artists, approved: true }} authenticated playback={playback} onPlay={vi.fn()} onPlayAll={vi.fn()}
      onSeek={vi.fn()} onVolume={vi.fn()} onDownloadDub={vi.fn()} onCommunityChange={refresh}
      onActivate={vi.fn()} onClose={close} onEdit={externalEdit} /></Workspace>);
    const name = `${kind === "vocal" ? "Vocal" : kind === "sample" ? "Sample" : "Dub"} Pack: ${pack.title}`;
    const window = screen.getByRole("dialog", { name });
    fireEvent.click(within(window).getByRole("button", { name: "Edit pack" }));
    await within(window).findByLabelText("Pack title");
    expect(screen.getByRole("dialog", { name })).toBe(window);
    fireEvent.click(within(window).getByRole("button", { name: "2. Add files" }));
    fireEvent.change(within(window).getByLabelText("Upload audio files"), { target: { files: [new File(["audio"], "New.wav")] } });
    const confirm = vi.spyOn(globalThis.window, "confirm").mockReturnValue(false);
    fireEvent.click(within(window).getByRole("button", { name: `Close ${name}` }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(within(window).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(within(window).getByRole("button", { name: `Close ${name}` })).toBeDisabled();
    await act(async () => finish({ uploadId: "new-upload" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack/tracks", "POST", expect.objectContaining({ title: "New", uploadId: "new-upload", durationSeconds: 60 })));
    await waitFor(() => expect(within(window).getByRole("button", { name: "3. Arrange & review" })).toHaveAttribute("aria-current", "step"));
    expect(within(window).getByText("New", { exact: true })).toBeVisible();
    expect(externalEdit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
    fireEvent.click(within(window).getByRole("button", { name: "Close editor" }));
    expect(screen.getByRole("dialog", { name })).toBe(window);
    expect(within(window).getByRole("button", { name: "Edit pack" })).toBeVisible();
    expect(within(window).queryByLabelText("Upload audio files")).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it("keeps a failed inline editor load in the pack window and rechecks ownership before exposing uploads", async () => {
    HTMLDialogElement.prototype.show = function () { this.open = true; };
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const published = { ...pack, status: "published" as const };
    mocks.request.mockRejectedValueOnce(new Error("Connection interrupted.")).mockResolvedValueOnce({ pack: { ...published, ownerUsername: "someone" } });
    render(<Workspace><PackWindows withinLayer windows={[{ pack: published, openRequest: 0 }]} stack={[pack.id]} username="amber"
      editor={{ dubs: [dub], artists, approved: true }} authenticated playback={playback} onPlay={vi.fn()} onPlayAll={vi.fn()}
      onSeek={vi.fn()} onVolume={vi.fn()} onDownloadDub={vi.fn()} onCommunityChange={vi.fn()}
      onActivate={vi.fn()} onClose={vi.fn()} onEdit={vi.fn()} /></Workspace>);
    const dialog = screen.getByRole("dialog", { name: `Dub Pack: ${pack.title}` });
    fireEvent.click(within(dialog).getByRole("button", { name: "Edit pack" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Connection interrupted.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry loading pack" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Only the pack owner"));
    expect(within(dialog).queryByRole("region", { name: "Pack editor" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Pack title")).not.toBeInTheDocument();
  });

  it.each(["dub", "sample", "vocal"] as const)("plays and pauses the exact %s pack from its full-width workspace button", async (kind) => {
    const published = { ...pack, kind, status: "published" as const };
    const onPlay = vi.fn();
    const onPlayAll = vi.fn();
    const activate = vi.fn(() => true);
    mocks.request.mockResolvedValue({ packs: [published] });
    const props = { username: "amber", approved: true, dubs: [dub], artists, buddies: [],
      onPlay, onPlayAll, onActivateQueue: activate, onSeek: vi.fn(), onVolume: vi.fn(),
      onDownloadDub: vi.fn(), onCommunityChange: vi.fn() };
    const { rerender } = render(<PackWorkspace {...props} playback={playback} />);
    const play = await screen.findByRole("button", { name: "Play pack" });
    fireEvent.click(play);
    expect(onPlayAll).toHaveBeenCalledWith([dub], pack.id);
    expect(activate).toHaveBeenCalledWith([dub], pack.id);
    rerender(<PackWorkspace {...props} activePackId={pack.id} playback={{ ...playback, nowPlayingId: dub.id, isPlaying: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause pack" }));
    expect(onPlay).toHaveBeenCalledWith(dub);
    expect(onPlayAll).toHaveBeenCalledOnce();
  });

  it.each(["dub", "sample", "vocal"] as const)("uses orange for the %s pack view Share pack action", (kind) => {
    render(<PackView pack={{ ...pack, kind, status: "published" }} authenticated owner playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()}
      onDownloadDub={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Share pack", exact: true })).toHaveClass("button--primary");
  });

  it("deletes a workspace pack after confirmation and refreshes the collection", async () => {
    const changed = vi.fn().mockResolvedValue(undefined);
    mocks.request.mockImplementation(async (_path: string, method: string) => {
      if (method === "DELETE") {
        mocks.request.mockResolvedValue({ packs: [] });
        return undefined;
      }
      return { packs: [pack] };
    });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()}
      onDownloadDub={vi.fn()} onCommunityChange={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete pack", exact: true }));
    expect(mocks.request.mock.calls.some(([, method]) => method === "DELETE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete pack" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: pack.title })).not.toBeInTheDocument());
    expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "DELETE");
    expect(changed).toHaveBeenCalledOnce();
  });

  it("updates owner download statistics from community snapshots without showing another owner's statistics", async () => {
    const initial = { ...pack, zipDownloads: 1 };
    const props = { username: "amber", approved: true, dubs: [dub], artists, buddies: [], playback,
      onPlay: vi.fn(), onPlayAll: vi.fn(), onSeek: vi.fn(), onVolume: vi.fn(), onDownloadDub: vi.fn(), onCommunityChange: vi.fn() };
    mocks.request.mockResolvedValue({ packs: [initial, { ...pack, id: "shared", title: "Shared release", ownerUsername: "someone", zipDownloads: 9 }] });
    const { rerender } = render(<PackWorkspace {...props} communityPacks={[initial]} />);
    const statistics = await screen.findByRole("region", { name: `Download statistics for ${pack.title}` });
    expect(within(statistics).getByText("Whole-pack ZIP downloads").nextElementSibling).toHaveTextContent("1");
    expect(screen.queryByRole("region", { name: "Download statistics for Shared release" })).not.toBeInTheDocument();
    rerender(<PackWorkspace {...props} communityPacks={[{ ...initial, zipDownloads: 2, items: [{ dub: { ...dub, downloads: 4 } }] }]} />);
    expect(within(statistics).getByText("Whole-pack ZIP downloads").nextElementSibling).toHaveTextContent("2");
    expect(within(statistics).getByRole("row", { name: "Night Drive 4" })).toBeVisible();
  });

  it("opens a workspace pack in the window system without changing playback or navigating inline", async () => {
    const onOpenPack = vi.fn();
    const onPlayAll = vi.fn();
    mocks.request.mockResolvedValue({ packs: [pack] });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      onOpenPack={onOpenPack} onPlay={vi.fn()} onPlayAll={onPlayAll} onSeek={vi.fn()} onVolume={vi.fn()}
      onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open pack" }));
    expect(onOpenPack).toHaveBeenCalledWith(pack);
    expect(onPlayAll).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Packs" })).toBeVisible();
  });
  it.each(["dub", "sample", "vocal"] as const)("edits an owned published %s pack directly from the workspace and persists changes", async (kind) => {
    const typedDub = { ...dub, mediaKind: kind };
    const published: Pack = { ...pack, kind, items: [{ dub: typedDub }], status: "published", licence: "Original productions." };
    const updated = { ...published, title: "Updated release" };
    const onCommunityChange = vi.fn().mockResolvedValue(undefined);
    mocks.request.mockImplementation(async (path: string, method: string) => method === "PATCH"
      ? { pack: updated } : path === "/api/packs/pack" ? { pack: published }
        : { packs: [published, { ...published, id: "shared", title: "Someone else's pack", ownerUsername: "someone" }] });
    render(<PackWorkspace username="amber" approved dubs={[typedDub]} artists={artists} buddies={[]} playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()}
      onDownloadDub={vi.fn()} onCommunityChange={onCommunityChange} />);
    const card = await screen.findByRole("heading", { name: pack.title });
    expect(screen.getAllByRole("button", { name: "Edit pack" })).toHaveLength(1);
    const actions = within(card.closest("article")!);
    const open = actions.getByRole("button", { name: "Open pack" });
    const edit = actions.getByRole("button", { name: "Edit pack" });
    expect(open.closest(".card-actions")).not.toBe(edit.closest(".card-actions"));
    const controls = actions.getByRole("group", { name: "Pack controls" });
    expect(controls).toHaveClass("card-actions--grid", "card-actions--separated");
    expect(within(controls).getAllByRole("button")).toHaveLength(2);
    expect(within(controls).getByRole("button", { name: "Delete pack" })).toBeVisible();
    fireEvent.click(edit);
    expect(await screen.findByLabelText("Pack title")).toHaveValue(pack.title);
    expect(screen.getByLabelText("Pack type")).toHaveValue(kind);
    fireEvent.change(screen.getByLabelText("Pack title"), { target: { value: updated.title } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "PATCH",
      expect.objectContaining({ title: updated.title, kind, dubIds: ["one"] })));
    expect(await screen.findByRole("heading", { name: updated.title })).toBeVisible();
    expect(onCommunityChange).toHaveBeenCalledOnce();
    expect(mocks.request.mock.calls.some(([, method]) => method === "POST")).toBe(false);
  });

  it("does not open another member's pack for editing", async () => {
    const other = { ...pack, ownerUsername: "someone" };
    const onOpened = vi.fn();
    mocks.request.mockResolvedValue({ packs: [other] });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      editPack={other} onOpened={onOpened} onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()}
      onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    await screen.findByRole("heading", { name: other.title });
    expect(screen.queryByLabelText("Pack title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit pack" })).not.toBeInTheDocument();
    expect(onOpened).not.toHaveBeenCalled();
  });

  it("advances instead of publishing when the details form is submitted", () => {
    const { container } = render(<PackEditor {...editorProps} />);
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("heading", { name: "Add tracks" })).toBeVisible();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("shows a clear empty search and starts queued uploads on Next before review", async () => {
    let finish!: (value: { uploadId: string }) => void;
    mocks.duration.mockResolvedValue(60);
    mocks.upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mocks.request.mockResolvedValue({ pack });
    render(<PackEditor {...editorProps} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your uploads" }), { target: { value: "missing" } });
    expect(screen.getByText("No uploads match your search.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Upload audio files"), { target: { files: [new File(["audio"], "New.wav")] } });
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(screen.getByRole("heading", { name: "Add tracks" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await act(async () => finish({ uploadId: "new" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "3. Arrange & review" })).toHaveAttribute("aria-current", "step"));
    expect(mocks.upload).toHaveBeenCalledOnce();
  });

  it("protects unsaved file metadata when moving between editor steps", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PackEditor {...editorProps} />);
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit details for Night Drive" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "1. Details" }));
    expect(confirm).toHaveBeenCalledWith("Discard unsaved file details? Your saved pack files will remain.");
    expect(screen.getByLabelText("Title")).toHaveValue("New title");
    confirm.mockRestore();
  });

  it.each([
    ["sample", "draft"], ["sample", "published"], ["vocal", "draft"], ["vocal", "published"],
  ] as const)("validates %s licensing on Next, Enter and forward tabs for a %s pack", async (kind, status) => {
    const { container } = render(<PackEditor {...editorProps} pack={{ ...pack, kind, status, licence: " " }} />);
    for (const advance of [
      () => fireEvent.click(screen.getByRole("button", { name: "Next" })),
      () => fireEvent.submit(container.querySelector("form")!),
      () => fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" })),
    ]) {
      advance();
      expect(await screen.findByRole("alert")).toHaveTextContent("Provide usage licence terms");
      expect(screen.getByRole("button", { name: "1. Details" })).toHaveAttribute("aria-current", "step");
    }
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Usage licence"), { target: { value: "Use in original productions only." } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: kind === "vocal" ? "Add vocals" : "Add samples" })).toBeVisible();
  });

  it("checks all queued metadata before saving or uploading and stays on Add files when invalid", async () => {
    render(<PackEditor {...editorProps} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.change(screen.getByLabelText("Upload audio files"), { target: { files: [new File(["audio"], "New.wav")] } });
    fireEvent.change(screen.getByLabelText("File title"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("New.wav: Provide a title and artist.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Add tracks" })).toBeVisible();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("requires recipient confirmation before Next uploads published private files", async () => {
    render(<PackEditor {...editorProps} pack={{ ...pack, status: "published", distribution: "private",
      grants: [{ id: "friend", username: "friend", displayName: "Friend" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.change(screen.getByLabelText("Upload audio files"), { target: { files: [new File(["audio"], "Private.wav")] } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirm that existing recipients");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("switches compatible pack type without uploading again and requires explicit sample usage terms", async () => {
    const vocal = { ...dub, mediaKind: "vocal" as const };
    render(<PackEditor {...editorProps} pack={{ ...pack, kind: "vocal", items: [{ dub: vocal }] }} dubs={[vocal]} />);
    fireEvent.change(screen.getByLabelText("Pack type"), { target: { value: "sample" } });
    expect(screen.getByLabelText(/Usage licence/)).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Usage licence/), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provide usage licence terms");
    expect(screen.getByRole("button", { name: "1. Details" })).toHaveAttribute("aria-current", "step");
    expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "1. Details" }));
    fireEvent.change(screen.getByLabelText(/Usage licence/), { target: { value: "Use in original productions; no standalone resale." } });
    mocks.request.mockResolvedValue({ pack: { ...pack, kind: "sample" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "PATCH", expect.objectContaining({ kind: "sample", dubIds: ["one"], licence: "Use in original productions; no standalone resale." })));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("reorders files accessibly and prevents incompatible existing dubs being selected", async () => {
    const second = { ...dub, id: "two", title: "Sunrise" };
    const privateDub = { ...dub, id: "private", title: "Secret", distribution: "private" as const };
    render(<PackEditor {...editorProps} pack={{ ...pack, items: [{ dub }, { dub: second }] }} dubs={[dub, second, privateDub]} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    expect(screen.getByRole("checkbox", { name: /Secret/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Sunrise up" }));
    mocks.request.mockResolvedValue({ pack });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "PATCH", expect.objectContaining({ dubIds: ["two", "one"] })));
  });

  it("retains successful uploads, retries failures only, and blocks partial publication", async () => {
    const newDub = { ...dub, id: "new", title: "New" };
    mocks.duration.mockResolvedValue(60);
    mocks.upload.mockResolvedValueOnce({ uploadId: "upload" }).mockRejectedValueOnce(new Error("Network interrupted")).mockResolvedValueOnce({ uploadId: "retry" });
    mocks.request.mockImplementation(async (path: string) => path.endsWith("/tracks")
      ? { pack: { ...pack, items: [{ dub }, { dub: newDub }] } } : { pack });
    render(<PackEditor {...editorProps} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.change(screen.getByLabelText("Upload audio files"), { target: { files: [new File(["one"], "New.wav"), new File(["two"], "Again.wav")] } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("1 file upload failed. Successful files are saved; retry only failed files.");
    expect(screen.getByText("Uploaded")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    await screen.findByText("All files uploaded and saved.");
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls[2][0].name).toBe("Again.wav");
  });

  it("reuses the uploaded binary when Next retries a failed track attachment", async () => {
    const updated = { ...pack, items: [{ dub }, { dub: { ...dub, id: "attached", title: "Retry" } }] };
    let attachments = 0;
    mocks.duration.mockResolvedValue(60);
    mocks.upload.mockResolvedValueOnce({ uploadId: "cached-audio" });
    mocks.request.mockImplementation(async (path: string) => {
      if (!path.endsWith("/tracks")) return { pack };
      if (++attachments === 1) throw new Error("Attachment interrupted");
      return { pack: updated };
    });
    render(<PackEditor {...editorProps} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.change(screen.getByLabelText("Upload audio files"), { target: { files: [new File(["audio"], "Retry.wav")] } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(/1 file upload failed/);
    expect(screen.getByRole("heading", { name: "Add tracks" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Arrange & review" });
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.request.mock.calls.filter(([path]) => path.endsWith("/tracks"))).toEqual([
      ["/api/packs/pack/tracks", "POST", expect.objectContaining({ uploadId: "cached-audio" })],
      ["/api/packs/pack/tracks", "POST", expect.objectContaining({ uploadId: "cached-audio" })],
    ]);
  });

  it("requires confirmation before published private additions reach existing recipients", async () => {
    const privateDub = { ...dub, distribution: "private" as const };
    const other = { ...privateDub, id: "two", title: "New private dub" };
    const privatePack: Pack = { ...pack, status: "published", distribution: "private", items: [{ dub: privateDub }], grants: [{ id: "holik", username: "holik", displayName: "Holik" }] };
    render(<PackEditor {...editorProps} pack={privatePack} dubs={[privateDub, other]} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /New private dub/ }));
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Grant existing pack recipients/ }));
    expect(screen.getByRole("button", { name: "Save changes" })).not.toBeDisabled();
  });

  it("loads the current saved pack before editing and lets failed loads be retried", async () => {
    const latest = { ...pack, title: "Latest saved title", description: "Latest saved description" };
    mocks.request.mockImplementation(async (path: string) => path === "/api/packs" ? { packs: [pack] } : Promise.reject(new Error("Connection interrupted")));
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()}
      onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit pack" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.queryByLabelText("Pack title")).not.toBeInTheDocument();
    mocks.request.mockResolvedValue({ pack: latest });
    fireEvent.click(screen.getByRole("button", { name: "Retry loading pack" }));
    expect(await screen.findByLabelText("Pack title")).toHaveValue(latest.title);
    expect(screen.getByLabelText("Description")).toHaveValue(latest.description);
    expect(screen.getByRole("heading", { name: "Edit pack" })).toHaveFocus();
  });

  it("saves published edits with PATCH only, including form submission, without republishing", async () => {
    const published = { ...pack, status: "published" as const };
    const updated = { ...published, title: "Saved title" };
    mocks.request.mockResolvedValue({ pack: updated });
    const onSaved = vi.fn();
    const { container } = render(<PackEditor {...editorProps} pack={published} onSaved={onSaved} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save & publish" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pack title"), { target: { value: updated.title } });
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack", "PATCH", expect.objectContaining({ title: updated.title }));
  });

  it("retains edits after a failed save and confirms cancel only while there are unsaved changes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    const onSaved = vi.fn();
    mocks.request.mockRejectedValue(new Error("Save interrupted"));
    render(<PackEditor {...editorProps} pack={{ ...pack, status: "published" }} onClose={onClose} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Pack title"), { target: { value: "Keep my changes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save interrupted");
    expect(screen.getByLabelText("Pack title")).toHaveValue("Keep my changes");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Pack title"), { target: { value: pack.title } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("retries community refresh after a successful save without saving the pack a second time", async () => {
    const published = { ...pack, status: "published" as const };
    const updated = { ...published, title: "Committed title" };
    const onSaved = vi.fn();
    const onCommunityChange = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(undefined);
    mocks.request.mockResolvedValue({ pack: updated });
    render(<PackEditor {...editorProps} pack={published} onSaved={onSaved} onCommunityChange={onCommunityChange} />);
    fireEvent.change(screen.getByLabelText("Pack title"), { target: { value: updated.title } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your pack was saved");
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(onCommunityChange).toHaveBeenCalledTimes(2);
  });
});

describe("Pack viewing and discovery", () => {
  const props = { pack: { ...pack, status: "published" as const }, authenticated: true, owner: true, playback,
    onPlay: vi.fn(), onPlayAll: vi.fn(), onSeek: vi.fn(), onVolume: vi.fn(), onDownloadDub: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined), onEdit: vi.fn() };
  it.each(["dub", "sample", "vocal"] as const)("uses the shared %s pack playback button to pause and resume the selected file", (kind) => {
    const active = { ...props.pack, kind };
    const onActivateQueue = vi.fn(() => true);
    const { rerender } = render(<PackView {...props} pack={active} activePackId="pack"
      playback={{ ...playback, nowPlayingId: dub.id, isPlaying: true }} onActivateQueue={onActivateQueue} />);
    const pause = screen.getByRole("button", { name: "Pause pack" });
    expect(pause).toHaveClass("button--audio", `media-kind--${kind}`);
    fireEvent.click(pause);
    expect(props.onPlay).toHaveBeenLastCalledWith(dub);
    expect(props.onPlayAll).not.toHaveBeenCalled();
    expect(onActivateQueue).toHaveBeenCalledWith([dub], "pack");
    rerender(<PackView {...props} pack={active} activePackId="pack" playback={{ ...playback, nowPlayingId: dub.id, isPlaying: false }}
      onActivateQueue={onActivateQueue} />);
    fireEvent.click(screen.getByRole("button", { name: "Play all" }));
    expect(props.onPlay).toHaveBeenLastCalledWith(dub);
  });
  it("uses ordered playlist DubCards wired to pack playback, sample keys and downloads", async () => {
    const second = { ...dub, id: "two", title: "Sunrise" };
    render(<PackView {...props} pack={{ ...props.pack, kind: "sample", items: [{ dub, key: "F minor" }, { dub: second }] }}
      playback={{ ...playback, nowPlayingId: dub.id, isPlaying: true, currentTime: 30, duration: 120 }} />);
    const list = screen.getByRole("list", { name: "Pack samples" });
    const cards = within(list).getAllByRole("article");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual(["Night Drive", "Sunrise"]);
    expect(cards[0]).toHaveClass("dub-card--playlist", "dub-card--current");
    expect(within(cards[0]).getByText("F minor")).toBeVisible();
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Pause" }));
    expect(props.onPlay).toHaveBeenCalledWith(dub);
    fireEvent.keyDown(within(cards[0]).getByRole("slider", { name: "Night Drive playback progress" }), { key: "End" });
    expect(props.onSeek).toHaveBeenCalledWith(1, dub);
    fireEvent.click(within(cards[1]).getByRole("button", { name: "Download · Like" }));
    await waitFor(() => expect(props.onDownloadDub).toHaveBeenCalledWith(second));
    await screen.findByText("Sunrise downloaded.");
  });

  it("routes guest individual downloads through sign-in with the pack return link", () => {
    render(<PackView {...props} authenticated={false} />);
    const card = screen.getByRole("article", { name: "Night Drive" });
    fireEvent.click(within(card).getByRole("button", { name: "Download · Like" }));
    expect(window.location.hash).toBe("#sign-in?pack=pack");
    expect(props.onDownloadDub).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });

  it("lets owners play drafts without enabling unpublished downloads or sharing", () => {
    render(<PackView {...props} pack={pack} />);
    const card = screen.getByRole("article", { name: "Night Drive" });
    expect(within(card).getByRole("button", { name: "Play" })).toBeEnabled();
    fireEvent.click(within(card).getByRole("button", { name: "Play" }));
    expect(props.onPlay).toHaveBeenCalledWith(dub);
    expect(within(card).getByRole("button", { name: "Download · Like" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Share pack" })).not.toBeInTheDocument();
  });

  it("keeps draft playback disabled for non-owners", () => {
    render(<PackView {...props} pack={pack} owner={false} />);
    expect(within(screen.getByRole("article", { name: "Night Drive" })).getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Play all" })).not.toBeInTheDocument();
  });

  it("plays files in pack order and offers a manual clipboard fallback", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    render(<PackView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Play all" }));
    expect(props.onPlayAll).toHaveBeenCalledWith([dub], "pack");
    fireEvent.click(screen.getByRole("button", { name: "Share pack" }));
    fireEvent.click(screen.getByRole("button", { name: "External link" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use Select link and copy it manually");
    fireEvent.click(screen.getByRole("button", { name: "Select link" }));
    expect(screen.getByLabelText("Pack share link")).toHaveFocus();
  });

  it("guards duplicate archive requests and only announces confirmed downloads", async () => {
    let finish!: () => void;
    mocks.download.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<PackView {...props} />);
    const button = screen.getByRole("button", { name: "Download pack (ZIP)" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    await act(async () => finish());
    expect(await screen.findByRole("status")).toHaveTextContent("Pack downloaded");
  });

  it("keeps private links out of sharing and exposes direct recipient revocation", async () => {
    const privatePack: Pack = { ...props.pack, distribution: "private", grants: [{ id: "user", username: "holik", displayName: "Holik" }] };
    mocks.request.mockResolvedValue({ pack: privatePack });
    render(<PackView {...props} pack={privatePack} />);
    fireEvent.click(screen.getByRole("button", { name: "Manage access · 1" }));
    expect(screen.queryByRole("button", { name: "External link" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke pack access for Holik" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack/grants/user", "DELETE"));
  });

  it("requires explicit access confirmation before adding more private recipients", async () => {
    const privatePack: Pack = { ...props.pack, distribution: "private", grants: [{ id: "old", username: "old", displayName: "Existing recipient" }] };
    const buddy = { id: "new", userId: "new-user", username: "new", displayName: "New Friend", genre: "", role: "", bio: "", groups: [], presence: "online" as const };
    mocks.request.mockResolvedValue({ pack: privatePack });
    render(<PackView {...props} pack={privatePack} buddies={[buddy]} />);
    fireEvent.click(screen.getByRole("button", { name: "Share pack" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "New Friend @new" }));
    const send = screen.getByRole("button", { name: "Share with selected friends" });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Grant selected friends access to all files currently in this pack." }));
    fireEvent.click(send);
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/conversations/new/messages", "POST", {
      text: "Shared a Dub Pack: Night sessions", packId: "pack", confirmPackAccess: true,
    }));
  });

  it("loads saved drafts and filters Dub versus Sample Packs", async () => {
    const sample = { ...pack, id: "sample", kind: "sample", title: "Drums" };
    mocks.request.mockImplementation(async (path: string) => path === "/api/packs/sample" ? { pack: sample } : { packs: [pack, sample] });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()} onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    await screen.findByRole("heading", { name: "Drums" });
    fireEvent.change(screen.getByLabelText("Pack type filter"), { target: { value: "sample" } });
    expect(screen.queryByRole("heading", { name: pack.title })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    expect(screen.getByRole("article", { name: "Sample Pack: Drums" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(await screen.findByLabelText("Pack type")).toHaveValue("sample");
  });

  it("explains empty filtered pack results and clears the filters", async () => {
    mocks.request.mockResolvedValue({ packs: [pack] });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()} onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    await screen.findByRole("heading", { name: pack.title });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search packs" }), { target: { value: "nothing" } });
    expect(screen.getByRole("heading", { name: "No matching packs" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("heading", { name: pack.title })).toBeVisible();
  });

  it("prevents adding duplicate or incompatible dubs from the pack picker", async () => {
    mocks.request.mockResolvedValue({ packs: [pack, { ...pack, id: "private", title: "Private pack", distribution: "private", items: [] }] });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback} pendingDub={dub}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()} onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Already in pack" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add selected dub" })).toBeDisabled();
    expect(screen.getByText("This pack has an incompatible media type or audience.")).toBeVisible();
  });
});
