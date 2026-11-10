import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Waveform } from "./Waveform";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("Waveform drag seeking", () => {
  function renderSlider(onSeek = vi.fn()) {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "";
      }
    });
    render(<Waveform label="Scrub" peaks={[0.5, 0.5]} progress={0.5} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Scrub" });
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({ left: 0, width: 100 } as DOMRect);
    return { slider, onSeek };
  }

  it("scrubs while the pointer is dragged along the waveform and stops on release", () => {
    const { slider, onSeek } = renderSlider();
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 20 });
    expect(onSeek).toHaveBeenLastCalledWith(0.2);
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 60 });
    expect(onSeek).toHaveBeenLastCalledWith(0.6);
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 150 });
    expect(onSeek).toHaveBeenLastCalledWith(1);
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 150 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 10 });
    expect(onSeek).toHaveBeenCalledTimes(3);
  });

  it("ignores hover movement, other pointers and secondary mouse buttons", () => {
    const { slider, onSeek } = renderSlider();
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 40 });
    fireEvent.pointerDown(slider, { pointerId: 1, pointerType: "mouse", button: 2, clientX: 40 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 70 });
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 40 });
    fireEvent.pointerMove(slider, { pointerId: 2, clientX: 90 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenLastCalledWith(0.4);
  });

  it("stops scrubbing when the pointer is cancelled", () => {
    const { slider, onSeek } = renderSlider();
    fireEvent.pointerDown(slider, { pointerId: 3, pointerType: "touch", clientX: 30 });
    fireEvent.pointerCancel(slider, { pointerId: 3 });
    fireEvent.pointerMove(slider, { pointerId: 3, clientX: 80 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenLastCalledWith(0.3);
  });

  it("still seeks on a plain click", () => {
    const { slider, onSeek } = renderSlider();
    fireEvent.click(slider, { clientX: 75 });
    expect(onSeek).toHaveBeenLastCalledWith(0.75);
  });

  it("never scrubs a non-interactive waveform", () => {
    render(<Waveform label="Static" peaks={[0.5, 0.5]} progress={0.5} />);
    const waveform = screen.getByRole("img", { name: "Static" });
    fireEvent.pointerDown(waveform, { pointerId: 1, clientX: 20 });
    fireEvent.pointerMove(waveform, { pointerId: 1, clientX: 60 });
    fireEvent.pointerUp(waveform, { pointerId: 1 });
  });
});

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
