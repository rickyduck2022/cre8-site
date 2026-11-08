import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AListApplication } from "../../../apps/web/src/components/AListApplication";
import { AListReviews } from "../../../apps/admin/src/AListReviews";
import type { AListApplication as Application, AListApplicationFields } from "./templates/communityTypes";

afterEach(cleanup);

const fields: AListApplicationFields = {
  artistName: "Artist", roles: ["DJ"], djExperience: "10 years", producerExperience: "",
  events: ["Event"], supporters: [], labels: [],
  social: {
    instagram: { url: "https://instagram.com/artist", followers: 123 },
    tiktok: { url: "https://tiktok.com/artist", followers: null }, facebook: { url: "https://facebook.com/artist", followers: null },
    soundcloud: { url: "", followers: null },
  },
  additionalInfo: "",
};
const application: Application = {
  id: "app", userId: "user", status: "pending", createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z", versions: [{ fields, submittedAt: "2026-01-01T00:00:00Z" }], decisions: [],
};

describe("A-List application workflow", () => {
  it("collects roles and unverified social counts and submits them", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AListApplication artistName="Artist" application={null} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "DJ" }));
    fireEvent.change(screen.getByLabelText("How long have you been DJing?"), { target: { value: "10 years" } });
    fireEvent.change(screen.getByLabelText("Instagram profile URL"), { target: { value: "https://instagram.com/artist" } });
    fireEvent.change(screen.getByLabelText("TikTok profile URL"), { target: { value: "https://tiktok.com/artist" } });
    fireEvent.change(screen.getByLabelText("Facebook profile URL"), { target: { value: "https://facebook.com/artist" } });
    fireEvent.change(screen.getByLabelText("Instagram followers (optional, unverified)"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      artistName: "Artist", roles: ["DJ"], djExperience: "10 years",
      social: expect.objectContaining({ instagram: { url: "https://instagram.com/artist", followers: 123 } }),
    })));
    expect(screen.getByText("Follower counts are self-reported and unverified.")).toBeVisible();
  });

  it("shows a request for information and preloads the prior submission", () => {
    const requested: Application = { ...application, status: "more_information", decisions: [{ action: "request_information", note: "Add an event", administrator: "admin", administratorId: "admin", decidedAt: "2026-01-02T00:00:00Z" }] };
    render(<AListApplication artistName="Artist" application={requested} onSubmit={vi.fn()} />);
    expect(screen.getByText("Status: More information requested")).toBeVisible();
    expect(screen.getByText("Admin message: Add an event")).toBeVisible();
    expect(screen.getByLabelText("Event or brand 1")).toHaveValue("Event");
    expect(screen.getByRole("button", { name: "Resubmit application" })).toBeVisible();
  });

  it("reviews details and requires a message before requesting more information", async () => {
    const request = vi.fn().mockImplementation((path: string) => Promise.resolve(path.endsWith("/members")
      ? { members: [] } : { applications: [{ ...application, username: "artist", displayName: "Artist", approved: false }] }));
    render(<AListReviews request={request} />);
    fireEvent.click(await screen.findByRole("button", { name: /Artist.*@artist/i }));
    expect(screen.getByText(/123 followers \(self-reported, unverified\)/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Request more information" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the information");
    fireEvent.change(screen.getByLabelText("Message to artist (required when requesting information)"), { target: { value: "Tell us more" } });
    fireEvent.click(screen.getByRole("button", { name: "Request more information" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/admin/alist/applications/app/decision", {
      method: "POST", body: JSON.stringify({ action: "request_information", note: "Tell us more" }),
    }));
  });
});
