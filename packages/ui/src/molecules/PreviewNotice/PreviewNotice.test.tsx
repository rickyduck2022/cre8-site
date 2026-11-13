import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PreviewNotice } from "./PreviewNotice";

afterEach(cleanup);

it.each([30, 60, 90])("explains the %i-second cap independently of the preview's actual bitrate and quality", (seconds) => {
  render(<PreviewNotice seconds={seconds} />);
  const notice = screen.getByRole("region", { name: "Preview limitations" });
  expect(notice).toHaveTextContent(`First ${seconds} seconds maximum`);
  expect(notice).toHaveTextContent("Reduced-quality preview");
  expect(notice).toHaveTextContent("256 kbps WAV");
  expect(notice).toHaveTextContent("16 kHz");
  expect(notice).toHaveTextContent("mono");
  expect(notice).toHaveTextContent("Sign in for full-length, original-quality playback and downloads.");
  expect(notice).not.toHaveTextContent("lower bitrate");
});

it("explains mixed preview limits and the original's access requirements to uploaders", () => {
  render(<PreviewNotice sharing />);
  const notice = screen.getByRole("region", { name: "Preview limitations" });
  expect(notice).toHaveTextContent("Each file is shortened to its preview length");
  expect(notice).toHaveTextContent("Signed-in listeners with access");
});
