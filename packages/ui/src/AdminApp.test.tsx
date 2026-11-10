import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminApp } from "../../../apps/admin/src/AdminApp";

const dashboard = {
  generatedAt: "2026-11-10T12:00:00Z",
  administrator: { username: "admin", displayName: "Admin" },
  metrics: { members: 1, tracks: 1, downloads: 4, connections: 0, uploadsThisWeek: 1, membersThisWeek: 1 },
  users: [{ id: "artist", username: "amber", displayName: "Amber", genre: "Jungle", role: "Producer", presence: "offline", createdAt: null, uploads: 1, friends: 0 }],
  dubs: [{ id: "dub", title: "Night Drive", artist: "Amber", uploader: "Amber", username: "amber", uploadedAt: "2026-11-10", genre: "Jungle", tags: [], likes: 1, downloads: 4 }],
  topDubs: [],
  activity: [{ date: "2026-11-10", members: 1, uploads: 1 }],
};

function setup() {
  const fetcher = vi.fn(async (path: string) => ({
    ok: true, json: async () => path === "/api/admin/overview" ? dashboard : { applications: [{ status: "pending" }] },
  }));
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, app: render(<AdminApp />) };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("uses shared navigation and task-oriented entry points with snapshot counts", async () => {
  setup();
  expect(await screen.findByRole("heading", { name: "Your community, in focus." })).toBeVisible();
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).getByRole("link", { name: /A-List reviews/ })).toHaveTextContent("1");
  expect(screen.getByRole("region", { name: "Administration tasks" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Browse members" }));
  expect(window.location.hash).toBe("#members");
  expect(screen.getByRole("heading", { name: "Members" })).toBeVisible();
  expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/#profile?user=amber");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "missing" } });
  expect(screen.getByRole("heading", { name: "No members found" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(screen.getByText("Amber", { exact: true })).toBeVisible();
  fireEvent.click(within(nav).getByRole("link", { name: /Releases/ }));
  expect(screen.getByRole("searchbox", { name: "Search releases" })).toHaveValue("");
  expect(screen.getByText("Night Drive")).toBeVisible();
});

it("restores direct routes and follows hash history changes", async () => {
  window.history.replaceState(null, "", "/#releases");
  setup();
  expect(await screen.findByRole("heading", { name: "Releases" })).toBeVisible();
  window.history.replaceState(null, "", "/#members");
  fireEvent(window, new Event("hashchange"));
  expect(screen.getByRole("heading", { name: "Members" })).toBeVisible();
});

it("retains the dashboard and announces a failed sign-out instead of pretending success", async () => {
  const { fetcher } = setup();
  await screen.findByRole("heading", { name: "Your community, in focus." });
  fetcher.mockImplementation(async () => ({ ok: false, json: async () => ({ error: "Sign-out unavailable." }) }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign-out unavailable.");
  expect(screen.getByRole("heading", { name: "Your community, in focus." })).toBeVisible();
});

it("shows explicit access errors on the sign-in screen", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "This account is not configured as an administrator." }) })));
  render(<AdminApp />);
  expect(await screen.findByRole("alert")).toHaveTextContent("not configured as an administrator");
  expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  await waitFor(() => expect(screen.queryByText("Loading administration...")).not.toBeInTheDocument());
});
