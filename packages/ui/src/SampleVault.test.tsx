import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";
import type { Dub, DubPack } from "./types/domain";

const mocks = vi.hoisted(() => ({ community: vi.fn(), search: vi.fn(), packs: vi.fn() }));
vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: mocks.search }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
vi.mock("../../../apps/web/src/services/packs", async (original) => ({
  ...await original<typeof import("../../../apps/web/src/services/packs")>(), packRequest: mocks.packs,
}));
beforeAll(() => {
  HTMLDialogElement.prototype.show = function () { this.open = true; };
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
const dub: Dub = { id: "dub", title: "Full Track", artist: "Amber", uploader: "amber", uploaderDisplayName: "Amber",
  uploadedAt: "2026-11-10", duration: "03:00", bpm: 174, genre: "Jungle", likes: 0, downloads: 0, artwork: "", message: "",
  distribution: "worldwide", audioUrl: "/audio/dub", mediaKind: "dub" };
const sample: Dub = { ...dub, id: "sample", title: "Break Slice", mediaKind: "sample" };
const vocal: Dub = { ...dub, id: "vocal", title: "Vocal take", mediaKind: "vocal", genre: "Vocal" };
const standalone: Dub = { ...sample, id: "single", title: "Standalone Sample" };
const pack: DubPack = { id: "pack", title: "Night Dubs", description: "", kind: "dub", status: "published",
  distribution: "worldwide", aListPublic: false, licence: "", ownerUsername: "amber", ownerDisplayName: "Amber",
  items: [{ dub }], totalBytes: 1200, createdAt: dub.uploadedAt, updatedAt: dub.uploadedAt };
function setup(hash: string) {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  window.history.replaceState(null, "", `/${hash}`);
  mocks.search.mockReturnValue({ results: null, isSearching: false, error: null });
  mocks.community.mockReturnValue({
    loading: false, notifications: [], activeNotifications: [], unreadCount: 0,
    togglePlayback: vi.fn(), downloadDub: vi.fn(), playPack: vi.fn(), activatePackQueue: vi.fn(() => true),
    state: {
      member: { id: "me", username: "amber", displayName: "Amber", genre: "Jungle" },
      artists: [{ id: "artist", name: "Amber" }], library: [{ dub: vocal, downloadedAt: "2026-11-12" }],
      draftDubs: [{ ...dub, id: "draft-file", title: "Work in progress", distribution: "private" }],
      dubs: [dub, sample, vocal, standalone, { ...sample, id: "private", title: "Private Sample", distribution: "private" },
        { ...sample, id: "other", title: "Other Artist Sample", uploader: "other" }],
      packs: [pack, { ...pack, id: "samples", title: "Break Toolkit", kind: "sample", items: [{ dub: sample }] },
        { ...pack, id: "vocals", title: "Vocal release", kind: "vocal", licence: "Original productions.", items: [{ dub: vocal }] }],
      sharedDubIds: new Set(["dub", "sample", "private", "vocal"]), likedDubIds: new Set(), nowPlayingId: null, queuePackId: null,
      buddies: [], suggestedMembers: [], conversations: [],
    },
  });
  mocks.packs.mockImplementation(async () => ({ packs: mocks.community.mock.results.at(-1)?.value.state.packs }));
  const app = render(<App />);
  expandMenus(screen.getByRole("navigation", { name: "Main navigation" }));
  return app;
}
function expandMenus(container: HTMLElement) {
  for (const toggle of within(container).getAllByRole("button", { name: /menu$/ })) {
    if (toggle.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
  }
}
function openMore() {
  fireEvent.click(screen.getByRole("button", { name: "More", exact: true }));
  expandMenus(screen.getByRole("dialog", { name: "Navigation" }));
}
it("offers My Uploads below the media menus and filters owned files and packs by type", async () => {
  setup("#all-uploads");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const allUploads = within(nav).getByRole("link", { name: "My Uploads", exact: true });
  expect(allUploads).toHaveAttribute("aria-current", "page");
  expect(allUploads.closest(".navigation__items")).not.toHaveClass("navigation__items--nested");
  expect(within(nav).getByRole("link", { name: "Sample Vault", exact: true })).toHaveTextContent("Explore vault");
  expect(within(nav).getByRole("link", { name: "Your Samples", exact: true })).toHaveTextContent("Your uploads");
  const collection = () => screen.getByRole("region", { name: "My Uploads", exact: true });
  for (const title of ["Full Track", "Break Slice", "Vocal take", "Private Sample"]) expect(within(collection()).getByText(title, { exact: true })).toBeVisible();
  expect(within(collection()).queryByText("Other Artist Sample")).not.toBeInTheDocument();
  const selectMedia = (value: string) => {
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Media type", exact: true }), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  };
  selectMedia("vocal");
  expect(within(collection()).getByText("Vocal take", { exact: true })).toBeVisible();
  expect(within(collection()).queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  mocks.packs.mockResolvedValue({ packs: [pack,
    { ...pack, id: "samples", title: "Break Toolkit", kind: "sample" },
    { ...pack, id: "vocals", title: "Vocal release", kind: "vocal" },
    { ...pack, id: "draft", title: "Unpublished work", status: "draft", distribution: "private" },
    { ...pack, id: "received", title: "Someone else's pack", ownerUsername: "other" },
  ] });
  selectMedia("all");
  fireEvent.click(within(screen.getByRole("group", { name: "My Uploads view" })).getByRole("button", { name: "Packs", exact: true }));
  expect(await screen.findByRole("article", { name: "Dub Pack: Night Dubs" })).toBeVisible();
  expect(screen.getByRole("article", { name: "Sample Pack: Break Toolkit" })).toBeVisible();
  expect(screen.getByRole("article", { name: "Vocal Pack: Vocal release" })).toBeVisible();
  expect(screen.getByRole("article", { name: "Dub Pack: Unpublished work" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Someone else's pack" })).not.toBeInTheDocument();
  selectMedia("sample");
  expect(await screen.findByRole("article", { name: "Sample Pack: Break Toolkit" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Night Dubs" })).not.toBeInTheDocument();
  openMore();
  expect(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("link", { name: "My Uploads", exact: true })).toHaveAttribute("href", "#all-uploads");
});

it("starts the upload chooser from My Uploads", () => {
  setup("#all-uploads");
  fireEvent.click(screen.getByRole("button", { name: "Start an upload" }));
  expect(screen.getByRole("dialog", { name: "Upload" })).toBeVisible();
  expect(screen.getByRole("group", { name: "What are you uploading?" })).toBeVisible();
});

it("shows every accessible media type in Full Library without treating tracks as downloads", () => {
  setup("#full-library");
  expect(screen.getByRole("heading", { name: "Full Library" })).toBeVisible();
  const list = screen.getByRole("list", { name: "All accessible tracks" });
  for (const title of ["Full Track", "Break Slice", "Vocal take", "Private Sample", "Other Artist Sample", "Work in progress"]) {
    expect(within(list).getByRole("region", { name: `Audio player: ${title}` })).toBeVisible();
  }
  expect(within(list).queryByText(/^Downloaded /)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  fireEvent.change(screen.getByRole("combobox", { name: "Media type" }), { target: { value: "vocal" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(within(list).getByRole("region", { name: "Audio player: Vocal take" })).toBeVisible();
  expect(within(list).queryByRole("region", { name: "Audio player: Full Track" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Full Library" })).toHaveAttribute("aria-current", "page");
  openMore();
  expect(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("link", { name: "Full Library" })).toHaveAttribute("href", "#full-library");
});

it("opens owned packs in a normal window and plays the exact pack queue from My Uploads", async () => {
  setup("#all-uploads");
  const community = mocks.community.mock.results.at(-1)!.value;
  fireEvent.click(within(screen.getByRole("group", { name: "My Uploads view" })).getByRole("button", { name: "Packs" }));
  const card = await screen.findByRole("article", { name: "Dub Pack: Night Dubs" });
  fireEvent.click(within(card).getByRole("button", { name: "Play pack" }));
  expect(community.activatePackQueue).toHaveBeenCalledWith([dub], pack.id);
  expect(community.playPack).toHaveBeenCalledWith([dub], pack.id);
  fireEvent.click(within(card).getByRole("button", { name: "Open pack" }));
  const opened = await screen.findByRole("dialog", { name: "Dub Pack: Night Dubs" });
  expect(within(opened).getByRole("region", { name: "Night Dubs window player" })).toBeVisible();
  expect(within(opened).queryByLabelText("Pack title")).not.toBeInTheDocument();
});

it("offers Vocal Vault, owned vocals, received vocals, uploads and Library without leaking into other vaults", () => {
  setup("#vocals");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const link = within(nav).getByRole("link", { name: /Vocal Vault/ });
  expect(link).toHaveClass("media-kind--vocal");
  expect(link).toHaveTextContent("1");
  expect(screen.getByRole("heading", { name: "Vocal Vault" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Audio player: Vocal take" })).toHaveClass("media-kind--vocal");
  expect(screen.queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  expect(mocks.search.mock.lastCall?.at(-1)).toBe("vocal");
  fireEvent.click(screen.getByRole("tab", { name: "Packs", exact: true }));
  expect(screen.getByRole("article", { name: "Vocal Pack: Vocal release" })).toBeVisible();
  fireEvent.click(within(nav).getByRole("link", { name: "Your Vocals", exact: true }));
  expect(screen.getByRole("region", { name: "Your Vocals", exact: true })).toHaveTextContent("Vocal take");
  fireEvent.click(screen.getByRole("button", { name: "Add Vocal", exact: true }));
  expect(screen.getByRole("dialog", { name: "Add Vocal", exact: true })).toBeVisible();
  expect(screen.queryByRole("combobox", { name: "Media type" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close Add Vocal", exact: true }));
  fireEvent.click(within(nav).getByRole("link", { name: /Vocals shared with you/ }));
  expect(screen.getByRole("list", { name: "Vocals shared with me" })).toHaveTextContent("Vocal take");
  expect(screen.getByRole("searchbox", { name: "Search vocals, artists, tags, or genres" })).toBeVisible();
  fireEvent.click(within(nav).getByRole("link", { name: /My Library/ }));
  expect(screen.getByRole("region", { name: "Audio player: Vocal take" })).toHaveClass("media-kind--vocal");
  openMore();
  expect(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("link", { name: /Vocal Vault/ })).toHaveAttribute("href", "#vocals");
});

it("filters owned packs by the same member's metadata, includes empty private drafts by default and clears empty results", async () => {
  setup("#all-uploads");
  const tagged = { ...sample, tags: ["Jungle"], bitrateKbps: 128 };
  const untagged = { ...vocal, tags: ["Vocal"], bitrateKbps: 320 };
  mocks.packs.mockResolvedValue({ packs: [
    { ...pack, id: "split", title: "Split criteria", items: [{ dub: tagged }, { dub: untagged }] },
    { ...pack, id: "match", title: "Matching draft", status: "draft", distribution: "private", items: [{ dub: { ...tagged, bitrateKbps: 320 } }] },
    { ...pack, id: "empty", title: "Empty draft", status: "draft", distribution: "private", items: [] },
    { ...pack, id: "other", title: "Other owner", ownerUsername: "someone-else" },
  ] });
  fireEvent.click(screen.getByRole("button", { name: "Packs", exact: true }));
  expect(await screen.findByRole("article", { name: "Dub Pack: Empty draft" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Other owner" })).not.toBeInTheDocument();
  expect(await screen.findByText("3 packs found")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Filters", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Jungle", exact: true }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum Bitrate" }), { target: { value: "300" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(await screen.findByRole("article", { name: "Dub Pack: Matching draft" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Split criteria" })).not.toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "Dub Pack: Empty draft" })).not.toBeInTheDocument();
  expect(await screen.findByText("1 pack found")).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search your uploads" }), { target: { value: "missing" } });
  expect(await screen.findByRole("heading", { name: "No matching packs" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Show all packs" }));
  expect(await screen.findByRole("article", { name: "Dub Pack: Empty draft" })).toBeVisible();
  expect(screen.getByRole("searchbox", { name: "Search your uploads" })).toHaveValue("");
});

it("separates the two vaults, navigation counts, cards and search domains", () => {
  setup("#dubs");
  let feed = screen.getByRole("region", { name: "Community uploads" });
  expect(within(feed).getByText("Full Track", { exact: true })).toBeVisible();
  expect(within(feed).queryByText("Break Toolkit")).not.toBeInTheDocument();
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: /Dub Vault/ })).toHaveTextContent("1");
  const sampleLink = within(nav).getByRole("link", { name: /Sample Vault/ });
  expect(sampleLink).toHaveTextContent("3");
  fireEvent.click(sampleLink);
  expect(window.location.hash).toBe("#samples");
  expect(screen.getByRole("heading", { name: "Sample Vault" })).toBeInTheDocument();
  feed = screen.getByRole("region", { name: "Community uploads" });
  expect(within(feed).getByRole("article", { name: "Sample Pack: Break Toolkit" })).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Samples", exact: true }));
  expect(within(feed).getByRole("region", { name: "Audio player: Standalone Sample" })).toHaveClass("media-kind--sample");
  expect(within(feed).queryByText("Night Dubs")).not.toBeInTheDocument();
  expect(within(feed).queryByText("Private Sample")).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("region", { name: "Search samples" })).getByRole("button", { name: "Filters" }));
  expect(screen.getByText("3 samples found")).toBeVisible();
  expect(mocks.search.mock.lastCall?.at(-1)).toBe("sample");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search samples, artists, tags, or genres" }), { target: { value: "nonexistent" } });
  expect(screen.getByText("No samples found")).toBeVisible();
  expect(mocks.search.mock.lastCall?.[0]).toBe("nonexistent");
});

it("groups navigation and scopes Your Samples and Your Dubs to owned media and packs", async () => {
  setup("#my-samples");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const dubs = within(nav).getByRole("link", { name: "Your Dubs" });
  const samples = within(nav).getByRole("link", { name: "Your Samples" });
  expect(dubs).toHaveClass("media-kind--dub");
  expect(samples).toHaveClass("media-kind--sample");
  expect(dubs.closest(".navigation__section")).toHaveTextContent("DubsExplore vault");
  expect(samples.closest(".navigation__section")).toHaveTextContent("SamplesExplore vault");
  expect(samples).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { name: "Your Samples" })).toBeVisible();
  let list = screen.getByRole("region", { name: "Your Samples", exact: true });
  expect(within(list).getByText("Break Slice", { exact: true })).toBeVisible();
  expect(within(list).getByText("Private Sample", { exact: true })).toBeVisible();
  expect(within(list).queryByText("Full Track", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Other Artist Sample", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Packs", exact: true }));
  expect(await screen.findByRole("article", { name: "Sample Pack: Break Toolkit" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Night Dubs" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Samples", exact: true }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search your samples" }), { target: { value: "private" } });
  expect(within(list).queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(dubs);
  expect(window.location.hash).toBe("#my-dubs");
  expect(screen.getByRole("heading", { name: "Your Dubs" })).toBeVisible();
  list = screen.getByRole("region", { name: "Your Dubs", exact: true });
  expect(within(list).getByText("Full Track", { exact: true })).toBeVisible();
  expect(within(list).queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Packs", exact: true }));
  expect(await screen.findByRole("article", { name: "Dub Pack: Night Dubs" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Sample Pack: Break Toolkit" })).not.toBeInTheDocument();
  openMore();
  fireEvent.click(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("link", { name: "Your Samples" }));
  expect(window.location.hash).toBe("#my-samples");
  expect(screen.getByRole("searchbox", { name: "Search your samples" })).toHaveValue("");
});

it("places both vaults in mobile primary navigation and keeps My Library in More", () => {
  setup("#samples");
  expect(screen.getByRole("heading", { name: "Sample Vault" })).toBeInTheDocument();
  const primary = screen.getByRole("navigation", { name: "Main sections" });
  const samples = within(primary).getByRole("link", { name: /Sample Vault/ });
  expect(samples).toHaveAttribute("href", "#samples");
  expect(samples).toHaveAttribute("aria-current", "page");
  expect(samples).toHaveClass("media-kind--sample");
  expect(within(primary).getByRole("link", { name: /Dub Vault/ })).toHaveClass("media-kind--dub");
  expect(within(primary).queryByRole("link", { name: "My Library" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "More", exact: true })).not.toHaveAttribute("aria-current");
  fireEvent.click(within(primary).getByRole("link", { name: /Dub Vault/ }));
  expect(window.location.hash).toBe("#dubs");
  fireEvent.click(samples);
  expect(window.location.hash).toBe("#samples");
  openMore();
  const menu = screen.getByRole("dialog", { name: "Navigation" });
  expect(within(menu).getByRole("link", { name: "My Library" })).toHaveAttribute("href", "#library");
  expect(within(menu).getByRole("link", { name: /Sample Vault/ })).toHaveAttribute("aria-current", "page");
  fireEvent.click(within(menu).getByRole("link", { name: /Dub Vault/ }));
  expect(window.location.hash).toBe("#dubs");
  expect(mocks.search.mock.lastCall?.at(-1)).toBe("dub");
});

it("separates received dubs and samples, navigation badges, search and mobile routes", () => {
  setup("#shared-samples");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const dubs = within(nav).getByRole("link", { name: /Dubs shared with you/ });
  const samples = within(nav).getByRole("link", { name: /Samples shared with you/ });
  expect(dubs).toHaveTextContent("1");
  expect(samples).toHaveTextContent("2");
  expect(samples).toHaveAttribute("aria-current", "page");
  expect(dubs.closest(".navigation__section")).toHaveTextContent("Your uploads");
  expect(samples.closest(".navigation__section")).toHaveTextContent("Your uploads");
  expect(samples).toHaveClass("media-kind--sample");
  expect(within(nav).getByRole("link", { name: /Dub Vault/ })).toHaveClass("media-kind--dub");
  expect(within(nav).getByRole("link", { name: /Sample Vault/ })).toHaveClass("media-kind--sample");
  expect(screen.getByRole("heading", { name: "Samples shared with you" })).toBeVisible();
  const list = screen.getByRole("list", { name: "Samples shared with me" });
  expect(within(list).getByText("Break Slice", { exact: true })).toBeVisible();
  expect(within(list).getByText("Private Sample", { exact: true })).toBeVisible();
  expect(within(list).queryByText("Full Track", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Standalone Sample", { exact: true })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search samples, artists, tags, or genres" }), { target: { value: "private" } });
  expect(within(list).queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(dubs);
  expect(window.location.hash).toBe("#shared-with-me");
  expect(screen.getByRole("heading", { name: "Dubs shared with you" })).toBeVisible();
  expect(screen.getByRole("list", { name: "Dubs shared with me" })).toHaveTextContent("Full Track");
  expect(screen.queryByText("Private Sample", { exact: true })).not.toBeInTheDocument();
  openMore();
  fireEvent.click(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("link", { name: /Samples shared with you/ }));
  expect(window.location.hash).toBe("#shared-samples");
  expect(screen.getByRole("searchbox", { name: "Search samples, artists, tags, or genres" })).toHaveValue("");
});

it("renders only explicitly received pack cards in the matching shared domain", () => {
  const app = setup("#shared-with-me");
  const data = mocks.community.mock.results.at(-1)?.value;
  mocks.community.mockReturnValue({ ...data, state: { ...data.state, sharedPackIds: new Set(["pack", "samples"]) } });
  app.rerender(<App />);
  expect(screen.getByRole("article", { name: "Dub Pack: Night Dubs" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Sample Pack: Break Toolkit" })).not.toBeInTheDocument();
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  fireEvent.click(within(nav).getByRole("link", { name: /Samples shared with you/ }));
  expect(screen.getByRole("article", { name: "Sample Pack: Break Toolkit" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Night Dubs" })).not.toBeInTheDocument();
});
