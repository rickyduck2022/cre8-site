import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrackFileMetadata } from "./TrackFileMetadata";

afterEach(cleanup);

describe("TrackFileMetadata", () => {
  it("uses track tags to show the audio format and bitrate", () => {
    render(<TrackFileMetadata audioFileName="mix.mp3" bitrateKbps={320} />);
    expect(screen.getByText("MP3")).toHaveClass("track-tag--audio");
    expect(screen.getByText("320 kbps avg")).toHaveClass("track-tag--neutral");
  });

  it("derives the format from an existing filename when no format is stored", () => {
    render(<TrackFileMetadata audioFileName="release.flac" />);
    expect(screen.getByText("FLAC")).toBeInTheDocument();
    expect(screen.queryByText(/kbps/)).not.toBeInTheDocument();
  });
});
