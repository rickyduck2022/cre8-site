import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "./AudioPlayer";

afterEach(cleanup);

const track = { title: "Night Drive", artist: "Amber" };

describe("AudioPlayer playback indicator", () => {
  it("groups layout actions in one ordered rail independently of playback controls", () => {
    const { rerender } = render(<AudioPlayer track={track} minimized
      dragHandle={<button>Move player</button>} onMinimizedChange={vi.fn()} onClose={vi.fn()}
      positionMenu={<button>Choose position</button>} />);
    const rail = screen.getByRole("group", { name: "Audio player layout controls" });
    expect(within(rail).getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label")))
      .toEqual(["Move player", "Expand audio player", "Choose position", "Close audio player"]);
    expect(rail).not.toContainElement(screen.getByRole("button", { name: "Play", exact: true }));
    rerender(<AudioPlayer track={track} />);
    expect(screen.queryByRole("group", { name: "Audio player layout controls" })).not.toBeInTheDocument();
  });
  it("shows a playback context label without replacing track details or transport", () => {
    render(<AudioPlayer track={track} contextLabel="Playback paused" />);
    expect(screen.getByText("Playback paused")).toBeVisible();
    expect(screen.getByText("Night Drive")).toBeVisible();
    expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
  });
  it.each(["dub", "sample"] as const)("identifies A-List distribution without replacing the %s media palette", (mediaKind) => {
    const { rerender } = render(<AudioPlayer track={track} distribution="alist" mediaKind={mediaKind} contextLabel="Playback paused" />);
    expect(screen.getByText("Playback paused · A-List release")).toBeVisible();
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toHaveClass("audio-player--alist", `media-kind--${mediaKind}`);
    rerender(<AudioPlayer track={track} distribution="alist" mediaKind={mediaKind} />);
    expect(screen.getByText("A-List release")).toBeVisible();
    rerender(<AudioPlayer track={{ ...track, artistAListApproved: true }} distribution="worldwide" mediaKind={mediaKind} />);
    expect(screen.queryByText("A-List release")).not.toBeInTheDocument();
  });
  it.each([false, true])("offers an optional close action (minimized: %s)", (minimized) => {
    const close = vi.fn();
    const play = vi.fn();
    render(<AudioPlayer track={track} minimized={minimized} onClose={close} onPlayChange={play} />);
    const button = screen.getByRole("button", { name: "Close audio player" });
    expect(button).toHaveClass("player-tab");
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(button).not.toHaveTextContent("Close");
    fireEvent.click(button);
    expect(close).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
  });

  it("offers a controlled minimize and expand action without affecting playback", () => {
    const change = vi.fn();
    const play = vi.fn();
    const { rerender } = render(<AudioPlayer track={track} playing onPlayChange={play} minimized={false} onMinimizedChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize audio player", expanded: true }));
    expect(change).toHaveBeenCalledWith(true);
    rerender(<AudioPlayer track={track} playing onPlayChange={play} minimized onMinimizedChange={change} />);
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toHaveClass("audio-player--minimized");
    fireEvent.click(screen.getByRole("button", { name: "Expand audio player", expanded: false }));
    expect(change).toHaveBeenLastCalledWith(false);
    expect(play).not.toHaveBeenCalled();
  });

  it("uses a smooth scalable waveform when minimized and expanded without changing seek behavior", () => {
    const seek = vi.fn();
    const { rerender } = render(<AudioPlayer track={{ ...track, peaks: [0.2, 0.8, 0.4] }} onSeekProgress={seek} currentTimeSeconds={30} durationSeconds={120} minimized />);
    const waveform = screen.getByRole("slider", { name: "Night Drive playback progress" });
    expect(waveform).toHaveAttribute("viewBox", "0 0 256 32");
    expect(waveform).toHaveAttribute("preserveAspectRatio", "none");
    expect(waveform.querySelectorAll("path")).toHaveLength(2);
    expect(waveform.querySelector(".waveform__played")).toHaveAttribute("filter", expect.stringMatching(/^url\(#.+\)$/));
    expect(waveform.querySelector("filter feFlood")).toHaveClass("waveform__shadow-color");
    expect(waveform.querySelector(".waveform__unplayed")).not.toHaveAttribute("filter");
    expect(waveform.querySelector("clipPath rect")).toHaveAttribute("width", "64");
    vi.spyOn(waveform, "getBoundingClientRect").mockReturnValue({ left: 10, width: 80 } as DOMRect);
    fireEvent.click(waveform, { clientX: 50 });
    expect(seek).toHaveBeenCalledWith(0.5);
    fireEvent.keyDown(waveform, { key: "End" });
    expect(seek).toHaveBeenLastCalledWith(1);
    rerender(<AudioPlayer track={{ ...track, peaks: [0.2, 0.8, 0.4] }} onSeekProgress={seek} currentTimeSeconds={60} durationSeconds={120} />);
    const expandedWaveform = screen.getByRole("slider", { name: "Night Drive playback progress" });
    expect(expandedWaveform).toHaveAttribute("viewBox", "0 0 256 32");
    expect(expandedWaveform.querySelectorAll("path")).toHaveLength(2);
    expect(expandedWaveform.querySelector("clipPath rect")).toHaveAttribute("width", "128");
    fireEvent.keyDown(expandedWaveform, { key: "Home" });
    expect(seek).toHaveBeenLastCalledWith(0);
  });

  it.each(["full", "compact", "mini", "docked", "inline"] as const)("uses the smooth waveform in the %s player", (variant) => {
    render(<AudioPlayer track={track} variant={variant} onSeekProgress={vi.fn()} />);
    const waveform = screen.getByRole("slider", { name: "Night Drive playback progress", hidden: true });
    expect(waveform.querySelectorAll("path")).toHaveLength(2);
    expect(waveform).toHaveAttribute("preserveAspectRatio", "none");
  });

  it("supports the opt-in playable color variant independently of layout and distribution", () => {
    const { rerender } = render(<AudioPlayer track={track} colorVariant="playable" distribution="private" variant="inline" />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("audio-player--playable", "audio-player--private", "audio-player--inline");
    rerender(<AudioPlayer track={track} distribution="private" variant="inline" />);
    expect(player).not.toHaveClass("audio-player--playable");
    rerender(<AudioPlayer track={track} variant="mini" />);
    expect(player).not.toHaveClass("audio-player--playable");
    rerender(<AudioPlayer track={track} variant="mini" colorVariant="playable" />);
    expect(player).toHaveClass("audio-player--playable");
  });

  it("supports the controller color variant independently of layout and minimized state", () => {
    const { rerender } = render(<AudioPlayer track={track} colorVariant="controller" variant="inline" minimized />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("audio-player--playable", "audio-player--controller", "audio-player--inline", "audio-player--minimized");
    rerender(<AudioPlayer track={track} colorVariant="controller" variant="full" />);
    expect(player).toHaveClass("audio-player--controller", "audio-player--full");
    expect(player).not.toHaveClass("audio-player--minimized");
    rerender(<AudioPlayer track={track} colorVariant="playable" />);
    expect(player).toHaveClass("audio-player--playable");
    expect(player).not.toHaveClass("audio-player--controller");
  });

  it("updates its distribution surface as the track changes", () => {
    const { rerender } = render(<AudioPlayer track={track} distribution="alist" playing />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("audio-player--alist");
    rerender(<AudioPlayer track={track} distribution="private" playing={false} />);
    expect(player).toHaveClass("audio-player--private");
    expect(player).not.toHaveClass("audio-player--alist");
    rerender(<AudioPlayer track={track} distribution="worldwide" />);
    expect(player).not.toHaveClass("audio-player--private", "audio-player--alist");
    expect(player).toHaveClass("audio-player--worldwide");
    rerender(<AudioPlayer track={track} />);
    expect(player).not.toHaveClass("audio-player--private", "audio-player--alist", "audio-player--worldwide");
  });

  it("only shows the indicator while the controlled player is playing", () => {
    const { rerender } = render(<AudioPlayer track={track} playing={false} />);
    expect(screen.queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveClass("is-playing");

    rerender(<AudioPlayer track={track} playing />);
    expect(screen.getByRole("status", { name: "Now playing" })).toHaveClass("badge--audio");
    expect(screen.getByRole("button", { name: "Pause" })).toHaveClass("is-playing");

    rerender(<AudioPlayer track={track} playing={false} />);
    expect(screen.queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();
  });

  it("follows local play state for uncontrolled players", () => {
    const onPlayChange = vi.fn();
    render(<AudioPlayer track={track} onPlayChange={onPlayChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlayChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("status", { name: "Now playing" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPlayChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();
  });

  it("marks only the playing track, including inline players", () => {
    render(
      <>
        <AudioPlayer track={track} playing={false} />
        <AudioPlayer track={{ title: "Daylight", artist: "Amber" }} playing variant="inline" />
      </>,
    );
    const inactive = screen.getByRole("region", { name: "Audio player: Night Drive" });
    const active = screen.getByRole("region", { name: "Audio player: Daylight" });
    expect(within(inactive).queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();
    expect(within(active).getByRole("status", { name: "Now playing" })).toBeVisible();
  });
  it("renders nothing when no track is provided", () => {
    const change = vi.fn();
    const { rerender } = render(<AudioPlayer variant="full" onMinimizedChange={change} />);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /audio player/i })).not.toBeInTheDocument();
    rerender(<AudioPlayer track={track} />);
    expect(screen.getByRole("region", { name: "Audio player: Night Drive" })).toBeInTheDocument();
    rerender(<AudioPlayer track={null} />);
    expect(screen.queryByRole("region", { name: /Audio player/ })).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
});
it.each(["full", "inline", "mini"] as const)("keeps sample type separate from %s layout, distribution and controller styling", (variant) => {
  const { rerender } = render(<AudioPlayer track={{ title: "Texture", artist: "Amber" }} mediaKind="sample"
    variant={variant} colorVariant="controller" distribution="private" />);
  const player = screen.getByRole("region", { name: "Audio player: Texture" });
  expect(player).toHaveClass("media-kind--sample", "audio-player--controller", "audio-player--private", `audio-player--${variant}`);
  rerender(<AudioPlayer track={{ title: "Texture", artist: "Amber" }} variant={variant} />);
  expect(player).toHaveClass("media-kind--dub");
  expect(player).not.toHaveClass("media-kind--sample", "audio-player--private", "audio-player--controller");
});
