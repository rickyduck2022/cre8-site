import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UploadProgress } from "./UploadProgress";

describe("UploadProgress", () => {
  it("shows file name and percentage during upload", () => {
    render(
      <UploadProgress
        progress={{ phase: "uploading", fileName: "track.wav", progress: 45 }}
      />,
    );

    expect(screen.getByText("Uploading track.wav")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Uploading track.wav" }))
      .toHaveAttribute("aria-valuenow", "45");
  });

  it("communicates the publishing stage after transfer", () => {
    render(
      <UploadProgress
        progress={{ phase: "publishing", fileName: "", progress: 100 }}
      />,
    );

    expect(screen.getByText("Publishing your dub")).toBeInTheDocument();
    expect(screen.getByText("Finishing your post and updating the Dub Vault."))
      .toBeInTheDocument();
  });
});
