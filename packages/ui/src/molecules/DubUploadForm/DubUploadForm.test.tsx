import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DubUploadForm } from "./DubUploadForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DubUploadForm", () => {
  it("keeps the form open and disabled while sharing, then resets on success", async () => {
    let finishSubmission: (result: boolean) => void = () => undefined;
    const file = new File(["audio"], "track.wav", { type: "audio/wav" });
    vi.stubGlobal("FormData", class {
      get(name: string) {
        const values: Record<string, FormDataEntryValue | null> = {
          title: "New track",
          artistId: "artist-1",
          genre: "",
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
    }));
  });
});
