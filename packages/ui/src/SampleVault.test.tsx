import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";
import type { Dub, DubPack } from "./types/domain";

const mocks = vi.hoisted(() => ({ community: vi.fn(), search: vi.fn() }));
vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: mocks.search }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
beforeAll(() => {
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
      dubs: [dub, sample, standalone, { ...sample, id: "private", title: "Private Sample", distribution: "private" },
        { ...sample, id: "other", title: "Other Artist Sample", uploader: "other" }],
      packs: [pack, { ...pack, id: "samples", title: "Break Toolkit", kind: "sample", items: [{ dub: sample }] }],
      sharedDubIds: new Set(["dub", "sample", "private"]), likedDubIds: new Set(), nowPlayingId: null, queuePackId: null,
      buddies: [], suggestedMembers: [], conversations: [],
    },
  });
  return render(<App />);
}
it("separates the two vaults, navigation counts, cards and search domains", () => {
  setup("#dubs");
  let feed = screen.getByRole("region", { name: "Community uploads" });
  expect(within(feed).getByRole("article", { name: "Dub Pack: Night Dubs" })).toBeVisible();
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

it("groups navigation and scopes Your Samples and Your Dubs to owned media and packs", () => {
  setup("#my-samples");
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const dubs = within(nav).getByRole("link", { name: "Your Dubs" });
  const samples = within(nav).getByRole("link", { name: "Your Samples" });
  expect(dubs).toHaveClass("media-kind--dub");
  expect(samples).toHaveClass("media-kind--sample");
  expect(dubs.closest(".navigation__section")).toHaveTextContent("DubsDub Vault");
  expect(samples.closest(".navigation__section")).toHaveTextContent("SamplesSample Vault");
  expect(samples).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { name: "Your Samples" })).toBeVisible();
  let list = screen.getByRole("region", { name: "Your Samples", exact: true });
  expect(within(list).getByText("Break Slice", { exact: true })).toBeVisible();
  expect(within(list).getByText("Private Sample", { exact: true })).toBeVisible();
  expect(within(list).queryByText("Full Track", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Other Artist Sample", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Sample Pack: Break Toolkit" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Dub Pack: Night Dubs" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search your samples" }), { target: { value: "private" } });
  expect(within(list).queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(dubs);
  expect(window.location.hash).toBe("#my-dubs");
  expect(screen.getByRole("heading", { name: "Your Dubs" })).toBeVisible();
  list = screen.getByRole("region", { name: "Your Dubs", exact: true });
  expect(within(list).getByText("Full Track", { exact: true })).toBeVisible();
  expect(within(list).queryByText("Break Slice", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Dub Pack: Night Dubs" })).toBeVisible();
  expect(screen.queryByRole("article", { name: "Sample Pack: Break Toolkit" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More", exact: true }));
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
  fireEvent.click(screen.getByRole("button", { name: "More", exact: true }));
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
  expect(dubs.closest(".navigation__section")).toHaveTextContent("Your Dubs");
  expect(samples.closest(".navigation__section")).toHaveTextContent("Your Samples");
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
  fireEvent.click(screen.getByRole("button", { name: "More", exact: true }));
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
