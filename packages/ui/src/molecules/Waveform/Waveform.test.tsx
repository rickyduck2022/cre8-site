import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Waveform } from "./Waveform";

afterEach(cleanup);

describe("Waveform inset shadow", () => {
  it("only shades played bars when enabled and gives each waveform its own filter", () => {
    render(
      <>
        <Waveform label="First" peaks={[0.5, 0.5]} progress={0.5} insetShadow />
        <Waveform label="Second" peaks={[0.5, 0.5]} progress={0.5} insetShadow />
        <Waveform label="Default" peaks={[0.5, 0.5]} progress={0.5} />
      </>,
    );
    const first = screen.getByRole("img", { name: "First" });
    const second = screen.getByRole("img", { name: "Second" });
    const defaultWaveform = screen.getByRole("img", { name: "Default" });
    const firstFilter = first.querySelector("filter")?.id;
    const secondFilter = second.querySelector("filter")?.id;
    expect(firstFilter).toBeTruthy();
    expect(firstFilter).not.toBe(secondFilter);
    expect(first.querySelector(".waveform__played")).toHaveAttribute("filter", `url(#${firstFilter})`);
    expect(first.querySelector(".waveform__unplayed")).not.toHaveAttribute("filter");
    expect(defaultWaveform.querySelector("filter")).toBeNull();
    expect(defaultWaveform.querySelector(".waveform__played")).not.toHaveAttribute("filter");
  });
});
