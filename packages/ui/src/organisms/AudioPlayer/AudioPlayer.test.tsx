import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPlayer } from "./AudioPlayer";

afterEach(cleanup);

const track = { title: "Night Drive", artist: "Amber" };

describe("AudioPlayer playback indicator", () => {
  it("updates its distribution surface as the track changes", () => {
    const { rerender } = render(<AudioPlayer track={track} distribution="alist" playing />);
    const player = screen.getByRole("region", { name: "Audio player: Night Drive" });
    expect(player).toHaveClass("audio-player--alist");
    rerender(<AudioPlayer track={track} distribution="private" playing={false} />);
    expect(player).toHaveClass("audio-player--private");
    expect(player).not.toHaveClass("audio-player--alist");
    rerender(<AudioPlayer track={track} distribution="worldwide" />);
    expect(player).not.toHaveClass("audio-player--private", "audio-player--alist");
    rerender(<AudioPlayer track={track} />);
    expect(player).not.toHaveClass("audio-player--private", "audio-player--alist");
  });

  it("only shows the indicator while the controlled player is playing", () => {
    const { rerender } = render(<AudioPlayer track={track} playing={false} />);
    expect(screen.queryByRole("status", { name: "Now playing" })).not.toBeInTheDocument();

    rerender(<AudioPlayer track={track} playing />);
    expect(screen.getByRole("status", { name: "Now playing" })).toHaveClass("badge--audio");

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
});
