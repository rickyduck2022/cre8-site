import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AListApplication } from "../../../apps/web/src/components/AListApplication";
import { AListReviews } from "../../../apps/admin/src/AListReviews";
import type { AListApplication as Application, AListApplicationFields } from "./templates/communityTypes";

afterEach(cleanup);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

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
  it("organizes the application into named sections with accessible role and profile controls", () => {
    render(<AListApplication artistName="Artist" application={null} onSubmit={vi.fn()} />);
    for (const name of ["Artist identity", "Behind the sound", "Your scene", "Find you online", "Anything else?"]) {
      expect(screen.getByRole("region", { name })).toBeVisible();
    }
    expect(screen.getByLabelText("Artist name")).toBeRequired();
    for (const name of ["DJ", "Producer", "DJ & Producer", "MC / Vocalist", "Other"]) {
      expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
    }
    fireEvent.change(screen.getByLabelText("Additional information (optional)"), { target: { value: "Radio resident" } });
    expect(screen.getByText("14 / 2,000")).toBeVisible();
  });

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

  it("submits without optional social URLs, events, supporters or labels", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AListApplication artistName="Artist" application={null} onSubmit={onSubmit} />);
    for (const name of ["events or brands", "supporting artists", "record labels"]) {
      expect(screen.getByRole("group", { name: `Up to three ${name} (optional)` })).toBeVisible();
    }
    expect(screen.getByRole("group", { name: "Social media (optional)" })).toBeVisible();
    for (const provider of ["Instagram", "TikTok", "Facebook", "SoundCloud"]) {
      expect(screen.getByLabelText(`${provider} profile URL`)).not.toBeRequired();
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "DJ" }));
    fireEvent.change(screen.getByLabelText("How long have you been DJing?"), { target: { value: "10 years" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      events: ["", "", ""], supporters: ["", "", ""], labels: ["", "", ""],
      social: {
        instagram: { url: "", followers: null }, tiktok: { url: "", followers: null },
        facebook: { url: "", followers: null }, soundcloud: { url: "", followers: null },
      },
    })));
  });

  it("announces a missing role without submitting and preserves the entered fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AListApplication artistName="Artist" application={null} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("How long have you been DJing?"), { target: { value: "10 years" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one role.");
    expect(screen.getByRole("group", { name: "Roles (select all that apply)" })).toHaveAccessibleDescription("Select at least one role.");
    expect(screen.getByRole("checkbox", { name: "DJ" })).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("How long have you been DJing?")).toHaveValue("10 years");
    fireEvent.click(screen.getByRole("checkbox", { name: "DJ" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it("filters the review queue and confirms rejection before sending a decision", async () => {
    const request = vi.fn().mockImplementation((path: string) => Promise.resolve(path.endsWith("/members")
      ? { members: [] } : { applications: [{ ...application, username: "artist", displayName: "Artist", approved: false }] }));
    render(<AListReviews request={request} />);
    await screen.findByRole("button", { name: /Artist.*@artist/i });
    fireEvent.change(screen.getByLabelText("Application status"), { target: { value: "approved" } });
    expect(screen.getByText("No applications match these filters.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Application status"), { target: { value: "pending" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search applications" }), { target: { value: "unknown" } });
    expect(screen.getByText("No applications match these filters.")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search applications" }), { target: { value: "artist" } });
    fireEvent.click(screen.getByRole("button", { name: /Artist.*@artist/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reject", exact: true }));
    const dialog = screen.getByRole("dialog", { name: "Reject application?" });
    expect(request).not.toHaveBeenCalledWith(expect.stringContaining("/decision"), expect.anything());
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/admin/alist/applications/app/decision", {
      method: "POST", body: JSON.stringify({ action: "reject", note: "" }),
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("confirms legacy member access revocation with the entered message", async () => {
    const request = vi.fn().mockImplementation((path: string) => Promise.resolve(path.endsWith("/members")
      ? { members: [{ id: "legacy", username: "legacy", displayName: "Legacy Artist" }] } : { applications: [] }));
    render(<AListReviews request={request} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke access for Legacy Artist" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(request).not.toHaveBeenCalledWith(expect.stringContaining("/revoke"), expect.anything());
    fireEvent.change(screen.getByLabelText("Revocation message (optional)"), { target: { value: "Access review" } });
    fireEvent.click(screen.getByRole("button", { name: "Revoke access for Legacy Artist" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm revocation" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/admin/alist/members/legacy/revoke", {
      method: "POST", body: JSON.stringify({ note: "Access review" }),
    }));
  });

  it("reloads the visible queue when the admin refreshes data", async () => {
    let updated = false;
    const request = vi.fn().mockImplementation((path: string) => Promise.resolve(path.endsWith("/members")
      ? { members: [] } : { applications: updated ? [{ ...application, username: "artist", displayName: "Artist", approved: false }] : [] }));
    const { rerender } = render(<AListReviews request={request} />);
    expect(await screen.findByText("No applications yet.")).toBeVisible();
    updated = true;
    rerender(<AListReviews request={request} refreshKey={1} />);
    expect(await screen.findByRole("button", { name: /Artist.*@artist/i })).toBeVisible();
  });
});
