import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPreview } from "./AudioPreview";

afterEach(cleanup);

describe("AudioPreview", () => {
  it("uses the smooth waveform and updates its progress on playback", () => {
    const onPlay = vi.fn();
    const track = { title: "Night Drive", artist: "Amber", peaks: [0.2, 0.8, 0.4] };
    render(<AudioPreview tracks={[track]} onPlay={onPlay} />);

    const waveform = screen.getByRole("img", { name: "Night Drive waveform" });
    expect(waveform).toHaveAttribute("viewBox", "0 0 256 32");
    expect(waveform.querySelectorAll("path")).toHaveLength(2);
    expect(waveform.querySelector("clipPath rect")).toHaveAttribute("width", "30.72");
    fireEvent.click(screen.getByRole("button", { name: "Play Night Drive" }));
    expect(onPlay).toHaveBeenCalledWith(track);
    expect(waveform.querySelector("clipPath rect")).toHaveAttribute("width", "122.88");
  });
});
