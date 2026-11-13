import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";
import type { Dub } from "./types/domain";
import type { WindowWorkspace } from "./organisms/Window/workspace";

const mocks = vi.hoisted(() => ({ community: vi.fn() }));
vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: null, isSearching: false, error: null }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
vi.mock("../../../apps/web/src/services/packs", async (original) => ({
  ...await original<typeof import("../../../apps/web/src/services/packs")>(), packRequest: vi.fn(async () => ({ packs: [] })),
}));
const dub: Dub = { id: "dub", title: "Tutorial track", artist: "Amber", uploader: "amber", uploaderDisplayName: "Amber",
  uploadedAt: "2026-11-10", duration: "03:00", bpm: 174, genre: "Jungle", likes: 0, downloads: 0, artwork: "", message: "",
  distribution: "worldwide", audioUrl: "/audio/dub", mediaKind: "dub" };
beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    version: 1, desktop: { dismissed: true, completed: [] }, mobile: { dismissed: true, completed: [] },
  }))));
  window.history.replaceState(null, "", "/#dubs");
  mocks.community.mockReturnValue({
    loading: false, notifications: [], activeNotifications: [], unreadCount: 0,
    logout: vi.fn(), notify: vi.fn(), togglePlayback: vi.fn(), playPack: vi.fn(), addDub: vi.fn(), sendMessage: vi.fn(), sendPackMessage: vi.fn(),
    state: {
      member: { id: "me", username: "amber", displayName: "Amber", genre: "Jungle" },
      artists: [], library: [], dubs: [dub], packs: [], sharedDubIds: new Set(), likedDubIds: new Set(),
      nowPlayingId: null, queuePackId: null, buddies: [], suggestedMembers: [], conversations: [],
    },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });
