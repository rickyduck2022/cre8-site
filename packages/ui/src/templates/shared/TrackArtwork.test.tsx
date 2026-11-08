import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Dub } from "../communityTypes";
import { TrackArtwork } from "./TrackArtwork";

afterEach(cleanup);

const dub: Dub = {
  id: "dub", title: "Night Drive", artist: "Amber", uploader: "amber",
  uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z",
  bpm: 174, genre: "Jungle", duration: "03:30", likes: 0, downloads: 0,
  artwork: "whitelabel", message: "",
};

describe("TrackArtwork", () => {
  it("shows only the icon on default artwork", () => {
    render(<TrackArtwork dub={dub} />);
    const artwork = screen.getByRole("img", { name: "Night Drive artwork" });
    expect(artwork.querySelector("svg")).toBeInTheDocument();
    expect(artwork).not.toHaveTextContent("WHITELABEL");
  });

  it("retains uploaded artwork and uses the icon if it fails", () => {
    render(<TrackArtwork dub={{ ...dub, artworkUrl: "/artwork.png" }} />);
    const artwork = screen.getByRole("img", { name: "Night Drive artwork" });
    const image = artwork.querySelector("img");
    expect(image).toHaveAttribute("src", "/artwork.png");
    fireEvent.error(image!);
    expect(artwork.querySelector("svg")).toBeInTheDocument();
    expect(artwork).not.toHaveTextContent("WHITELABEL");
  });
});
