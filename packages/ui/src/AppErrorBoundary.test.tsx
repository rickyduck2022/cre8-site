import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../../../apps/web/src/components/AppErrorBoundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("reports render failures and lets the user retry instead of leaving a blank screen", () => {
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Page() {
    if (broken) throw new Error("Render failed");
    return <h1>Recovered page</h1>;
  }
  render(<AppErrorBoundary><Page /></AppErrorBoundary>);
  expect(screen.getByRole("alert")).toHaveTextContent("Unsaved changes may have been lost");
  expect(report).toHaveBeenCalledWith("The application could not render.", expect.any(Error), expect.any(String));
  broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.getByRole("heading", { name: "Recovered page" })).toBeVisible();
});
