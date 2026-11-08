import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DubUploadForm } from "./DubUploadForm";
import type { Buddy } from "../../templates/communityTypes";

const buddies: Buddy[] = [
  { id: "friend-1", username: "meladee", displayName: "Meladee", presence: "online", genre: "Jungle", role: "DJ", bio: "", groups: [] },
  { id: "friend-2", username: "holik", displayName: "Holik", presence: "offline", genre: "Jungle", role: "DJ", bio: "", groups: [] },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DubUploadForm", () => {
  it("allows private and worldwide uploads but reserves A-List for approved members", () => {
    const props = { artists: [{ id: "artist-1", name: "Artist" }], onCancel: vi.fn(), onSubmit: vi.fn() };
    const { rerender } = render(<DubUploadForm {...props} />);
    expect(screen.getByRole("combobox", { name: "Distribution" })).toHaveValue("worldwide");
    expect(screen.getByRole("option", { name: /Private/ })).toBeEnabled();
    expect(screen.getByRole("option", { name: /A-List/ })).toBeDisabled();
    rerender(<DubUploadForm {...props} aListApproved />);
    expect(screen.getByRole("option", { name: /A-List/ })).toBeEnabled();
  });

  it("submits the selected private distribution", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const file = new File(["audio"], "secret.wav", { type: "audio/wav" });
    vi.stubGlobal("FormData", class {
      constructor(private form: HTMLFormElement) {}
      get(name: string) {
        if (name === "audioFile") return file;
        const field = this.form.elements.namedItem(name);
        return field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement
          ? field.value : null;
      }
    });
    const { container } = render(<DubUploadForm artists={[{ id: "artist-1", name: "Artist" }]} buddies={buddies} initialBuddyIds={["friend-1"]} onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Track title"), { target: { value: "Secret dub" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Distribution" }), { target: { value: "private" } });
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Holik/ }));
    expect(screen.getByText("2 friends selected")).toBeVisible();
    fireEvent.submit(container.querySelector("form")!);
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Secret dub", distribution: "private", buddyIds: ["friend-1", "friend-2"] }));
  });

  it("only offers friends for private uploads and preserves private selection when changing distribution", () => {
    render(<DubUploadForm artists={[{ id: "artist-1", name: "Artist" }]} buddies={buddies} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("searchbox", { name: "Search friends" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Distribution" }), { target: { value: "private" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Meladee/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Distribution" }), { target: { value: "worldwide" } });
    expect(screen.queryByRole("searchbox", { name: "Search friends" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Distribution" }), { target: { value: "private" } });
    expect(screen.getByRole("checkbox", { name: /Meladee/ })).toBeChecked();
  });

  it("explains that a private upload can be shared later if there are no friends", () => {
    render(<DubUploadForm artists={[{ id: "artist-1", name: "Artist" }]} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Distribution" }), { target: { value: "private" } });
    expect(screen.getByText(/No friends yet/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Share dub" })).toBeEnabled();
  });

  it("keeps the form open and disabled while sharing, then resets on success", async () => {
    let finishSubmission: (result: boolean) => void = () => undefined;
    const file = new File(["audio"], "track.wav", { type: "audio/wav" });
    vi.stubGlobal("FormData", class {
      get(name: string) {
        const values: Record<string, FormDataEntryValue | null> = {
          title: "New track",
          artistId: "artist-1",
          bpm: "",
          message: "",
          audioFile: file,
          artworkFile: null,
        };
        return values[name] ?? null;
      }
    });
    const onSubmit = vi.fn(() => new Promise<boolean>((resolve) => {
      finishSubmission = resolve;
    }));
    const { container } = render(
      <DubUploadForm
        artists={[{ id: "artist-1", name: "Artist" }]}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        uploadProgress={{ phase: "uploading", fileName: "track.wav", progress: 24 }}
      />,
    );

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Uploading track.wav")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sharing dub" })).toBeDisabled();
    expect(container.querySelector("fieldset")).toBeDisabled();
    await act(async () => finishSubmission(true));
    await screen.findByRole("button", { name: "Share dub" });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: "New track",
      audioFile: file,
      tags: [],
    }));
  });

  it("supports selecting multiple predefined track tags", () => {
    const { container } = render(
      <DubUploadForm artists={[{ id: "artist-1", name: "Artist" }]} onCancel={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.querySelector(".dub-upload-form__field--bpm input")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jump Up" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));
    expect(screen.getByRole("button", { name: "Jump Up" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Jungle" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".tag-selector__options button[aria-pressed='true']")).toHaveLength(2);
  });
});
