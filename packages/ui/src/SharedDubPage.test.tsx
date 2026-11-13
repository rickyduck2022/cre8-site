import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../apps/web/src/App";
import { SharedDubPage } from "../../../apps/web/src/components/SharedDubPage";
import { externalDubUrl, returnToSharedDub, sharedDubHash } from "../../../apps/web/src/services/externalDubLinks";
import type { Dub } from "./types/domain";

const mocks = vi.hoisted(() => ({ community: vi.fn() }));
vi.mock("../../../apps/web/src/app/App", () => ({
  App: () => { mocks.community(); return <main>Community sign-in</main>; },
}));

class FakeAudio extends EventTarget {
  static latest: FakeAudio;
  dataset: Record<string, string> = {};
  preload = "";
  volume = 1;
  loop = false;
  paused = true;
  currentTime = 0;
  duration = 180;
  readyState = 1;
  src = "";
  constructor() { super(); FakeAudio.latest = this; }
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
}

const dub: Dub = {
  id: "shared-one", title: "Shared track", artist: "Meladee", uploader: "meladee",
  uploaderDisplayName: "Meladee", uploadedAt: "2026-01-01", bpm: 140,
  genre: "Garage", duration: "03:00", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "", distribution: "worldwide",
  audioUrl: "/api/public/dubs/shared-one/audio",
};
const metadata = (authenticated = false) => new Response(JSON.stringify({
  dub: {
    ...dub, previewSeconds: 60,
    duration: authenticated ? "03:00" : "01:00",
    audioUrl: authenticated ? "/api/dubs/shared-one/audio" : dub.audioUrl,
  },
  authenticated,
}), { status: 200 });

