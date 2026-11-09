import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaStatusProvider, type RegisterServiceWorker } from "../../../apps/web/src/components/PwaStatus";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(register: RegisterServiceWorker = vi.fn(() => vi.fn().mockResolvedValue(undefined))) {
  return render(<PwaStatusProvider register={register}>{(status) => <main>{status}</main>}</PwaStatusProvider>);
}

describe("PWA status", () => {
  it("announces offline limitations and clears them after reconnecting", () => {
    setup();
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("status")).toHaveTextContent("Changes are not queued");
    fireEvent(window, new Event("online"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers the browser install prompt and hides it after use", async () => {
    setup();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt, userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument());
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("waits for the user before applying updates", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    const register: RegisterServiceWorker = (options) => {
      queueMicrotask(options.onNeedRefresh);
      return apply;
    };
    setup(register);
    expect(await screen.findByText(/stops playback/)).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Update app" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(true));
  });

  it("reports installation and update failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const register: RegisterServiceWorker = (options) => {
      queueMicrotask(options.onNeedRefresh);
      return vi.fn().mockRejectedValue(new Error("update failed"));
    };
    setup(register);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockRejectedValue(new Error("install failed")),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    fireEvent(window, event);
    fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("install prompt could not be opened");
    fireEvent.click(await screen.findByRole("button", { name: "Update app" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("update could not be applied"));
  });

  it("reports registration errors instead of claiming offline support", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const register: RegisterServiceWorker = (options) => {
      queueMicrotask(() => options.onRegisterError(new Error("failed")));
      return vi.fn().mockResolvedValue(undefined);
    };
    setup(register);
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline app support could not be enabled");
  });

  it("offers dismissible installation guidance on iOS", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
    setup();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Dismiss install suggestion" })));
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });
});
