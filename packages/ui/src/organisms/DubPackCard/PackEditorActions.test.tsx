import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PackEditorActions } from "./PackEditorActions";

afterEach(cleanup);

it("requires confirmation and supports cancelling without deleting", async () => {
  const remove = vi.fn().mockResolvedValue(undefined);
  render(<PackEditorActions title="Night Sessions" onEdit={vi.fn()} onDelete={remove} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete pack", exact: true }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByText(/Its files remain/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("group", { name: "Confirm pack deletion" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete pack", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete pack" }));
  await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole("group", { name: "Confirm pack deletion" })).not.toBeInTheDocument());
});

it("shows deletion failures and permits a retry", async () => {
  const remove = vi.fn().mockRejectedValueOnce(new Error("Pack could not be deleted.")).mockResolvedValueOnce(undefined);
  render(<PackEditorActions title="Night Sessions" onDelete={remove} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete pack", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete pack" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Pack could not be deleted.");
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete pack" }));
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

it("blocks duplicate submissions and editing until deletion completes", async () => {
  let resolve!: () => void;
  const remove = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  render(<PackEditorActions title="Night Sessions" onEdit={vi.fn()} onDelete={remove} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete pack", exact: true }));
  const confirm = screen.getByRole("button", { name: "Confirm delete pack" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(remove).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();
  expect(screen.getByRole("button", { name: "Edit pack" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => resolve());
});
