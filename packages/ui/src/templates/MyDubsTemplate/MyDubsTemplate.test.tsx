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
  it("uses accessible mobile icon buttons for both upload entry points", () => {
    const share = vi.fn();
    render(<MyDubsTemplate
      dubs={[]} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onPlay={vi.fn()} onShareDub={share} onEditDub={vi.fn()} onDeleteDub={vi.fn()}
    />);
    const buttons = screen.getAllByRole("button", { name: "Share a dub" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveClass("button--hide-label-mobile");
      expect(button.querySelector(".share-dub-icon__mobile svg")).toBeInTheDocument();
      fireEvent.click(button);
    }
    expect(share).toHaveBeenCalledTimes(2);
  });

  it.each(["worldwide", "private", "alist", undefined] as const)(
    "attaches %s statistics directly to the matching card",
    (distribution) => {
      render(<MyDubsTemplate
        dubs={[{ ...dub, distribution }]} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
        onDownload={vi.fn()} onPlay={vi.fn()} onShareDub={vi.fn()} onEditDub={vi.fn()} onDeleteDub={vi.fn()}
      />);
      const summary = screen.getByText("Statistics for Night Drive");
      const details = summary.closest("details")!;
      expect(details).toHaveClass(`my-dubs-template__statistics--${distribution ?? "worldwide"}`);
      expect(details.previousElementSibling).toHaveClass("dub-card");
      expect(details.parentElement?.querySelector(".my-dubs-template__distribution")).toBeNull();
      expect(details).not.toHaveAttribute("open");
      fireEvent.click(summary);
      expect(details).toHaveAttribute("open");
      expect(screen.getByText("Performance")).toBeVisible();
      fireEvent.click(summary);
      expect(details).not.toHaveAttribute("open");
    },
  );
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
    expect(screen.queryByText("Distribution: Private")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke access for Meladee" }));
    expect(onRevokeGrant).toHaveBeenCalledWith("dub-1", "friend");
  });

  it("shows owner statistics with separate download and unique supporter counts", () => {
    const onOpenProfile = vi.fn();
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
      onOpenProfile={onOpenProfile}
    />);
    fireEvent.click(screen.getByText("Statistics for Night Drive"));
    expect(screen.getByText("Downloads")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("Unique Supporters")).toBeVisible();
    expect(screen.getByRole("list", { name: "Supporters of Night Drive" })).toHaveTextContent("Meladee@meladee");
    fireEvent.click(screen.getByRole("button", { name: "View Meladee's profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Meladee @meladee" }));
    expect(onOpenProfile).toHaveBeenCalledTimes(2);
    expect(onOpenProfile).toHaveBeenCalledWith("meladee");
    const statistics = screen.getByText("Performance").closest(".dub-statistics")!;
    expect(statistics.querySelector("dl")).toHaveTextContent("Downloads3Unique Supporters1");
    expect(statistics.querySelector(".dub-statistics__bar")).toBeNull();
    expect(statistics.querySelector(".dub-statistics__chart-column")?.parentElement).toHaveClass("dub-statistics__layout");
    expect(statistics.querySelector(".dub-statistics__people")?.parentElement).toHaveClass("dub-statistics__layout");
  });

  it("distinguishes no supporters from unavailable details and limits the recent list", () => {
    const supporters = Array.from({ length: 7 }, (_, index) => ({
      username: `friend${index}`, displayName: `Friend ${index}`, downloadedAt: "2026-11-01T12:00:00Z",
    }));
    const props = {
      likedDubIds: new Set<string>(), nowPlayingId: null, isPlaying: false,
      onDownload: vi.fn(), onPlay: vi.fn(), onShareDub: vi.fn(), onEditDub: vi.fn(), onDeleteDub: vi.fn(),
    };
    const { rerender } = render(<MyDubsTemplate {...props} dubs={[{ ...dub, downloaders: [] }]} />);
    fireEvent.click(screen.getByText("Statistics for Night Drive"));
    expect(screen.getByText("No supporters yet.")).toBeVisible();
    rerender(<MyDubsTemplate {...props} dubs={[{ ...dub, downloaders: supporters }]} />);
    expect(screen.getByRole("list", { name: "Supporters of Night Drive" }).children).toHaveLength(5);
    expect(screen.getByText("+2 more supporters")).toBeVisible();
    rerender(<MyDubsTemplate {...props} dubs={[{ ...dub, downloaders: undefined }]} />);
    expect(screen.getByText("Supporter details are unavailable.")).toBeVisible();
  });

  it("retains private access guidance when no grants exist", () => {
    render(<MyDubsTemplate
      dubs={[{ ...dub, distribution: "private", grants: [] }]} likedDubIds={new Set()} nowPlayingId={null} isPlaying={false}
      onDownload={vi.fn()} onPlay={vi.fn()} onShareDub={vi.fn()} onEditDub={vi.fn()} onDeleteDub={vi.fn()}
    />);
    fireEvent.click(screen.getByText("Statistics for Night Drive"));
    expect(screen.getByText("No friends currently have access.")).toBeVisible();
    expect(screen.getByText("Revoking access cannot remove files already downloaded.")).toBeVisible();
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
