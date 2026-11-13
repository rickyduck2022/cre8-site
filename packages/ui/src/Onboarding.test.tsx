import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Tutorials } from "../../../apps/web/src/features/onboarding/Tutorials";
import { onboardingLessons } from "../../../apps/web/src/features/onboarding/lessons";
import { TutorialActivityContext, type TutorialActivity } from "@craft/ui";

const empty = () => ({ version: 1, desktop: { dismissed: false, completed: [] as string[] }, mobile: { dismissed: false, completed: [] as string[] } });
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function server() {
  let saved = empty();
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.body) {
      const body = JSON.parse(String(options.body));
      const platform = body.platform === "mobile" ? saved.mobile : saved.desktop;
      platform.dismissed = true;
      if (body.lessonId && !platform.completed.includes(body.lessonId)) platform.completed.push(body.lessonId);
    }
    return new Response(JSON.stringify(saved));
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, get: () => saved, set: (value: ReturnType<typeof empty>) => { saved = value; } };
}
const props = () => ({ ownerId: "me", isOpen: false, onOpenChange: vi.fn(), onAction: vi.fn() });
it("offers welcome once for each platform and reloads saved dismissals", async () => {
  const api = server();
  let mobile = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile, addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  const view = render(<Tutorials {...props()} />);
  expect(await screen.findByRole("region", { name: "Welcome to cre8" })).toHaveTextContent("desktop progress");
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Welcome to cre8" })).not.toBeInTheDocument());
  act(() => { mobile = true; listeners.forEach((listener) => listener()); });
  expect(await screen.findByRole("region", { name: "Welcome to cre8" })).toHaveTextContent("mobile progress");
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  await waitFor(() => expect(api.get().mobile.dismissed).toBe(true));
  view.unmount();
  render(<Tutorials {...props()} />);
  await waitFor(() => expect(api.fetcher).toHaveBeenCalledTimes(4));
  expect(screen.queryByRole("region", { name: "Welcome to cre8" })).not.toBeInTheDocument();
  expect(api.get().desktop.completed).toEqual([]);
});
it("stores a completed lesson with account ownership and allows replay", async () => {
  const api = server();
  const base = props();
  const listeners = new Set<(event: TutorialActivity) => void>();
  const activity = {
    report: (event: TutorialActivity) => listeners.forEach((listener) => listener(event)),
    subscribe: (listener: (event: TutorialActivity) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  const content = (open: boolean) => <TutorialActivityContext.Provider value={activity}><Tutorials {...base} isOpen={open} /></TutorialActivityContext.Provider>;
  const view = render(content(true));
  const start = await screen.findByRole("button", { name: "Start Meet your music" });
  await waitFor(() => expect(start).not.toBeDisabled());
  fireEvent.click(start);
  view.rerender(content(false));
  for (const step of onboardingLessons[0].steps) {
    await waitFor(() => expect(screen.getByRole("heading", { name: step.title })).toBeVisible(), { timeout: 2500 });
    act(() => { for (const requirement of step.requirements ?? []) activity.report(requirement.events[0]); });
  }
  await waitFor(() => expect(api.get().desktop.completed).toEqual(["media"]), { timeout: 2500 });
  const patch = api.fetcher.mock.calls.find(([, options]) => options?.body && JSON.parse(String(options.body)).action === "complete");
  expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ ownerId: "me", platform: "desktop", action: "complete", lessonId: "media" });
  view.rerender(content(true));
  expect(await screen.findByRole("button", { name: "Replay Meet your music" })).toBeVisible();
}, 20000);
it("keeps all six lessons accessible from Help after dismissing the offer", async () => {
  const api = server();
  const saved = empty(); saved.desktop.dismissed = true; api.set(saved);
  render(<Tutorials {...props()} isOpen />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Start Meet your music" })).not.toBeDisabled());
  for (const lesson of onboardingLessons) expect(screen.getByRole("button", { name: `Start ${lesson.title}` })).toBeVisible();
  expect(onboardingLessons.map((lesson) => lesson.id)).toEqual(["media", "browse", "workspace", "upload", "sharing", "community"]);
});
it("shows failed loads and retries without inventing progress", async () => {
  const api = server();
  api.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Offline. Try again." }), { status: 503 }));
  render(<Tutorials {...props()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline. Try again.");
  expect(screen.queryByRole("region", { name: "Welcome to cre8" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry loading tutorials" }));
  expect(await screen.findByRole("region", { name: "Welcome to cre8" })).toBeVisible();
});
it("rejects malformed success responses", async () => {
  const api = server();
  api.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1 })));
  render(<Tutorials {...props()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("invalid tutorial progress");
});
it("retains welcome and permits retry when saving fails", async () => {
  const api = server();
  render(<Tutorials {...props()} />);
  await screen.findByRole("region", { name: "Welcome to cre8" });
  api.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Save unavailable." }), { status: 503 }));
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Save unavailable.");
  expect(api.get().desktop.dismissed).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Welcome to cre8" })).not.toBeInTheDocument());
});
it("aborts pending account requests when the account changes", async () => {
  const api = server();
  api.fetcher.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const base = props();
  const view = render(<Tutorials key="first" {...base} ownerId="first" />);
  const signal = api.fetcher.mock.calls[0][1]?.signal;
  view.rerender(<Tutorials key="second" {...base} ownerId="second" />);
  expect(signal?.aborted).toBe(true);
  expect(await screen.findByRole("region", { name: "Welcome to cre8" })).toBeVisible();
});
