import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackEditor } from "../../../apps/web/src/components/PackEditor";
import { PackView } from "../../../apps/web/src/components/PackView";
import { PackWorkspace } from "../../../apps/web/src/components/PackWorkspace";
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

describe("Pack editor", () => {
  it("advances instead of publishing when the details form is submitted", () => {
    const { container } = render(<PackEditor {...editorProps} />);
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("heading", { name: "Add tracks" })).toBeVisible();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("shows a clear empty search and reviews pending uploads before publication", () => {
    render(<PackEditor {...editorProps} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your uploads" }), { target: { value: "missing" } });
    expect(screen.getByText("No uploads match your search.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Upload audio files"), { target: { files: [new File(["audio"], "New.wav")] } });
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    expect(screen.getByText(/1 file still needs uploading/)).toBeVisible();
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

  it("switches pack type without uploading again and requires explicit sample usage terms", async () => {
    render(<PackEditor {...editorProps} />);
    fireEvent.change(screen.getByLabelText("Pack type"), { target: { value: "sample" } });
    expect(screen.getByLabelText(/Usage licence/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish pack" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provide usage licence terms");
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
    fireEvent.click(screen.getByRole("button", { name: "Upload files (2)" }));
    await screen.findByText("1 file upload failed. Successful files are saved; retry only failed files.");
    expect(screen.getByText("Uploaded")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish pack" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload or remove all pending and failed files");
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry failed uploads (1)" }));
    await screen.findByText("All files uploaded and saved.");
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload.mock.calls[2][0].name).toBe("Again.wav");
  });

  it("requires confirmation before published private additions reach existing recipients", async () => {
    const privateDub = { ...dub, distribution: "private" as const };
    const other = { ...privateDub, id: "two", title: "New private dub" };
    const privatePack: Pack = { ...pack, status: "published", distribution: "private", items: [{ dub: privateDub }], grants: [{ id: "holik", username: "holik", displayName: "Holik" }] };
    render(<PackEditor {...editorProps} pack={privatePack} dubs={[privateDub, other]} />);
    fireEvent.click(screen.getByRole("button", { name: "2. Add files" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /New private dub/ }));
    fireEvent.click(screen.getByRole("button", { name: "3. Arrange & review" }));
    expect(screen.getByRole("button", { name: "Save & publish" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Grant existing pack recipients/ }));
    expect(screen.getByRole("button", { name: "Save & publish" })).not.toBeDisabled();
  });
});

describe("Pack viewing and discovery", () => {
  const props = { pack: { ...pack, status: "published" as const }, authenticated: true, owner: true, playback,
    onPlay: vi.fn(), onPlayAll: vi.fn(), onSeek: vi.fn(), onVolume: vi.fn(), onDownloadDub: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined), onEdit: vi.fn() };
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

  it("keeps draft card playback and downloads disabled", () => {
    render(<PackView {...props} pack={pack} />);
    const card = screen.getByRole("article", { name: "Night Drive" });
    expect(within(card).getByRole("button", { name: "Play" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Download · Like" })).toBeDisabled();
    expect(within(card).queryByRole("slider", { name: "Night Drive playback progress" })).not.toBeInTheDocument();
  });

  it("plays files in pack order and offers a manual clipboard fallback", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    render(<PackView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Play all" }));
    expect(props.onPlayAll).toHaveBeenCalledWith([dub]);
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
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/api/packs/pack/share", "POST", { buddyIds: ["new"], confirmNewAccess: true }));
  });

  it("loads saved drafts and filters Dub versus Sample Packs", async () => {
    mocks.request.mockResolvedValue({ packs: [pack, { ...pack, id: "sample", kind: "sample", title: "Drums" }] });
    render(<PackWorkspace username="amber" approved dubs={[dub]} artists={artists} buddies={[]} playback={playback}
      onPlay={vi.fn()} onPlayAll={vi.fn()} onSeek={vi.fn()} onVolume={vi.fn()} onDownloadDub={vi.fn()} onCommunityChange={vi.fn()} />);
    await screen.findByRole("heading", { name: "Drums" });
    fireEvent.change(screen.getByLabelText("Pack type filter"), { target: { value: "sample" } });
    expect(screen.queryByRole("heading", { name: pack.title })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    expect(screen.getByRole("article", { name: "Sample Pack: Drums" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.getByLabelText("Pack type")).toHaveValue("sample");
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
    expect(screen.getByText("This pack has a different audience.")).toBeVisible();
  });
});