beforeEach(() => {
  vi.stubGlobal("Audio", FakeAudio);
  window.history.replaceState(null, "", "/");
  mocks.community.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("external dub sharing", () => {
  it.each([30, 60, 90])("distinguishes a short file's playable duration from its %i-second preview cap", async (previewSeconds) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      dub: { ...dub, duration: "00:08", previewSeconds }, authenticated: false,
    }))));
    render(<SharedDubPage dubId={dub.id} />);
    const player = await screen.findByRole("region", { name: `Audio player: ${dub.title}` });
    expect(within(player).getByText("00:08")).toBeVisible();
    expect(screen.getByRole("region", { name: "Preview limitations" })).toHaveTextContent(`First ${previewSeconds} seconds maximum`);
    expect(screen.queryByText(`${previewSeconds}-second preview`)).not.toBeInTheDocument();
  });

  it("identifies shared vocals, keeps the vocal player and explains reuse rights", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      dub: { ...dub, mediaKind: "vocal", previewSeconds: 60 }, authenticated: true,
    }))));
    render(<SharedDubPage dubId={dub.id} />);
    expect(await screen.findByRole("heading", { name: dub.title })).toBeVisible();
    expect(screen.getByRole("region", { name: "Shared vocal", exact: true })).toBeVisible();
    expect(screen.getByText("Shared from the Vocal Vault")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download vocal", exact: true })).toBeVisible();
    expect(screen.getByRole("region", { name: "Audio player: Shared track" })).toHaveClass("media-kind--vocal");
    expect(screen.getByText(/Download access does not grant reuse rights/)).toBeVisible();
  });

  it("loads the public route without the community and reuses play, seek, volume and cleanup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(metadata());
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", sharedDubHash(dub.id));
    const { unmount } = render(<App />);
    expect(await screen.findByRole("heading", { name: dub.title })).toBeVisible();
    expect(mocks.community).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Preview limitations" })).toHaveTextContent("First 60 seconds maximum");
    expect(screen.getByText("256 kbps WAV")).toBeVisible();
    expect(screen.getByText(/16 kHz/)).toBeVisible();
    expect(screen.getByText("Sign in for full-length, original-quality playback and downloads.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in to listen in full" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Previous track" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next track" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /shuffle|repeat/i })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(FakeAudio.latest.src).toBe(dub.audioUrl);
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
    act(() => FakeAudio.latest.dispatchEvent(new Event("loadedmetadata")));
    const waveform = screen.getByRole("slider", { name: "Shared track playback progress" });
    vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({ left: 0, width: 100 } as DOMRect);
    fireEvent.click(waveform, { clientX: 50 });
    expect(FakeAudio.latest.currentTime).toBe(90);
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "30" } });
    expect(FakeAudio.latest.volume).toBe(0.3);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(FakeAudio.latest.paused).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(FakeAudio.latest.paused).toBe(true);
    expect(FakeAudio.latest.src).toBe("");
  });

  it("sends anonymous download actions to sign-in without requesting a download", async () => {
    const fetchMock = vi.fn().mockResolvedValue(metadata());
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", sharedDubHash(dub.id));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in to download" }));
    await screen.findByText("Community sign-in");
    expect(window.location.hash).toBe("#sign-in?dub=shared-one");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeAudio.latest.src).toBe("");
  });

  it("offers a sign-in return for full listening, and plays the authenticated full-track URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(metadata(true)));
    const { unmount } = render(<SharedDubPage dubId={dub.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in to listen in full" }));
    expect(window.location.hash).toBe("#sign-in?dub=shared-one");
    unmount();
    render(<SharedDubPage dubId={dub.id} />);
    await screen.findByRole("heading", { name: dub.title });
    expect(screen.queryByRole("button", { name: "Sign in to listen in full" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Preview limitations" })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(FakeAudio.latest.src).toBe("/api/dubs/shared-one/audio");
  });

  it("uses the existing authenticated download endpoint once and starts its attachment", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(metadata(true))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
    render(<SharedDubPage dubId={dub.id} />);
    const button = await screen.findByRole("button", { name: "Download dub" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/dubs/shared-one/download", expect.objectContaining({ method: "POST" }));
    await act(async () => finish(new Response(JSON.stringify({ audioUrl: "/api/dubs/shared-one/audio?download=1", audioFileName: "shared.wav" }))));
    expect(await screen.findByText("Download started. Your like is counted once.")).toHaveAttribute("role", "status");
    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.instances[0];
    expect(link.getAttribute("href")).toBe("/api/dubs/shared-one/audio?download=1");
    expect(link.download).toBe("shared.wav");
    expect(button).toBeEnabled();
  });

  it("redirects expired sessions back to sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadata(true))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Sign in" }), { status: 401 })));
    render(<SharedDubPage dubId={dub.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Download dub" }));
    await waitFor(() => expect(window.location.hash).toBe("#sign-in?dub=shared-one"));
  });

  it("shows failed downloads explicitly and permits retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(metadata(true))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Audio unavailable." }), { status: 404 })));
    render(<SharedDubPage dubId={dub.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Download dub" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Audio unavailable.");
    expect(screen.getByRole("button", { name: "Download dub" })).toBeEnabled();
    expect(screen.queryByText(/Download started/)).not.toBeInTheDocument();
  });

  it("shows unavailable links, retries loading, and aborts pending requests on navigation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "This dub is not public." }), { status: 404 }))
      .mockResolvedValueOnce(metadata());
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<SharedDubPage dubId={dub.id} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This dub is not public.");
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: dub.title });
    const options = fetchMock.mock.calls[1][1] as RequestInit;
    unmount();
    expect(options.signal?.aborted).toBe(true);
  });

  it("reports missing IDs and never treats arbitrary URLs as return destinations", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SharedDubPage dubId="" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("missing a dub");
    expect(fetchMock).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "#sign-in?returnTo=https://example.com");
    returnToSharedDub();
    expect(window.location.hash).toBe("#sign-in?returnTo=https://example.com");
    window.history.replaceState(null, "", "#sign-in?dub=a%2Fb%3Fc");
    returnToSharedDub();
    expect(window.location.hash).toBe("#share?dub=a%2Fb%3Fc");
    expect(externalDubUrl("a/b?c")).toBe(`${window.location.origin}/#share?dub=a%2Fb%3Fc`);
  });
});
