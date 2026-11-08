import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyDubsTemplate } from "./MyDubsTemplate";
import type { Dub } from "../communityTypes";

afterEach(cleanup);

const dub: Dub = {
  id: "dub-1", title: "Night Drive", artist: "Amber", artistId: "artist-1",
  uploader: "amber", uploaderDisplayName: "Amber", uploadedAt: "2026-11-01T12:00:00.000Z",
  bpm: 174, genre: "Jungle", tags: ["Jungle", "Rollers"], duration: "03:30",
  likes: 1, downloads: 1, artwork: "whitelabel", message: "Fresh dub",
};

function renderPage() {
  const onEditDub = vi.fn();
  const onDeleteDub = vi.fn();
  render(<MyDubsTemplate
    dubs={[dub]}
    likedDubIds={new Set()}
    nowPlayingId={null}
    isPlaying={false}
    onDownload={vi.fn()}
    onPlay={vi.fn()}
    onShareDub={vi.fn()}
    onEditDub={onEditDub}
    onDeleteDub={onDeleteDub}
  />);
  return { onEditDub, onDeleteDub };
}

describe("MyDubsTemplate", () => {
  it("lets owners revoke private access from a named recipient", () => {
    const onRevokeGrant = vi.fn();
    render(<MyDubsTemplate
      dubs={[{ ...dub, distribution: "private", grants: [{ id: "friend", username: "meladee", displayName: "Meladee" }] }]}
      likedDubIds={new Set()}
      nowPlayingId={null}
      isPlaying={false}
      onDownload={vi.fn()}
      onPlay={vi.fn()}
      onShareDub={vi.fn()}
      onEditDub={vi.fn()}
      onDeleteDub={vi.fn()}
      onRevokeGrant={onRevokeGrant}
    />);
    fireEvent.click(screen.getByText("Statistics for Night Drive"));
    expect(screen.getByText("Distribution: Private")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    expect(onRevokeGrant).toHaveBeenCalledWith("dub-1", "friend");
  });

  it("shows owner statistics with separate download and unique supporter counts", () => {
    render(<MyDubsTemplate
      dubs={[{ ...dub, downloads: 3, likes: 1, downloaders: [{ username: "meladee", displayName: "Meladee", downloadedAt: "2026-11-01T12:00:00Z" }] }]}
      likedDubIds={new Set()}
      nowPlayingId={null}
      isPlaying={false}
      onDownload={vi.fn()}
      onPlay={vi.fn()}
      onShareDub={vi.fn()}
      onEditDub={vi.fn()}
      onDeleteDub={vi.fn()}
    />);
    fireEvent.click(screen.getByText("Statistics for Night Drive"));
    expect(screen.getByText("Manual download requests: 3")).toBeVisible();
    expect(screen.getByText("Unique supporters: 1")).toBeVisible();
    expect(screen.getByRole("list", { name: "Supporters of Night Drive" })).toHaveTextContent("Meladee (@meladee)");
  });

  it("renders the shared dub card and filters the user's tracks", () => {
    renderPage();
    expect(screen.getByText("Night Drive")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Statistics for Night Drive"));
    expect(screen.getByText("Supporter details are unavailable.")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search my dubs" }), { target: { value: "bass" } });
    expect(screen.getByText("No dubs found")).toBeInTheDocument();
  });

  it("passes edit and delete actions to the shared dub management flow", () => {
    const { onEditDub, onDeleteDub } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Actions for Night Drive" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Night Drive" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions for Night Drive" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Night Drive" }));
    expect(onEditDub).toHaveBeenCalledWith(dub);
    expect(onDeleteDub).toHaveBeenCalledWith(dub);
  });
});
