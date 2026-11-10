import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditProfileForm } from "./EditProfileForm";

afterEach(cleanup);

describe("EditProfileForm", () => {
  it("edits multiple links without reading a released event and preserves existing custom data", () => {
    const submit = vi.fn();
    render(<StrictMode><EditProfileForm
      profile={{ displayName: "Amber", role: "DJ", bio: "", genre: "Liquid, Jungle", links: [{ label: "Artist store", url: "https://example.com/store" }] }}
      onCancel={vi.fn()} onSubmit={submit}
    /></StrictMode>);
    fireEvent.change(screen.getByLabelText("SoundCloud"), { target: { value: "https://soundcloud.com/amber" } });
    fireEvent.change(screen.getByLabelText("Spotify"), { target: { value: "https://open.spotify.com/artist/amber" } });
    expect(screen.getByLabelText("SoundCloud")).toHaveValue("https://soundcloud.com/amber");
    expect(screen.getByLabelText("Artist store")).toHaveValue("https://example.com/store");
    expect(screen.getByRole("button", { name: "Liquid" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      genre: "Liquid, Jungle",
      links: [
        { label: "SoundCloud", url: "https://soundcloud.com/amber" },
        { label: "Spotify", url: "https://open.spotify.com/artist/amber" },
        { label: "Artist store", url: "https://example.com/store" },
      ],
    }));
  });

  it("only removes an existing custom genre when explicitly deselected", () => {
    const submit = vi.fn();
    render(<EditProfileForm profile={{ displayName: "Amber", role: "", bio: "", genre: "Liquid, Jungle" }} onCancel={vi.fn()} onSubmit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Liquid" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ genre: "Jungle" }));
  });
});
