import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TutorialFocus } from "../../../apps/web/src/features/onboarding/TutorialFocus";
import type { TutorialStep } from "./organisms/TutorialGuide/TutorialGuide";
import { onboardingLessons } from "../../../apps/web/src/features/onboarding/lessons";

const step: TutorialStep = { title: "Search", description: "", task: "", focusTargets: [".context"] };
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.dataset.tutorialCompact) return new DOMRect(0, 0, this.dataset.tutorialCompact === "icon" ? 44 : 224, this.dataset.tutorialCompact === "icon" ? 44 : 80);
    return new DOMRect(Number(this.dataset.x ?? 0), Number(this.dataset.y ?? 0), Number(this.dataset.width ?? 0), Number(this.dataset.height ?? 0));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function fixture(active: TutorialStep | null) {
  return <div>
    <aside className="tutorial-guide" data-x="10" data-y="300" data-width="200" data-height="100" />
    <section className="context" data-x="250" data-y="100" data-width="400" data-height="60" />
    <section className="unrelated" data-x="800" data-y="100" data-width="100" data-height="60" />
    <TutorialFocus step={active} />
  </div>;
}
function mask(container: HTMLElement) {
  const overlay = container.querySelector<HTMLElement>(".tutorial-focus");
  expect(overlay).toHaveAttribute("aria-hidden", "true");
  return decodeURIComponent(overlay?.style.maskImage ?? "");
}
it("keeps the guide and contextual components clear without cutting holes for unrelated content", () => {
  const view = render(fixture(step));
  const svg = mask(view.baseElement);
  expect(svg).toContain('x="6" y="296" width="208" height="108"');
  expect(svg).toContain('x="246" y="96" width="408" height="68"');
  expect(svg).not.toContain('x="796"');
  const outlines = view.baseElement.querySelectorAll(".tutorial-focus-outline");
  expect(outlines).toHaveLength(1);
  expect(outlines[0]).toHaveStyle({ left: "246px", top: "96px", width: "408px", height: "68px" });
  view.rerender(fixture(null));
  expect(view.baseElement.querySelector(".tutorial-focus")).toBeNull();
  expect(view.baseElement.querySelector(".tutorial-focus-outlines")).toBeNull();
});
it.each(["dub", "sample", "vocal"])("uses the same rainbow outline for %s contextual UI", (kind) => {
  const view = render(<section className={`media-kind--${kind}`}>
    <div className="context" data-x="100" data-y="100" data-width="200" data-height="100" />
    <TutorialFocus step={step} />
  </section>);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveAttribute("class", "tutorial-focus-outline");
});
it("prefers an open contextual dialog over duplicate page controls and restores the page on close", async () => {
  const view = render(fixture({ ...step, focusTargets: [".context", ".related-control"] }));
  const modal = document.createElement("dialog");
  modal.className = "modal"; modal.open = true;
  Object.assign(modal.dataset, { x: "100", y: "200", width: "500", height: "300" });
  const control = document.createElement("button");
  control.className = "related-control";
  Object.assign(control.dataset, { x: "120", y: "220", width: "100", height: "40" });
  modal.append(control);
  document.body.append(modal);
  try {
    await waitFor(() => expect(mask(view.baseElement)).toContain('x="116" y="216" width="108" height="48"'));
    expect(mask(view.baseElement)).toContain('width="508"');
    expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
    modal.remove();
    await waitFor(() => expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "246px" }));
    const target = view.container.querySelector<HTMLElement>(".context")!;
    target.dataset.x = "300";
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => expect(mask(view.baseElement)).toContain('x="296" y="96" width="408" height="68"'));
    expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
    expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")[0]).toHaveStyle({ left: "296px" });
  } finally { modal.remove(); }
});
it("clips contextual holes to their scroll container", () => {
  const view = render(<div>
    <section style={{ overflow: "auto" }} data-x="100" data-y="100" data-width="200" data-height="200">
      <div className="context" data-x="100" data-y="0" data-width="200" data-height="1000" />
    </section>
    <TutorialFocus step={step} />
  </div>);
  expect(mask(view.baseElement)).toContain('x="96" y="96" width="208" height="208"');
  expect(mask(view.baseElement)).not.toContain('height="1008"');
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ top: "96px", height: "208px" });
});
it("reveals a clipped mobile navigation target once without overriding subsequent user scrolling", async () => {
  const scroll = vi.fn(function (this: HTMLElement) { this.dataset.y = "200"; });
  const view = render(<>
    <dialog open className="floating-window" data-width="320" data-height="568">
      <div style={{ overflow: "auto" }} data-y="72" data-width="320" data-height="493">
        <a className="navigation__item context" href="#vocals" data-x="20" data-y="900" data-width="280" data-height="44"
          ref={(element) => { if (element) element.scrollIntoView = scroll; }}>Vocal Vault</a>
      </div>
    </dialog>
    <TutorialFocus step={{ ...step, focusStrategy: "single" }} />
  </>);
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ top: "196px", height: "52px" });
  view.container.querySelector<HTMLElement>("a")!.dataset.y = "900";
  window.dispatchEvent(new Event("scroll"));
  await waitFor(() => expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(0));
  expect(scroll).toHaveBeenCalledTimes(1);
});
it("clips fixed dialog controls to the dialog scroll area, not the toolbar behind it", () => {
  const view = render(<div style={{ overflow: "auto" }} data-x="0" data-y="300" data-width="320" data-height="100">
    <dialog open style={{ position: "fixed" }} data-width="320" data-height="568">
      <section style={{ overflow: "auto" }} data-x="0" data-y="50" data-width="320" data-height="350">
        <button className="context" data-x="20" data-y="100" data-width="120" data-height="40">Reset</button>
      </section>
    </dialog>
    <TutorialFocus step={step} />
  </div>);
  expect(mask(view.baseElement)).toContain('x="16" y="96" width="128" height="48"');
});
it("portals the overlay across the app and highlights only the relevant navigation controls", () => {
  const view = render(<div style={{ overflow: "hidden", transform: "translateX(20px)" }} data-width="1000" data-height="900">
    <nav className="navigation" data-width="240" data-height="900">
      <div className="navigation__section">
        <button className="navigation__section-toggle" data-x="10" data-y="100" data-width="220" data-height="40">Dubs</button>
        <a href="#dubs" data-x="10" data-y="150" data-width="220" data-height="40">Dub Vault</a>
      </div>
      <a href="#messenger" data-x="10" data-y="500" data-width="220" data-height="40">Messenger</a>
    </nav>
    <TutorialFocus step={{ ...step, focusTargets: ['.navigation a[href="#dubs"]', '.navigation__section-toggle'] }} />
  </div>);
  expect(view.baseElement.querySelector(".tutorial-focus")?.parentElement).toBe(document.body);
  const svg = mask(view.baseElement);
  expect(svg).toContain('x="6" y="96" width="228" height="48"');
  expect(svg).toContain('x="6" y="146" width="228" height="48"');
  expect(svg).not.toContain('height="908"');
  expect(svg).not.toContain('y="496"');
});
it("does not automatically highlight destination navigation, disabled controls or unrelated windows", () => {
  const view = render(<>
    <nav className="navigation"><a href="#dubs" data-x="10" data-y="100" data-width="200" data-height="40">Dubs</a></nav>
    <button className="context" disabled data-x="10" data-y="200" data-width="100" data-height="40">Disabled</button>
    <div inert><button className="context" data-x="10" data-y="300" data-width="100" data-height="40">Inert</button></div>
    <div role="menu" data-x="10" data-y="400" data-width="200" data-height="100">Unrelated</div>
    <TutorialFocus step={{ ...step, journey: { destination: "dubs", surface: "search" } }} />
  </>);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(0);
  expect(mask(view.baseElement)).not.toContain('fill="black"');
});
it.each([false, true])("targets only the next collection tab with or without the mobile header portal (mobile=%s)", (mobile) => {
  const view = render(<div className={mobile ? "collection-header" : "latest-dubs-template"}>
    <div className="vault-view-switch">
      <button role="tab" id="sample-packs" data-x="100" data-y="100" data-width="100" data-height="40">Packs</button>
      <button role="tab" id="sample-files" data-x="200" data-y="100" data-width="100" data-height="40">Samples</button>
    </div>
    <TutorialFocus step={{ ...step, focusTargets: onboardingLessons[0].steps[0].requirements![1].focusTargets }} />
  </div>);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "196px" });
  view.rerender(<div className={mobile ? "collection-header" : "latest-dubs-template"}>
    <div className="vault-view-switch">
      <button role="tab" id="sample-packs" data-x="100" data-y="100" data-width="100" data-height="40">Packs</button>
      <button role="tab" id="sample-files" data-x="200" data-y="100" data-width="100" data-height="40">Samples</button>
    </div>
    <TutorialFocus step={{ ...step, focusTargets: onboardingLessons[0].steps[0].requirements![2].focusTargets }} />
  </div>);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "96px" });
});
it("keeps a control's container sharp but outlines only the selected prominent trigger", () => {
  const view = render(<>
    <div className="dub-card" data-x="100" data-y="100" data-width="300" data-height="300">
      <button className="play" data-x="120" data-y="150" data-width="40" data-height="40">Play</button>
      <button data-x="200" data-y="150" data-width="40" data-height="40">Download</button>
    </div>
    <div className="dub-card" data-x="500" data-y="100" data-width="300" data-height="300">
      <button className="play" data-x="520" data-y="150" data-width="40" data-height="40">Play</button>
    </div>
    <TutorialFocus step={{ ...step, focusTargets: [".play"], focusStrategy: "single" }} />
  </>);
  expect(mask(view.baseElement)).toContain('x="96" y="96" width="308" height="308"');
  expect(mask(view.baseElement)).not.toContain('x="496"');
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "116px", top: "146px" });
});
it("falls back from offscreen primary triggers and reselects when they become visible", async () => {
  const view = render(<>
    <button className="preferred" data-x="100" data-y="-200" data-width="100" data-height="40">Primary</button>
    <button className="fallback" data-x="300" data-y="200" data-width="100" data-height="40">Fallback</button>
    <TutorialFocus step={{ ...step, focusTargets: [".preferred", ".fallback"], focusStrategy: "single" }} />
  </>);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "296px" });
  view.container.querySelector<HTMLElement>(".preferred")!.dataset.y = "100";
  window.dispatchEvent(new Event("scroll"));
  await waitFor(() => expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "96px" }));
});
it("retains distinct form fields while removing equivalent action buttons", () => {
  const view = render(<form data-x="100" data-y="100" data-width="400" data-height="300">
    <input className="context" aria-label="Title" data-x="120" data-y="120" data-width="200" data-height="40" />
    <input className="context" aria-label="Description" data-x="120" data-y="180" data-width="200" data-height="40" />
    <button className="context" data-x="120" data-y="240" data-width="100" data-height="40">Save</button>
    <button className="context" data-x="250" data-y="240" data-width="100" data-height="40">Save</button>
    <TutorialFocus step={step} />
  </form>);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(3);
  expect(mask(view.baseElement)).toContain('x="96" y="96" width="408" height="308"');
});
it("chooses a matching restore trigger, including a group, rather than a different minimized window", () => {
  const view = render(<>
    <button className="restore" data-tutorial-subject="track:other" data-x="100" data-y="100" data-width="100" data-height="40">Restore other</button>
    <button className="restore" data-tutorial-subject="track:other track:paired" data-x="300" data-y="100" data-width="100" data-height="40">Restore group</button>
    <TutorialFocus step={{ ...step, focusTargets: [".restore"], focusStrategy: "single", focusSubject: "track:paired" }} />
  </>);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "296px" });
});
it.each([
  { width: 100, top: "556px" },
  { width: 1024, top: "438px" },
])("places the coach nearest bottom-right without overlapping active controls (target width=$width)", async ({ width, top }) => {
  const view = render(<>
    <aside className="tutorial-guide" style={{ position: "fixed" }} data-x="0" data-y="568" data-width="200" data-height="200" />
    <button className="context" data-x="0" data-y="650" data-width={width} data-height="40">Required action</button>
    <TutorialFocus step={step} />
  </>);
  await waitFor(() => {
    expect(view.container.querySelector<HTMLElement>(".tutorial-guide")!.style.getPropertyValue("--tutorial-left")).toBe("812px");
    expect(view.container.querySelector<HTMLElement>(".tutorial-guide")!.style.getPropertyValue("--tutorial-top")).toBe(top);
    expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  });
});
it("keeps resulting content sharp and outlined after the trigger is no longer required", () => {
  const view = render(<>
    <section className="results" data-x="100" data-y="100" data-width="500" data-height="300">Matching music</section>
    <TutorialFocus step={{ ...step, focusTargets: [], resultTargets: [".results"] }} />
  </>);
  expect(mask(view.baseElement)).toContain('x="96" y="96" width="508" height="308"');
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
});
it("reveals offscreen results within their scroll viewport once without moving input focus", async () => {
  const scroll = vi.fn();
  const view = render(<>
    <input aria-label="Search" />
    <div className="scroll-viewport" style={{ overflow: "auto" }} data-y="100" data-width="300" data-height="200"
      ref={(element) => {
        if (!element) return;
        Object.defineProperty(element, "scrollHeight", { value: 1000 });
        Object.defineProperty(element, "clientHeight", { value: 200 });
        Object.defineProperty(element, "scrollTop", { get: () => 0, set: (value) => {
          scroll(value); element.querySelector<HTMLElement>(".results")!.dataset.y = "100";
        } });
      }}>
      <section className="results" data-y="900" data-width="300" data-height="40">Matches</section>
    </div>
    <TutorialFocus step={{ ...step, focusTargets: [], resultTargets: [".results"] }} />
  </>);
  expect(scroll).toHaveBeenCalledWith(640);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ top: "96px" });
  view.getByRole("textbox").focus();
  view.container.querySelector<HTMLElement>(".results")!.dataset.y = "900";
  window.dispatchEvent(new Event("scroll"));
  await waitFor(() => expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(0));
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(view.getByRole("textbox")).toHaveFocus();
});
it("avoids the whole focused container and result region, not only the next button", () => {
  const view = render(<>
    <aside className="tutorial-guide" style={{ position: "fixed" }} data-width="200" data-height="200" />
    <section className="results" data-x="600" data-y="400" data-width="424" data-height="368">Results</section>
    <div className="dub-card" data-x="400" data-y="400" data-width="200" data-height="368">
      <button className="context" data-x="420" data-y="420" data-width="100" data-height="40">Play</button>
    </div>
    <TutorialFocus step={{ ...step, resultTargets: [".results"] }} />
  </>);
  const guide = view.container.querySelector<HTMLElement>(".tutorial-guide")!;
  expect(guide.style.getPropertyValue("--tutorial-left")).toBe("812px");
  expect(guide.style.getPropertyValue("--tutorial-top")).toBe("188px");
});
it("compacts guidance when the full coach cannot fit beside results", () => {
  const view = render(<>
    <aside className="tutorial-guide" style={{ position: "fixed" }} data-width="368" data-height="400" />
    <section className="results" data-width="1024" data-height="650">Results</section>
    <TutorialFocus step={{ ...step, focusTargets: [], resultTargets: [".results"] }} />
  </>);
  const guide = view.container.querySelector<HTMLElement>(".tutorial-guide")!;
  expect(guide).toHaveAttribute("data-tutorial-compact", "true");
  expect(guide.style.getPropertyValue("--tutorial-top")).toBe("676px");
});
it("requests an explicit pause rather than covering full-screen focused content", () => {
  const pause = vi.fn();
  render(<>
    <aside className="tutorial-guide" style={{ position: "fixed" }} data-width="368" data-height="400" />
    <section className="results" data-width="1024" data-height="768">Results</section>
    <TutorialFocus step={{ ...step, focusTargets: [], resultTargets: [".results"] }} onUnavailableSpace={pause} />
  </>);
  expect(pause).toHaveBeenCalled();
});
it("keeps a fullscreen filter sheet interactive with compact guidance outside its fields and footer", () => {
  const pause = vi.fn();
  const view = render(<>
    <aside className="tutorial-guide" style={{ position: "fixed" }} data-width="368" data-height="300" />
    <dialog open className="modal dub-search__dialog" data-width="1024" data-height="768">
      <header className="modal__header" data-width="1024" data-height="72">
        <button data-x="940" data-y="12" data-width="60" data-height="44">Close</button>
      </header>
      <form className="dub-search__panel">
        <fieldset data-y="80" data-width="1024" data-height="600">
          <input aria-label="Filter" data-x="20" data-y="100" data-width="200" data-height="44" />
        </fieldset>
      </form>
      <footer className="modal__footer" data-y="700" data-width="1024" data-height="68">
        <button data-x="800" data-y="712" data-width="200" data-height="44">Apply</button>
      </footer>
    </dialog>
    <TutorialFocus step={onboardingLessons[1].steps[1]} onUnavailableSpace={pause} />
  </>);
  expect(pause).not.toHaveBeenCalled();
  expect(view.container.querySelector(".tutorial-guide")).toHaveAttribute("data-tutorial-compact", "icon");
  expect(view.container.querySelector<HTMLElement>(".tutorial-guide")!.style.getPropertyValue("--tutorial-left")).toBe("884px");
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(2);
});
it("retains only the interacted window result and keeps it usable", () => {
  const view = render(<>
    <dialog open className="floating-window" data-tutorial-subject="track:other" data-width="300" data-height="300">
      <div className="result" data-width="300" data-height="300">Other window</div>
    </dialog>
    <dialog open className="floating-window" data-tutorial-subject="track:chosen" data-x="400" data-width="300" data-height="300">
      <div className="result" data-x="400" data-width="300" data-height="300">Chosen window</div>
    </dialog>
    <TutorialFocus step={{ ...step, focusTargets: [], resultTargets: [".result"], resultSubject: "track:chosen" }} />
  </>);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  expect(view.baseElement.querySelector(".tutorial-focus-outline")).toHaveStyle({ left: "396px" });
  expect(view.container.querySelector<HTMLElement>('[data-tutorial-subject="track:chosen"]')!.inert).toBe(false);
  expect(view.container.querySelector<HTMLElement>('[data-tutorial-subject="track:other"]')!.inert).toBe(true);
});
it("declares result regions for every guided action, including owned files and the global player", () => {
  for (const lesson of onboardingLessons) {
    for (const current of lesson.steps) {
      for (const requirement of current.requirements ?? []) expect(requirement.resultTargets?.length).toBeGreaterThan(0);
    }
  }
  const view = render(<>
    <div className="dashboard-template__content"><section className="my-dubs-template__list" /></div>
    <section className="audio-player app-player" />
  </>);
  expect(view.container.querySelectorAll(onboardingLessons[0].steps[1].requirements![1].resultTargets!.join(","))).toHaveLength(1);
  expect(view.container.querySelectorAll(onboardingLessons[1].steps[2].requirements![0].resultTargets!.join(","))).toHaveLength(1);
});
it("temporarily makes unrelated floating workspace controls inert without changing their state", () => {
  function content(active: TutorialStep | null) {
    return <>
      <div className="workspace-activity-stack"><button className="workspace-action" data-x="0" data-y="100" data-width="100" data-height="40">Workspaces</button></div>
      <button className="context" data-x="0" data-y="200" data-width="100" data-height="40">Search</button>
      <TutorialFocus step={active} />
    </>;
  }
  const view = render(content(step));
  const stack = view.container.querySelector<HTMLElement>(".workspace-activity-stack")!;
  expect(stack.inert).toBe(true);
  view.rerender(content({ ...step, focusTargets: [".workspace-action"] }));
  expect(stack.inert).toBe(false);
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  view.rerender(content(null));
  expect(stack.inert).toBe(false);
});
it.each(["disabled", "inert", "hidden", "aria-disabled", "aria-hidden"])("updates highlights when a control changes its %s state", async (attribute) => {
  const view = render(<>
    <button className="context" data-x="100" data-y="100" data-width="100" data-height="40">Context action</button>
    <TutorialFocus step={step} />
  </>);
  const control = view.container.querySelector("button")!;
  expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1);
  control.setAttribute(attribute, attribute.startsWith("aria-") ? "true" : "");
  await waitFor(() => expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(0));
  control.removeAttribute(attribute);
  await waitFor(() => expect(view.baseElement.querySelectorAll(".tutorial-focus-outline")).toHaveLength(1));
});
it("prevents unrelated open editors from blocking collection actions and restores their state", () => {
  const content = (active: TutorialStep | null) => <>
    <div className="floating-window" data-testid="editor"><button className="editor-action" data-x="300" data-y="100" data-width="100" data-height="40">Save</button></div>
    <button className="context" data-x="100" data-y="100" data-width="100" data-height="40">Files</button>
    <TutorialFocus step={active} />
  </>;
  const view = render(content(step));
  const editor = view.getByTestId("editor");
  expect(editor.inert).toBe(true);
  view.rerender(content({ ...step, focusTargets: [".editor-action"] }));
  expect(editor.inert).toBe(false);
  view.rerender(content(null));
  expect(editor.inert).toBe(false);
});
it("gives every guide step a concise specific workflow rather than repeating the lesson graphic", () => {
  for (const lesson of onboardingLessons) {
    for (const current of lesson.steps) {
      expect(current.visual?.length).toBe(3);
      expect(current.visual?.every((cue) => cue.label.length > 0)).toBe(true);
    }
    expect(new Set(lesson.steps.map((entry) => JSON.stringify(entry.visual))).size).toBe(lesson.steps.length);
  }
});
it("limits workspace, upload, sharing and community highlights to relevant non-destructive controls", () => {
  const view = render(<>
    <div className="floating-window__header"><button aria-label="Minimize Track: Test" /><button aria-label="Close Track: Test" /></div>
    <button aria-label="Restore Track: Test" /><button aria-label="Restore size" />
    <div className="pack-editor"><input aria-label="Pack title" /><button aria-label="Remove file" />
      <div className="pack-editor__footer"><button>Save draft</button></div></div>
    <div className="dashboard-template__content"><button aria-label="Share file" /><button aria-label="Actions for file" /></div>
    <div className="buddy-list-template"><button aria-label="Add Friend" /><button aria-label="Remove Friend" /><button aria-label="View profile" /></div>
    <div className="friend-lookup"><input aria-label="Lookup" /></div>
    <div className="chat-compose"><input aria-label="Message" /><button>Send message</button></div>
  </>);
  const select = (lesson: number, index: number, requirement?: number) => Array.from(view.container.querySelectorAll(
    (requirement === undefined ? onboardingLessons[lesson].steps[index].focusTargets!
      : onboardingLessons[lesson].steps[index].requirements![requirement].focusTargets!).join(","),
  )).map((element) => element.getAttribute("aria-label") || element.textContent);
  expect(select(2, 1, 0)).toEqual(["Minimize Track: Test"]);
  expect(select(2, 1, 1)).toEqual(["Restore Track: Test"]);
  expect(select(3, 2)).toEqual(["Pack title", "Save draft"]);
  expect(select(4, 1)).toEqual(["Share file"]);
  expect(select(5, 1)).toEqual(["Add Friend", "Lookup"]);
  expect(select(5, 2)).toEqual(["Message", "Send message"]);
});
it("selects only the current lesson's actual controls, not app regions or unrelated navigation", () => {
  const view = render(<>
    <nav className="navigation">
      <a href="#dubs">Brand</a>
      <div className="navigation__section">
        <button className="navigation__section-toggle" aria-expanded="false">Dubs menu</button>
        <a className="navigation__item" href="#dubs">Explore Dubs</a>
      </div>
      <a className="navigation__item" href="#messenger">Messenger</a>
    </nav>
    <div className="collection-header"><div className="dub-search">
      <div className="dub-search__query"><input aria-label="Search tracks" /></div>
      <button className="dub-search__toggle">Filters</button>
    </div></div>
    <div className="dashboard-template__content"><button>Unrelated action</button></div>
    <div className="floating-window"><button>Unrelated editor</button></div>
  </>);
  const select = (lesson: number, index: number) => Array.from(view.container.querySelectorAll(onboardingLessons[lesson].steps[index].focusTargets!.join(",")))
    .map((element) => element.textContent || element.getAttribute("aria-label"));
  expect(select(0, 0)).toEqual(["Dubs menu", "Explore Dubs"]);
  expect(select(1, 0)).toEqual(["Search tracks"]);
  expect(select(1, 1)).toEqual(["Search tracks", "Filters"]);
  for (const lesson of onboardingLessons) {
    for (const current of lesson.steps) {
      for (const element of view.container.querySelectorAll(current.focusTargets!.join(","))) {
        expect(element.matches("button, input, select, textarea, a[href], summary, [role='slider'], [role='tab']")).toBe(true);
      }
    }
  }
});
