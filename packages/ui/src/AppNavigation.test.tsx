import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { App } from "../../../apps/web/src/app/App";

vi.mock("../../../apps/web/src/hooks/useCommunity", () => ({
  useCommunity: () => ({
    loading: false, unreadCount: 0, notifications: [], activeNotifications: [],
    markConversationRead: vi.fn(),
    state: {
      member: { id: "me", username: "me", displayName: "Me", genre: "Jungle" },
      dubs: [], nowPlayingId: null, sharedDubIds: new Set(), likedDubIds: new Set(),
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
    MessengerTemplate: ({ initialBuddyId, onShowConversations }: { initialBuddyId: string; onShowConversations: () => void }) => <div>Conversation: {initialBuddyId}<button onClick={onShowConversations}>Conversation list</button></div>,
  };
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
  fireEvent.click(screen.getByRole("button", { name: "Conversation list" }));
  expect(window.location.hash).toBe("#messenger");
  fireEvent.click(back);
  await waitFor(() => expect(screen.getByText("Conversation: friend")).toBeInTheDocument());
});