async function help() {
  fireEvent.click(screen.getByRole("button", { name: "Account menu for Amber" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Help & tutorials" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Start Meet your music" })).not.toBeDisabled());
}
it("launches Help from the real account menu and guides actual collection navigation", async () => {
  render(<App />);
  await help();
  expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  expect(window.location.hash).toBe("#dubs");
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  await waitFor(() => expect(window.location.hash).toBe("#my-dubs"));
  fireEvent.click(screen.getByRole("button", { name: "Open Your Dubs" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(window.location.hash).toBe("#shared-with-me");
  fireEvent.click(screen.getByRole("button", { name: "Skip Dubs journey" }));
  expect(window.location.hash).toBe("#samples");
  fireEvent.click(screen.getByRole("button", { name: "Explore Samples" }));
  expect(screen.getByRole("heading", { name: "Samples: explore the vault" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await waitFor(() => expect(window.location.hash).toBe("#shared-with-me"));
});
it.each([false, true])("advances naturally from real search and filter actions (mobile=%s)", async (mobile) => {
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Find and play" }));
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  expect(within(guide).getByRole("button", { name: "Next step" })).toBeDisabled();
  const search = screen.getByRole("searchbox", { name: "Search tracks, artists, tags, or genres" });
  fireEvent.change(search, { target: { value: "  " } });
  expect(within(guide).queryByLabelText("Complete")).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "Amber" } });
  expect(within(guide).getAllByLabelText("Complete")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear search text" }));
  expect(within(guide).getByRole("status")).toHaveTextContent("Step complete!");
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "Choose filters, then apply" })).toBeVisible(), { timeout: 2500 });
  fireEvent.change(await screen.findByRole("spinbutton", { name: "Minimum BPM" }), { target: { value: "200" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum BPM" }), { target: { value: "100" } });
  expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
  expect(within(guide).getByRole("button", { name: "Next step" })).toBeDisabled();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum BPM" }), { target: { value: "250" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(within(guide).getByRole("status")).toHaveTextContent("Step complete!");
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "Play without losing your place" })).toBeVisible(), { timeout: 2500 });
  expect(mocks.community.mock.results.at(-1)?.value.togglePlayback).not.toHaveBeenCalled();
});
it.each([false, true])("completes the music lesson through its actual required controls (mobile=%s)", async (mobile) => {
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  for (const [label, vault, owned, shared] of [
    ["Dubs", "dubs", "my-dubs", "shared-with-me"],
    ["Samples", "samples", "my-samples", "shared-samples"],
    ["Vocals", "vocals", "my-vocals", "shared-vocals"],
  ]) {
    await waitFor(() => expect(within(guide).getByRole("heading", { name: `${label}: explore the vault` })).toBeVisible(), { timeout: 2500 });
    expect(window.location.hash).toBe(`#${vault}`);
    expect(within(guide).getByRole("button", { name: "Next step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: `Explore ${label}` }));
    fireEvent.click(screen.getByRole("tab", { name: label, exact: true }));
    fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
    await waitFor(() => expect(within(guide).getByRole("heading", { name: `${label}: your uploads` })).toBeVisible(), { timeout: 2500 });
    expect(window.location.hash).toBe(`#${owned}`);
    fireEvent.click(screen.getByRole("button", { name: `Open Your ${label}` }));
    const uploads = screen.getByRole("group", { name: `Your ${label} view` });
    fireEvent.click(within(uploads).getByRole("button", { name: label }));
    fireEvent.click(within(uploads).getByRole("button", { name: "Packs" }));
    await waitFor(() => expect(within(guide).getByRole("heading", { name: `${label}: shared with you` })).toBeVisible(), { timeout: 2500 });
    expect(window.location.hash).toBe(`#${shared}`);
    fireEvent.click(screen.getByRole("button", { name: `Open shared ${label}` }));
  }
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible(), { timeout: 2500 });
  expect(fetch).toHaveBeenCalledWith("/api/onboarding", expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"lessonId":"media"') }));
}, 20000);
it.each([false, true])("follows vault changes throughout search and filters instead of ignoring their actions (mobile=%s)", async (mobile) => {
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.history.replaceState(null, "", "/#samples");
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Find and play" }));
  expect(window.location.hash).toBe("#samples");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search samples, artists, tags, or genres" }), { target: { value: "Sample" } });
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  expect(within(guide).getAllByLabelText("Complete")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Vocals menu" }));
  fireEvent.click(screen.getAllByRole("link", { name: "Vocal Vault" })[0]);
  expect(await screen.findByRole("searchbox", { name: "Search vocals, artists, tags, or genres" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear search text" }));
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "Choose filters, then apply" })).toBeVisible(), { timeout: 2500 });
  expect(window.location.hash).toBe("#vocals");
  fireEvent.click(await screen.findByRole("button", { name: "Cancel", exact: true }));
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "Play without losing your place" })).toBeVisible(), { timeout: 2500 });
  expect(window.location.hash).toBe("#vocals");
  expect(screen.getByRole("tab", { name: "Vocals", exact: true })).toHaveAttribute("aria-selected", "true");
});
it("offers an explicit recovery when leaving the supported collection", async () => {
  window.history.replaceState(null, "", "/#samples");
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Find and play" }));
  fireEvent.click(screen.getAllByRole("link", { name: "My Uploads" })[0]);
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  expect(within(guide).getByRole("status")).toHaveTextContent("outside this step's collection");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search your uploads" }), { target: { value: "Unrelated" } });
  expect(within(guide).queryByLabelText("Complete")).not.toBeInTheDocument();
  fireEvent.click(within(guide).getByRole("button", { name: "Return to this step" }));
  expect(window.location.hash).toBe("#samples");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search samples, artists, tags, or genres" }), { target: { value: "Relevant" } });
  expect(within(guide).getAllByLabelText("Complete")).toHaveLength(1);
});
it("counts a requested file opening and minimizing/restoring that same window without playing", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Open an available file" }));
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "Minimized is not closed" })).toBeVisible(), { timeout: 2500 });
  const track = screen.getByRole("dialog", { name: "Track: Tutorial track" });
  fireEvent.click(within(track).getByRole("button", { name: /Minimize Track:/ }));
  expect(within(guide).getAllByLabelText("Complete")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Restore Track: Tutorial track", exact: true }));
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "A draft is a working setup" })).toBeVisible(), { timeout: 2500 });
  expect(mocks.community.mock.results.at(-1)?.value.togglePlayback).not.toHaveBeenCalled();
});
it("requires a successful file upload rather than form edits or a failed submission", async () => {
  const initial = mocks.community();
  const addDub = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(dub);
  mocks.community.mockReturnValue({ ...initial, addDub, state: { ...initial.state, artists: [{ id: "artist", name: "Amber" }] } });
  const file = new File(["audio"], "tutorial.wav", { type: "audio/wav" });
  vi.stubGlobal("FormData", class {
    get(name: string) { return ({ title: "Tutorial track", artistId: "artist", audioFile: file } as Record<string, unknown>)[name] ?? ""; }
  });
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Upload and organise" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  fireEvent.change(screen.getByRole("textbox", { name: "Track title" }), { target: { value: "Only an edit" } });
  expect(within(guide).getByRole("button", { name: "Next step" })).toBeDisabled();
  const form = document.querySelector(".dub-upload-form")!;
  fireEvent.submit(form);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be shared");
  expect(within(guide).getByRole("button", { name: "Next step" })).toBeDisabled();
  fireEvent.submit(form);
  await waitFor(() => expect(within(guide).getByRole("status")).toHaveTextContent("Step complete!"));
  await waitFor(() => expect(within(guide).getByRole("heading", { name: "Build a pack" })).toBeVisible(), { timeout: 2500 });
  expect(addDub).toHaveBeenCalledTimes(2);
  expect(initial.sendMessage).not.toHaveBeenCalled();
});
it("does not satisfy an upload choice when the user cancels discarding their current edits", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    render(<App />);
    await help();
    fireEvent.click(screen.getByRole("button", { name: "Start Upload and organise" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Track title" }), { target: { value: "Keep my edit" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Release format" }), { target: { value: "pack" } });
    expect(confirm).toHaveBeenCalled();
    const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
    expect(within(guide).getByRole("button", { name: "Next step" })).toBeDisabled();
    expect(within(guide).queryByLabelText("Complete")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue("Keep my edit");
    confirm.mockReturnValue(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Media type" }), { target: { value: "vocal" } });
    expect(within(guide).getByRole("status")).toHaveTextContent("Step complete!");
  } finally { confirm.mockRestore(); }
});
it.each([false, true])("waits for the named workspace checkpoint persistence result (failure=%s)", async (failure) => {
  const initial = mocks.community();
  let release!: () => void;
  let reject!: (error: Error) => void;
  const acknowledgement = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
  const save = vi.fn(async (_owner: string, layout: WindowWorkspace) => {
    if (layout.workspaces?.some((entry) => entry.title === "Tutorial studio")) await acknowledgement;
  });
  mocks.community.mockReturnValue({ ...initial, saveWindowWorkspace: save });
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  for (let index = 0; index < 3; index++) fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  const explorer = screen.getByRole("navigation", { name: "Workspace Explorer" });
  fireEvent.click(within(explorer).getByRole("button", { name: "Enable Explorer" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New workspace name" }), { target: { value: "Tutorial studio" } });
  fireEvent.submit(screen.getByRole("form", { name: "Create workspace" }));
  await waitFor(() => expect(save.mock.calls.some(([, layout]) => layout.workspaces?.some((entry) => entry.title === "Tutorial studio"))).toBe(true));
  expect(within(guide).getByRole("button", { name: "Finish walkthrough" })).toBeDisabled();
  await act(async () => { if (failure) reject(new Error("Workspace save unavailable.")); else release(); });
  if (failure) {
    await waitFor(() => expect(initial.notify).toHaveBeenCalledWith("Workspace save unavailable.", "error"));
    expect(within(guide).getByRole("button", { name: "Finish walkthrough" })).toBeDisabled();
    expect(within(guide).queryByLabelText("Complete")).not.toBeInTheDocument();
  } else {
    await waitFor(() => expect(within(guide).getByRole("status")).toHaveTextContent("Step complete!"));
  }
});
it("opens a real file window only on request, without playing audio", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  expect(screen.queryByRole("dialog", { name: "Track: Tutorial track" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open an available file" }));
  const track = await screen.findByRole("dialog", { name: "Track: Tutorial track" });
  expect(within(track).getByRole("heading", { name: "Track: Tutorial track" })).toBeVisible();
  expect(mocks.community.mock.results.at(-1)?.value.togglePlayback).not.toHaveBeenCalled();
});
it("offers safe skips when no accessible file exists", async () => {
  const initial = mocks.community();
  mocks.community.mockReturnValue({ ...initial, state: { ...initial.state, dubs: [] } });
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Open an available file" }));
  expect(initial.notify).toHaveBeenCalledWith("No accessible file is available yet. You can skip this step and return later.", "info");
  expect(screen.getByRole("button", { name: "Skip step" })).toBeVisible();
});
it("opens only the upload chooser and never submits or shares from the guide", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Upload and organise" }));
  expect(await screen.findByRole("dialog", { name: "Upload" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open Upload chooser" }));
  expect(await screen.findByRole("dialog", { name: "Upload" })).toBeVisible();
  const community = mocks.community.mock.results.at(-1)?.value;
  expect(community.addDub).not.toHaveBeenCalled();
  expect(community.sendMessage).not.toHaveBeenCalled();
  expect(community.sendPackMessage).not.toHaveBeenCalled();
});
it("keeps collection, filter UI and guide navigation synchronized without applying filter drafts", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Find and play" }));
  expect(screen.getByRole("heading", { name: "Search a collection" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  const minimum = await screen.findByRole("spinbutton", { name: "Minimum BPM" });
  fireEvent.change(minimum, { target: { value: "120" } });
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(screen.getByRole("heading", { name: "Play without losing your place" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Apply filters" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByRole("spinbutton", { name: "Minimum BPM" })).toHaveValue(120);
  expect(mocks.community.mock.results.at(-1)?.value.togglePlayback).not.toHaveBeenCalled();
});
it("reveals workspace controls without saving, discarding or playing", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(screen.getByRole("heading", { name: "A draft is a working setup" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open Workspace Explorer" }));
  expect(await screen.findByRole("navigation", { name: "Workspace Explorer" })).toBeVisible();
  expect(mocks.community.mock.results.at(-1)?.value.togglePlayback).not.toHaveBeenCalled();
});
it.each([false, true])("routes A-List guidance to the accessible page and counts its explicit action (approved=%s)", async (approved) => {
  const initial = mocks.community();
  mocks.community.mockReturnValue({ ...initial, state: { ...initial.state, member: { ...initial.state.member, aListApproved: approved } } });
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Share with the right people" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(window.location.hash).toBe(approved ? "#alist" : "#alist-application");
  const guide = screen.getByRole("complementary", { name: "Tutorial guide" });
  expect(within(guide).getByRole("region", { name: "Next action" })).toHaveTextContent("Visit A-List or its application page");
  fireEvent.click(within(guide).getByRole("button", { name: "Explore A-List" }));
  expect(within(guide).getByRole("status")).toHaveTextContent("Step complete!");
});
it("preserves upload edits across Next, Back and returning to the same step", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Upload and organise" }));
  const title = await screen.findByRole("textbox", { name: "Track title" });
  fireEvent.change(title, { target: { value: "Keep my unsaved upload" } });
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue("Keep my unsaved upload");
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  await waitFor(() => expect(window.location.hash).toBe("#my-samples"));
  expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue("Keep my unsaved upload");
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(screen.getByRole("button", { name: "Return to this step" }));
  expect(screen.getByRole("textbox", { name: "Track title" })).toHaveValue("Keep my unsaved upload");
  expect(mocks.community.mock.results.at(-1)?.value.addDub).not.toHaveBeenCalled();
});
it("reveals mobile search and filters as the guide advances and restores search on Back", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Find and play" }));
  expect(screen.getByRole("button", { name: /^Search and filters/ })).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(await screen.findByRole("button", { name: "Apply filters" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("button", { name: "Apply filters" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Search and filters/ })).toHaveAttribute("aria-expanded", "true");
});
it("closes only a clean tutorial-opened upload when moving on to pack browsing", async () => {
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Upload and organise" }));
  expect(await screen.findByRole("dialog", { name: "Upload" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  await waitFor(() => expect(window.location.hash).toBe("#my-samples"));
  expect(screen.queryByRole("dialog", { name: "Upload" })).not.toBeInTheDocument();
});
it("never auto-closes a pre-existing user-opened upload", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  expect(await screen.findByRole("dialog", { name: "Upload" })).toBeVisible();
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Upload and organise" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(window.location.hash).toBe("#my-samples");
  expect(screen.getByRole("dialog", { name: "Upload" })).toBeVisible();
});
it("keeps the checklist and next lesson accessible after mobile workspace guidance", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<App />);
  await help();
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Workspace Explorer" }));
  expect(await screen.findByRole("dialog", { name: "Workspace Explorer" })).toHaveClass("workspace-explorer-sheet--tutorial");
  fireEvent.click(screen.getByRole("button", { name: "Skip lesson" }));
  expect(screen.getByRole("dialog", { name: "Workspace Explorer" })).toHaveClass("workspace-explorer-sheet--tutorial");
  fireEvent.click(screen.getByRole("button", { name: "Start Find and play" }));
  expect(screen.queryByRole("dialog", { name: "Workspace Explorer" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(await screen.findByRole("dialog", { name: "Filter dubs" })).toHaveClass("modal--non-modal");
  fireEvent.click(screen.getByRole("button", { name: "Hide guide" }));
  expect(screen.getByRole("dialog", { name: "Filter dubs" })).toHaveClass("modal--non-modal");
  fireEvent.click(screen.getByRole("button", { name: "Show guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip lesson" }));
  expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
});
