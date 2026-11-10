import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { App } from "../../../apps/web/src/app/App";

const upload = vi.hoisted(() => ({ addDub: vi.fn() }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({
  useCommunity: () => ({
    loading: false, unreadCount: 0, notifications: [], activeNotifications: [],
    markConversationRead: vi.fn(),
    addDub: upload.addDub,
    state: {
      member: { id: "me", username: "me", displayName: "Me", genre: "Jungle" },
      dubs: [], packs: [], nowPlayingId: null, sharedDubIds: new Set(), likedDubIds: new Set(),
      buddies: [{ id: "friend", username: "amber", displayName: "Amber" }],
      suggestedMembers: [], conversations: [],
    },
  }),
}));
vi.mock("../../../apps/web/src/hooks/useDubSearch", () => ({ useDubSearch: () => ({ results: [] }) }));
vi.mock("../../../apps/web/src/hooks/useMemberSearch", () => ({ useMemberSearch: () => ({ members: [], isSearching: false }) }));
vi.mock("@craft/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@craft/ui")>();
  return {
    ...actual,
    DashboardTemplate: ({ header, navigation, contentOverlay, children }: { header: ReactNode; navigation: ReactNode; contentOverlay: ReactNode; children: ReactNode }) => <main>{header}{navigation}<div className="dashboard-template__content-overlay">{contentOverlay}</div>{children}</main>,
    LatestDubsTemplate: ({ onOpenProfile }: { onOpenProfile: (username: string) => void }) => <button onClick={() => onOpenProfile("amber")}>Open Amber</button>,
    ProfileTemplate: ({ profile, onMessage }: { profile: { username: string }; onMessage: () => void }) => <div>Profile: {profile.username}<button onClick={onMessage}>Message Amber</button></div>,
    MessengerTemplate: ({ initialBuddyId }: { initialBuddyId: string }) => <div>Conversation: {initialBuddyId}</div>,
    DubUploadForm: ({ onSubmit }: ComponentProps<typeof actual.DubUploadForm>) => <button onClick={() => void onSubmit({
      title: "New Dub", artistId: "me", tags: ["Jungle"], message: "", distribution: "worldwide",
    })}>Publish test dub</button>,
  };
});

it("offers a contextual My Dubs shortcut after publishing without changing the feed destination", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  upload.addDub.mockResolvedValue({ id: "new", title: "New Dub", distribution: "worldwide" });
  window.history.replaceState(null, "", "/#dubs");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Share a dub" }));
  fireEvent.click(screen.getByRole("button", { name: "Publish test dub" }));
  expect(await screen.findByRole("region", { name: "Published dub" })).toHaveTextContent("New Dub");
  expect(window.location.hash).toBe("#dubs");
  fireEvent.click(screen.getByRole("button", { name: "View in My Dubs" }));
  expect(window.location.hash).toBe("#my-dubs");
  expect(screen.queryByRole("region", { name: "Published dub" })).not.toBeInTheDocument();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("restores section, profile and conversation destinations through header history", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  window.history.replaceState(null, "", "/#dubs");
  render(<App />);
  const historyNavigation = screen.getByRole("navigation", { name: "Page history" });
  expect(historyNavigation.parentElement).toHaveClass("app-topbar");
  expect(historyNavigation.nextElementSibling).toHaveClass("brand");
  expect(historyNavigation.closest(".app-header-region")).not.toBeNull();
  const back = screen.getByRole("button", { name: "Go back" });
  expect(back).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Open Amber" }));
  expect(window.location.hash).toBe("#profile?user=amber");
  expect(screen.getByText("Profile: amber")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Message Amber" }));
  expect(window.location.hash).toBe("#messenger?buddy=friend");
  expect(screen.getByText("Conversation: friend")).toBeInTheDocument();
  fireEvent.click(back);
  await waitFor(() => expect(screen.getByText("Profile: amber")).toBeInTheDocument());
  fireEvent.click(back);
  await waitFor(() => expect(screen.getByRole("button", { name: "Open Amber" })).toBeInTheDocument());
  window.history.forward();
  await waitFor(() => expect(screen.getByText("Profile: amber")).toBeInTheDocument());
  window.history.forward();
  await waitFor(() => expect(screen.getByText("Conversation: friend")).toBeInTheDocument());
});
