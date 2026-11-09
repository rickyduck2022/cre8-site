import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/app/App";

const mocks = vi.hoisted(() => ({ community: vi.fn() }));

vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({ useCommunity: mocks.community }));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: [] }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
vi.mock("@craft/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@craft/ui")>();
  return {
    ...actual,
    DashboardTemplate: ({ audioPlayer }: { audioPlayer: React.ReactNode }) => <main>{audioPlayer}</main>,
  };
});

const dub = {
  id: "one", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-01-01", bpm: 174,
  genre: "Jungle", duration: "03:00", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "", audioUrl: "/audio/one", distribution: "worldwide",
};

function community(dubs: typeof dub[], nowPlayingId: string | null) {
  return {
    loading: false,
    unreadCount: 0,
    state: {
      member: { id: "user", username: "amber", displayName: "Amber" },
      dubs, nowPlayingId, isPlaying: false, currentTime: 42, duration: 180,
      sharedDubIds: new Set(), likedDubIds: new Set(), buddies: [], suggestedMembers: [],
    },
  };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("app footer player", () => {
  it("stays empty with no dubs or when dubs have not been played", () => {
    mocks.community.mockReturnValue(community([], null));
    const { rerender } = render(<App />);
    const empty = screen.getByRole("region", { name: "Audio player" });
    expect(empty).toHaveClass("app-player", "audio-player--empty");
    expect(within(empty).getByText("No track loaded")).toBeVisible();
    expect(within(empty).queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    fireEvent.click(within(empty).getByRole("button", { name: "Minimize audio player" }));
    expect(within(empty).getByRole("button", { name: "Expand audio player" })).toBeInTheDocument();
    mocks.community.mockReturnValue(community([dub], null));
    rerender(<App />);
    expect(screen.getByRole("region", { name: "Audio player" })).toHaveClass("audio-player--empty");
    expect(screen.queryByText("Night Drive")).not.toBeInTheDocument();
  });

  it("shows the selected or restored track and returns to empty when unavailable", () => {
    mocks.community.mockReturnValue(community([dub], "one"));
    const { rerender } = render(<App />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("app-player");
    expect(within(player).getByText("00:42")).toBeInTheDocument();
    mocks.community.mockReturnValue(community([], "one"));
    rerender(<App />);
    expect(screen.getByText("No track loaded")).toBeVisible();
  });
});
