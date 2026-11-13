import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TutorialGuide, type TutorialGuideProps, type TutorialLesson } from "./TutorialGuide";
import { TutorialActivityContext, useTutorialActivityChannel, type TutorialActivity } from "../../foundations/TutorialActivityContext";

const lessons: TutorialLesson[] = [{
  id: "media", title: "Meet your music", summary: "Learn the types.",
  steps: [
    { title: "Find a vault", description: "Desktop description", mobileDescription: "Mobile description", task: "Look at the vault.", action: { label: "Go to vault", id: "dubs" } },
    { title: "Files and packs", description: "A pack contains files.", task: "Compare them." },
  ],
}, { id: "workspace", title: "Make a workspace", summary: "Keep your setup.", steps: [{ title: "Drafts", description: "Keep your windows.", task: "Inspect the manager." }] }];
it("keeps the short-screen coach clear of the expanded mobile search controls", () => {
  const css = readFileSync(resolve("src", "organisms", "TutorialGuide", "TutorialGuide.css"), "utf8");
  expect(css).toContain("@media (max-width: 760px) and (max-height: 650px)");
  expect(css).toContain(".tutorial-guide { max-height: 28dvh; }");
  expect(css).toContain(".tutorial-guide__visual { display: none; }");
  expect(css).toContain("max-height: min(45dvh, calc(100% - 2 * var(--spacing-3)), 36rem)");
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup(overrides: Partial<TutorialGuideProps> = {}) {
  const props: TutorialGuideProps = {
    lessons, progress: { dismissed: false, completed: [] }, isOpen: false, onOpenChange: vi.fn(),
    loading: false, busy: false, onRetry: vi.fn(), onDismiss: vi.fn(async () => true),
    onComplete: vi.fn(async () => true), onAction: vi.fn(), ...overrides,
  };
  let report: (event: TutorialActivity) => void;
  function Harness() {
    const channel = useTutorialActivityChannel();
    report = channel.report;
    const [open, setOpen] = useState(props.isOpen);
    return <TutorialActivityContext.Provider value={channel}>
      <TutorialGuide {...props} isOpen={open} onOpenChange={(value) => { props.onOpenChange(value); setOpen(value); }} />
    </TutorialActivityContext.Provider>;
  }
  const view = render(<Harness />);
  return { ...props, report: (event: TutorialActivity) => act(() => report(event)),
    update: (next: Partial<TutorialGuideProps>) => { Object.assign(props, next); view.rerender(<Harness />); } };
}
const interactiveLessons: TutorialLesson[] = [{
  id: "browse", title: "Interactive browsing", summary: "Try actions.",
  steps: [
    { title: "Search naturally", description: "", task: "Type and clear.",
      visual: [{ icon: "search", label: "Query" }, { icon: "music", label: "Matches" }],
      requirements: [
        { label: "Type a search", events: [{ type: "search" }], resultTargets: [".search-results"] },
        { label: "Clear the query", events: [{ type: "search-cleared" }], resultTargets: [".all-results"] },
      ] },
    { title: "Play and pause", description: "", task: "Play and pause the same file.",
      requirements: [
        { label: "Play", events: [{ type: "playback-started" }] },
        { label: "Pause", events: [{ type: "playback-paused" }], sameSubjectAsPrevious: true },
      ] },
  ],
}];
it("shows the step workflow, lesson position and next ordered action without changing completion", () => {
  const props = setup({ lessons: interactiveLessons, isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  expect(screen.getByLabelText("Search naturally workflow")).toHaveTextContent("Query");
  expect(screen.getByLabelText("Search naturally workflow")).toHaveTextContent("Matches");
  expect(screen.getByRole("progressbar", { name: "Lesson position" })).toHaveValue(1);
  expect(screen.getByRole("region", { name: "Next action" })).toHaveTextContent("Type a search");
  expect(screen.getByText("Type a search", { selector: "li span" }).closest("li")).toHaveAttribute("aria-current", "step");
  props.report({ type: "search" });
  expect(screen.getByRole("region", { name: "Next action" })).toHaveTextContent("Clear the query");
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  props.report({ type: "search-cleared" });
  expect(screen.getByRole("region", { name: "Next action" })).toHaveTextContent("Step complete");
});
it("focuses successful action results alongside the next control and retains them during confirmation", () => {
  const onStepChange = vi.fn();
  const props = setup({ lessons: interactiveLessons, isOpen: true, onStepChange });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ resultTargets: [] }));
  props.report({ type: "search-cleared" });
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ resultTargets: [] }));
  props.report({ type: "search" });
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ resultTargets: [".search-results"] }));
  props.report({ type: "search-cleared" });
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ focusTargets: [], resultTargets: [".all-results"] }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ resultTargets: [] }));
});
it("explicitly pauses without losing progress when there is no non-overlapping space", () => {
  const onStepChange = vi.fn();
  const props = setup({ lessons: interactiveLessons, isOpen: true, onStepChange });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  props.report({ type: "search" });
  props.update({ pauseForSpace: true });
  expect(screen.getByRole("heading", { name: "Guide paused to keep your UI clear" })).toBeVisible();
  expect(onStepChange).toHaveBeenLastCalledWith(null);
  props.update({ pauseForSpace: false });
  fireEvent.click(screen.getByRole("button", { name: "Show guide" }));
  expect(screen.getByRole("region", { name: "Next action" })).toHaveTextContent("Clear the query");
});
it("completes ordered requisites from real actions, confirms once and advances without taking input focus", () => {
  vi.useFakeTimers();
  const props = setup({ lessons: interactiveLessons, isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  props.report({ type: "search-cleared" });
  props.report({ type: "navigate", value: "dubs" });
  expect(screen.queryByLabelText("Complete")).not.toBeInTheDocument();
  props.report({ type: "search" });
  expect(screen.getAllByLabelText("Complete")).toHaveLength(1);
  props.report({ type: "search" });
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  props.report({ type: "search-cleared" });
  props.report({ type: "search-cleared" });
  expect(screen.getByRole("status")).toHaveTextContent("Step complete!");
  const input = document.createElement("input");
  document.body.append(input); input.focus();
  try {
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("heading", { name: "Play and pause" })).toBeVisible();
    expect(input).toHaveFocus();
    expect(props.onComplete).not.toHaveBeenCalled();
  } finally { input.remove(); }
});
it("requires the same subject and persists the lesson only after all actions succeed", async () => {
  vi.useFakeTimers();
  const props = setup({ lessons: interactiveLessons, isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  props.report({ type: "search" }); props.report({ type: "search-cleared" });
  act(() => vi.advanceTimersByTime(1000));
  props.report({ type: "playback-started", subjectId: "track-a" });
  props.report({ type: "playback-paused", subjectId: "track-b" });
  expect(screen.getByRole("button", { name: "Finish lesson" })).toBeDisabled();
  props.report({ type: "playback-paused", subjectId: "track-a" });
  await act(async () => vi.advanceTimersByTime(1000));
  expect(props.onComplete).toHaveBeenCalledTimes(1);
  expect(props.onComplete).toHaveBeenCalledWith("browse");
  expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
});
it("uses the latest journey callback when editing changes during the completion confirmation", () => {
  vi.useFakeTimers();
  const initialNavigate = vi.fn();
  const latestNavigate = vi.fn();
  const props = setup({ lessons: interactiveLessons, isOpen: true, onNavigateStep: initialNavigate });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  props.report({ type: "search" }); props.report({ type: "search-cleared" });
  props.update({ onNavigateStep: latestNavigate });
  act(() => vi.advanceTimersByTime(1000));
  expect(initialNavigate).toHaveBeenCalledTimes(1);
  expect(latestNavigate).toHaveBeenCalledWith(interactiveLessons[0].steps[1]);
});
it("highlights only the current requisite and clears highlights during confirmation", () => {
  const onStepChange = vi.fn();
  const props = setup({ isOpen: true, onStepChange, lessons: [{
    ...interactiveLessons[0], steps: [{
      ...interactiveLessons[0].steps[0],
      requirements: [
        { label: "Type", events: [{ type: "search" }], focusTargets: [".query"] },
        { label: "Clear", events: [{ type: "search-cleared" }], focusTargets: [".clear"] },
      ],
    }],
  }] });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ focusTargets: [".query"] }));
  props.report({ type: "search" });
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ focusTargets: [".clear"] }));
  props.report({ type: "search-cleared" });
  expect(onStepChange).toHaveBeenLastCalledWith(expect.objectContaining({ focusTargets: [] }));
});
it("ignores actions while hidden and cancels pending automatic navigation on Back or Skip", () => {
  vi.useFakeTimers();
  const props = setup({ lessons: interactiveLessons, isOpen: true, onNavigateStep: vi.fn() });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  props.report({ type: "search" });
  fireEvent.click(screen.getByRole("button", { name: "Hide guide" }));
  props.report({ type: "search-cleared" });
  act(() => vi.advanceTimersByTime(2000));
  fireEvent.click(screen.getByRole("button", { name: "Show guide" }));
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  props.report({ type: "search-cleared" });
  fireEvent.click(screen.getByRole("button", { name: "Skip lesson" }));
  act(() => vi.advanceTimersByTime(2000));
  expect(props.onComplete).not.toHaveBeenCalled();
  expect(props.onNavigateStep).toHaveBeenCalledTimes(2);
});
it("does not turn skipped action steps into a completed lesson", async () => {
  vi.useFakeTimers();
  const props = setup({ lessons: interactiveLessons, isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  props.report({ type: "playback-started", subjectId: "track-a" });
  props.report({ type: "playback-paused", subjectId: "track-a" });
  await act(async () => vi.advanceTimersByTime(1000));
  expect(props.onComplete).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
});
it("retains completed actions on a save failure and supports retry without repeating real mutations", async () => {
  vi.useFakeTimers();
  const onComplete = vi.fn(async () => false);
  const props = setup({ lessons: [ { ...interactiveLessons[0], steps: [interactiveLessons[0].steps[0]] } ], isOpen: true, onComplete, error: "Save failed." });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  props.report({ type: "search" }); props.report({ type: "search-cleared" });
  await act(async () => vi.advanceTimersByTime(1000));
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert")).toHaveTextContent("Save failed.");
  fireEvent.click(screen.getByRole("button", { name: "Finish lesson" }));
  await act(async () => {});
  expect(onComplete).toHaveBeenCalledTimes(2);
});
it("resets action completion when replaying the same lesson", async () => {
  vi.useFakeTimers();
  const props = setup({ lessons: [{ ...interactiveLessons[0], steps: [interactiveLessons[0].steps[0]] }], isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  props.report({ type: "search" }); props.report({ type: "search-cleared" });
  await act(async () => vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole("button", { name: "Start Interactive browsing" }));
  expect(screen.getByRole("button", { name: "Finish lesson" })).toBeDisabled();
  props.report({ type: "search" });
  expect(screen.getAllByLabelText("Complete")).toHaveLength(1);
});
it("offers an optional welcome and dismisses without starting any actions", async () => {
  const props = setup();
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  await waitFor(() => expect(props.onDismiss).toHaveBeenCalledOnce());
  expect(props.onAction).not.toHaveBeenCalled();
  expect(props.onComplete).not.toHaveBeenCalled();
});
it("opens a replayable checklist only after acknowledging the welcome", async () => {
  const props = setup();
  fireEvent.click(screen.getByRole("button", { name: "Get started" }));
  expect(await screen.findByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
  expect(props.onDismiss).toHaveBeenCalledOnce();
  expect(screen.getByText(/0 of 2 complete/)).toBeVisible();
});
it("retains the welcome when dismiss persistence fails", async () => {
  setup({ onDismiss: vi.fn(async () => false), error: "Save failed." });
  fireEvent.click(screen.getByRole("button", { name: "Get started" }));
  await waitFor(() => expect(screen.getByRole("region", { name: "Welcome to cre8" })).toBeVisible());
  expect(screen.queryByRole("dialog", { name: "Help & tutorials" })).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Save failed.");
});
it("guides real actions only on explicit request and supports back, collapse and completion", async () => {
  const props = setup({ isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  const coach = screen.getByRole("complementary", { name: "Tutorial guide" });
  expect(within(coach).getByRole("heading", { name: "Find a vault" })).toHaveFocus();
  expect(props.onAction).not.toHaveBeenCalled();
  fireEvent.click(within(coach).getByRole("button", { name: "Go to vault" }));
  expect(props.onAction).toHaveBeenCalledWith("dubs");
  fireEvent.click(within(coach).getByRole("button", { name: "Hide guide" }));
  expect(within(coach).queryByText("Desktop description")).not.toBeInTheDocument();
  fireEvent.click(within(coach).getByRole("button", { name: "Show guide" }));
  fireEvent.click(within(coach).getByRole("button", { name: "Next step" }));
  fireEvent.click(within(coach).getByRole("button", { name: "Back" }));
  expect(within(coach).getByRole("heading", { name: "Find a vault" })).toHaveFocus();
  fireEvent.click(within(coach).getByRole("button", { name: "Skip step" }));
  fireEvent.click(within(coach).getByRole("button", { name: "Finish lesson" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalledWith("media"));
  expect(await screen.findByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
});
it("skipping a lesson does not mark it complete", () => {
  const props = setup({ isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip lesson" }));
  expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
  expect(props.onComplete).not.toHaveBeenCalled();
});
it("reports contextual focus only while a walkthrough is expanded", () => {
  const onStepChange = vi.fn();
  setup({ isOpen: true, onStepChange });
  expect(onStepChange).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  expect(onStepChange).toHaveBeenLastCalledWith(lessons[0].steps[0]);
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(onStepChange).toHaveBeenLastCalledWith(lessons[0].steps[1]);
  fireEvent.click(screen.getByRole("button", { name: "Hide guide" }));
  expect(onStepChange).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Show guide" }));
  expect(onStepChange).toHaveBeenLastCalledWith(lessons[0].steps[1]);
  fireEvent.click(screen.getByRole("button", { name: "Skip lesson" }));
  expect(onStepChange).toHaveBeenLastCalledWith(null);
});
it("synchronizes explicit step navigation and resume, but not minimizing or opening the checklist", () => {
  const onNavigateStep = vi.fn();
  setup({ isOpen: true, onNavigateStep });
  expect(onNavigateStep).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  expect(onNavigateStep).toHaveBeenLastCalledWith(lessons[0].steps[0]);
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(onNavigateStep).toHaveBeenLastCalledWith(lessons[0].steps[1]);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(onNavigateStep).toHaveBeenLastCalledWith(lessons[0].steps[0]);
  fireEvent.click(screen.getByRole("button", { name: "Hide guide" }));
  expect(onNavigateStep).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole("button", { name: "Show guide" }));
  expect(onNavigateStep).toHaveBeenCalledTimes(4);
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  expect(onNavigateStep).toHaveBeenLastCalledWith(lessons[0].steps[1]);
  fireEvent.click(screen.getByRole("button", { name: "Skip lesson" }));
  expect(onNavigateStep).toHaveBeenCalledTimes(5);
});
it("replays completed lessons without losing completion status", () => {
  setup({ isOpen: true, progress: { dismissed: true, completed: ["media"] } });
  fireEvent.click(screen.getByRole("button", { name: "Replay Meet your music" }));
  expect(screen.getByRole("heading", { name: "Find a vault" })).toBeVisible();
});
it.each([false, true])("aligns guide action chevrons without changing their accessible names or navigation (replay=%s)", (replay) => {
  setup({ isOpen: true, progress: { dismissed: true, completed: replay ? ["media"] : [] } });
  const action = screen.getByRole("button", { name: `${replay ? "Replay" : "Start"} Meet your music` });
  expect(action).toHaveClass("tutorial-checklist__lesson-action");
  expect(action.querySelector(".button__label > svg")).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(action);
  expect(screen.getByRole("heading", { name: "Find a vault" })).toBeVisible();
});
it("scopes centered chevron layout to guide actions", () => {
  const css = readFileSync(resolve("src", "organisms", "TutorialGuide", "TutorialGuide.css"), "utf8");
  expect(css).toContain(".tutorial-checklist__lesson-action > .button__label { align-items: center; display: inline-flex; gap: var(--spacing-2); }");
  expect(css).toContain(".tutorial-checklist__lesson-action > .button__label > svg { flex: 0 0 auto; height: 1.125rem; width: 1.125rem; }");
});
it("skips a familiar domain without marking skipped work complete or allowing an old completion timer to advance", () => {
  vi.useFakeTimers();
  const grouped: TutorialLesson[] = [{ id: "media", title: "Domains", summary: "", steps: ["Dubs", "Samples", "Vocals"].flatMap((label) => [
    { title: `${label} vault`, description: "", task: "", group: { id: label, label, description: "Same pattern, separate music." },
      requirements: [{ label: "Visit", events: [{ type: "navigate" as const, value: label }] }] },
    { title: `${label} uploads`, description: "", task: "", group: { id: label, label, description: "Same pattern, separate music." },
      requirements: [{ label: "Visit uploads", events: [{ type: "navigate" as const, value: `my-${label}` }] }] },
  ]) }];
  const props = setup({ lessons: grouped, isOpen: true });
  fireEvent.click(screen.getByRole("button", { name: "Start Domains" }));
  props.report({ type: "navigate", value: "Dubs" });
  screen.getByRole("region", { name: "Tutorial step details" }).scrollTop = 200;
  fireEvent.click(screen.getByRole("button", { name: "Skip Dubs journey" }));
  expect(screen.getByRole("region", { name: "Tutorial step details" }).scrollTop).toBe(0);
  act(() => vi.advanceTimersByTime(1200));
  expect(screen.getByRole("heading", { name: "Samples vault" })).toBeVisible();
  expect(screen.getByText("Same pattern, separate music.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Skip Samples journey" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip Vocals journey" }));
  expect(screen.getByRole("dialog", { name: "Help & tutorials" })).toBeVisible();
  expect(props.onComplete).not.toHaveBeenCalled();
});
it("retains the final step when completion cannot be saved", async () => {
  const props = setup({ isOpen: true, onComplete: vi.fn(async () => false), error: "Save failed." });
  fireEvent.click(screen.getByRole("button", { name: "Start Make a workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish lesson" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalledOnce());
  expect(screen.getByRole("heading", { name: "Drafts" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Save failed.");
});
it("uses mobile instructions and separate platform labels", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setup({ isOpen: true });
  expect(screen.getByText(/Mobile checklist/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Start Meet your music" }));
  fireEvent.click(screen.getByText("Concept & tips"));
  expect(screen.getByText("Mobile description")).toBeVisible();
});
it("shows visual lesson cards, progress and a suggested next lesson", () => {
  setup({ isOpen: true, progress: { dismissed: true, completed: ["media"] } });
  expect(screen.getByRole("progressbar", { name: "Lessons complete" })).toHaveAttribute("value", "1");
  expect(screen.getByRole("button", { name: "Next up: Make a workspace" })).toBeVisible();
  expect(screen.getAllByLabelText("Workflow at a glance")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Next up: Make a workspace" }));
  fireEvent.click(screen.getByRole("button", { name: "Hide guide" }));
  expect(screen.getByRole("button", { name: "Show guide" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("region", { name: "Tutorial step details" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show guide" }));
  expect(screen.getByRole("heading", { name: "Drafts" })).toHaveFocus();
});
it("reports load errors with a retry instead of showing an empty successful checklist", () => {
  const props = setup({ progress: null, error: "Load failed." });
  expect(screen.getByRole("alert")).toHaveTextContent("Load failed.");
  fireEvent.click(screen.getByRole("button", { name: "Retry loading tutorials" }));
  expect(props.onRetry).toHaveBeenCalledOnce();
});
it("blocks lesson starts until progress loads", () => {
  setup({ isOpen: true, progress: null, loading: true });
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(screen.getByRole("button", { name: "Start Meet your music" })).toBeDisabled();
});
