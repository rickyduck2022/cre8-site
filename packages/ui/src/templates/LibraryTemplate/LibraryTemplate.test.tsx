import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryTemplate } from "./LibraryTemplate";

afterEach(cleanup);

describe("LibraryTemplate", () => {
  it("lists saved downloads and supports downloading a dub again", () => {
    const onDownload = vi.fn();
    const dub = {
      id: "dub-1", title: "Night Drive", artist: "Amber", uploader: "amber",
      uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z", bpm: 174,
      genre: "Jungle", tags: ["Jungle", "Rollers"], duration: "03:30", likes: 1,
      downloads: 1, artwork: "whitelabel", message: "Fresh dub",
    };
    render(<LibraryTemplate downloads={[{ dub, downloadedAt: "2026-11-02T12:00:00.000Z" }]} onDownload={onDownload} />);
    expect(screen.getByText("Night Drive")).toBeTruthy();
    expect(screen.getByText(/Downloaded/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download again" }));
    expect(onDownload).toHaveBeenCalledWith(dub);
  });
});
