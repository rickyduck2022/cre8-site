import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, ChevronRight, Disc3, Download, Folder, LockKeyhole, MessageCircle, Microphone, Play, Search, Upload, WindowMinimize, WindowRestore } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { Modal } from "../Modal/Modal";
import { useMobileLayout } from "../../utils/useMobileLayout";
import "./TutorialGuide.css";
import { TutorialNavigationContext, type TutorialSurface } from "../../foundations/TutorialNavigationContext";
import { TutorialActivityContext, type TutorialRequirement } from "../../foundations/TutorialActivityContext";

export type TutorialPlatform = "desktop" | "mobile";
export type TutorialLessonId = "media" | "browse" | "workspace" | "upload" | "sharing" | "community";
export interface TutorialProgress { dismissed: boolean; completed: TutorialLessonId[] }
export interface TutorialStep {
  title: string;
  description: string;
  mobileDescription?: string;
  task: string;
  action?: { label: string; id: string };
  focusTargets?: string[];
  resultTargets?: string[];
  resultSubject?: string;
  focusStrategy?: "single" | "controls";
  focusSubject?: string;
  group?: { id: string; label: string; description: string };
  journey?: { destination: string; destinations?: string[]; surface: TutorialSurface };
  requirements?: TutorialRequirement[];
  visual?: Array<{ icon: "music" | "samples" | "vocals" | "search" | "play" | "folder" | "upload" | "access" | "message" | "download" | "minimize" | "restore" | "done"; label: string }>;
}
export interface TutorialLesson { id: TutorialLessonId; title: string; summary: string; steps: TutorialStep[] }
export interface TutorialGuideProps {
  lessons: TutorialLesson[];
  progress: TutorialProgress | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  busy: boolean;
  pauseForSpace?: boolean;
  error?: string;
  onRetry: () => void;
  onDismiss: () => Promise<boolean>;
  onComplete: (lesson: TutorialLessonId) => Promise<boolean>;
  onAction: (action: string) => void;
  onStepChange?: (step: TutorialStep | null) => void;
  onNavigateStep?: (step: TutorialStep) => void;
}

const lessonVisuals = {
  media: { icon: <Disc3 />, cues: [{ icon: <Disc3 />, label: "Dubs" }, { icon: <AudioLines />, label: "Samples" }, { icon: <Microphone />, label: "Vocals" }] },
  browse: { icon: <Search />, cues: [{ icon: <Search />, label: "Find" }, { icon: <AudioLines />, label: "Filter" }, { icon: <Play />, label: "Play" }] },
  workspace: { icon: <WindowRestore />, cues: [{ icon: <Folder />, label: "Open" }, { icon: <WindowMinimize />, label: "Minimize" }, { icon: <WindowRestore />, label: "Restore" }] },
  upload: { icon: <Upload />, cues: [{ icon: <Upload />, label: "Choose" }, { icon: <AudioLines />, label: "Add files" }, { icon: <Folder />, label: "Organise" }] },
  sharing: { icon: <LockKeyhole />, cues: [{ icon: <AudioLines />, label: "Music" }, { icon: <LockKeyhole />, label: "Access" }, { icon: <MessageCircle />, label: "Share" }] },
  community: { icon: <MessageCircle />, cues: [{ icon: <Download />, label: "Keep" }, { icon: <Search />, label: "Find friends" }, { icon: <MessageCircle />, label: "Connect" }] },
};
const stepIcons = { music: <Disc3 />, samples: <AudioLines />, vocals: <Microphone />, search: <Search />, play: <Play />,
  folder: <Folder />, upload: <Upload />, access: <LockKeyhole />, message: <MessageCircle />, download: <Download />,
  minimize: <WindowMinimize />, restore: <WindowRestore />, done: <Check /> };

function StepVisual({ step }: { step: TutorialStep }) {
  if (!step.visual) return null;
  return <div className="tutorial-guide__visual tutorial-guide__step-visual" aria-label={`${step.title} workflow`}>
    {step.visual.map((cue, index) => <div key={`${index}-${cue.label}`}>
      {index > 0 && <ChevronRight className="tutorial-guide__connector" aria-hidden="true" />}
      <span><span aria-hidden="true">{stepIcons[cue.icon]}</span><strong>{cue.label}</strong></span>
    </div>)}
  </div>;
}

function LessonVisual({ id }: { id: TutorialLessonId }) {
  return <div className="tutorial-guide__visual" aria-label="Workflow at a glance">
    {lessonVisuals[id].cues.map((cue, index) => <div key={cue.label}>
      {index > 0 && <ChevronRight className="tutorial-guide__connector" aria-hidden="true" />}
      <span>{cue.icon}<strong>{cue.label}</strong></span>
    </div>)}
  </div>;
}

export function TutorialGuide({ lessons, progress, isOpen, onOpenChange, loading, busy, pauseForSpace, error, onRetry, onDismiss, onComplete, onAction, onStepChange, onNavigateStep }: TutorialGuideProps) {
  const mobile = useMobileLayout();
  const [lessonId, setLessonId] = useState<TutorialLessonId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [spacePaused, setSpacePaused] = useState(false);
  const [fulfilled, setFulfilled] = useState<Record<number, number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const activity = useContext(TutorialActivityContext);
  const navigation = useContext(TutorialNavigationContext);
  const requirementProgress = useRef<{ step?: TutorialStep; count: number; subjectId?: string; complete: boolean }>({ count: 0, complete: false });
  const subjects = useRef<Record<number, string | undefined>>({});
  const completionAttempt = useRef(false);
  const automaticProgress = useRef(() => {});
  const coachTitle = useRef<HTMLHeadingElement>(null);
  const coachBody = useRef<HTMLDivElement>(null);
  const lesson = lessons.find((entry) => entry.id === lessonId);
  const step = lesson?.steps[stepIndex];
  const completed = progress?.completed ?? [];
  const nextLesson = lessons.find((entry) => !completed.includes(entry.id));
  const required = step?.requirements ?? [];
  const achieved = fulfilled[stepIndex] ?? 0;
  const ready = required.length === 0 || achieved === required.length;
  const outsideJourney = Boolean(step?.journey && navigation && !navigation.ready);
  const focusedStep = useMemo(() => {
    if (!step) return null;
    if (!step.requirements?.length) return step;
    const requirement = step.requirements?.[achieved];
    const resultTargets = achieved > 0 ? step.requirements?.[achieved - 1]?.resultTargets ?? step.resultTargets : [];
    const resultSubject = subjects.current[stepIndex];
    if (outsideJourney && !requirement?.events.some((event) => event.type === "navigate")) return { ...step, focusTargets: [], resultTargets: [] };
    if (requirement?.focusTargets) return { ...step, focusTargets: requirement.focusTargets,
      resultTargets, resultSubject,
      focusStrategy: requirement.focusStrategy ?? step.focusStrategy,
      focusSubject: requirement.sameSubjectAsPrevious ? subjects.current[stepIndex] : undefined };
    if (step.requirements?.length && !requirement) return { ...step, focusTargets: [], resultTargets, resultSubject };
    return { ...step, resultTargets, resultSubject };
  }, [step, achieved, outsideJourney]);
  const allDone = lesson?.steps.every((entry, index) => !entry.requirements?.length || fulfilled[index] === entry.requirements.length);
  const previousDone = lesson?.steps.every((entry, index) => index === stepIndex || !entry.requirements?.length || fulfilled[index] === entry.requirements.length);
  automaticProgress.current = () => {
    if (!confirmed || !step || collapsed || isOpen || busy) return;
    setConfirmed(false);
    if (stepIndex < (lesson?.steps.length ?? 0) - 1) move(stepIndex + 1, true);
    else { void finish(); }
  };
  useEffect(() => {
    if (!step || isOpen || collapsed || busy || confirmed || ready) return;
    if (requirementProgress.current.step !== step) requirementProgress.current = { step, count: achieved, subjectId: subjects.current[stepIndex], complete: false };
    return activity?.subscribe((event) => {
      if (step.journey && navigation && !navigation.ready && event.type !== "navigate") return;
      const current = requirementProgress.current;
      const requirement = required[current.count];
      if (!requirement || current.complete || !requirement.events.some((match) => match.type === event.type
        && (match.value === undefined || match.value === event.value))) return;
      if (requirement.sameSubjectAsPrevious && (!event.subjectId || event.subjectId !== current.subjectId)) return;
      current.count += 1;
      current.subjectId = event.subjectId;
      subjects.current[stepIndex] = event.subjectId;
      current.complete = current.count === required.length;
      setFulfilled((previous) => ({ ...previous, [stepIndex]: current.count }));
      if (current.complete) setConfirmed(true);
    });
  }, [activity, navigation?.ready, step, isOpen, collapsed, busy, confirmed, ready]);
  useEffect(() => {
    if (!confirmed || !step || collapsed || isOpen || busy) return;
    const timer = window.setTimeout(() => automaticProgress.current(), 1000);
    return () => window.clearTimeout(timer);
  }, [confirmed, step, collapsed, isOpen, busy]);
  useEffect(() => {
    onStepChange?.(!isOpen && !collapsed ? focusedStep : null);
    return () => onStepChange?.(null);
  }, [focusedStep, isOpen, collapsed, onStepChange]);
  useEffect(() => {
    if (lesson && !collapsed && !isOpen && !advancing) coachTitle.current?.focus({ preventScroll: true });
  }, [lessonId, stepIndex, collapsed, isOpen]);
  useEffect(() => {
    if (coachBody.current) coachBody.current.scrollTop = 0;
  }, [lessonId, stepIndex]);
  useEffect(() => {
    if (pauseForSpace) { setCollapsed(true); setSpacePaused(true); }
  }, [pauseForSpace]);
  function start(id: TutorialLessonId) {
    setFulfilled({}); setConfirmed(false); setAdvancing(false);
    subjects.current = {}; requirementProgress.current = { count: 0, complete: false };
    setLessonId(id); setStepIndex(0); setCollapsed(false); setSpacePaused(false); onOpenChange(false);
    const first = lessons.find((entry) => entry.id === id)?.steps[0];
    if (first) onNavigateStep?.(first);
  }
  function move(index: number, automatic = false) {
    const next = lesson?.steps[index];
    if (!next) return;
    setConfirmed(false); setAdvancing(automatic); setStepIndex(index);
    onNavigateStep?.(next);
  }
  function resume() {
    setAdvancing(false);
    setSpacePaused(false);
    setCollapsed(false); onOpenChange(false);
    if (step) onNavigateStep?.(step);
  }
  function skipGroup() {
    if (!lesson || !step?.group) return;
    const next = lesson.steps.findIndex((entry, index) => index > stepIndex && entry.group?.id !== step.group?.id);
    if (next >= 0) move(next);
    else { setConfirmed(false); setLessonId(null); onOpenChange(true); }
  }
  async function finish() {
    if (!lesson || completionAttempt.current) return;
    if (!allDone) { setLessonId(null); onOpenChange(true); return; }
    completionAttempt.current = true;
    try {
      if (await onComplete(lesson.id)) { setLessonId(null); onOpenChange(true); }
    } finally { completionAttempt.current = false; }
  }
  return <>
    {!isOpen && !progress && !loading && error && <section className="tutorial-guide" aria-label="Tutorial loading error">
      <p role="alert">{error}</p><Button size="small" onClick={onRetry}>Retry loading tutorials</Button>
    </section>}
    {!isOpen && !lesson && progress && !progress.dismissed && <section className="tutorial-guide tutorial-guide--welcome" aria-label="Welcome to cre8">
      <h2>Make yourself at home</h2>
      <p>Learn the music, windows and workflows with six short, optional walkthroughs. Your {mobile ? "mobile" : "desktop"} progress is saved separately.</p>
      {error && <p role="alert">{error}</p>}
      <div className="tutorial-guide__actions">
        <Button size="small" disabled={busy} onClick={() => { void onDismiss().then((saved) => { if (saved) onOpenChange(true); }); }}>Get started</Button>
        <Button size="small" variant="tertiary" disabled={busy} onClick={() => { void onDismiss(); }}>Not now</Button>
      </div>
      <p className="tutorial-guide__hint">Replay anytime: account menu &gt; Help &amp; tutorials.</p>
    </section>}
    <Modal title="Help & tutorials" isOpen={isOpen} onClose={() => onOpenChange(false)} presentation="modal" className="tutorial-checklist">
      <section className="tutorial-checklist__overview" aria-label="Your learning progress">
        <div><span className="tutorial-guide__hint">YOUR QUICK START</span><h3>Explore. Try. Make it yours.</h3>
          <p>Pick a topic, follow the visual cues, then try it in the app. Skip anything you are not ready for.</p></div>
        <div className="tutorial-checklist__progress">
          <strong>{completed.length}<span> / {lessons.length}</span></strong>
          <progress aria-label="Lessons complete" max={lessons.length} value={completed.length} />
          <span>{mobile ? "Mobile" : "Desktop"} checklist: {completed.length} of {lessons.length} complete. Progress is saved to your account.</span>
        </div>
      </section>
      <p className="tutorial-guide__hint">You stay in control. No automatic uploads, messages or workspace changes. Skipped actions do not mark a lesson complete.</p>
      {loading && <p role="status">Loading your tutorial progress...</p>}
      {error && <p role="alert">{error}</p>}
      {!progress && !loading && <Button onClick={onRetry}>Retry loading progress</Button>}
      {lesson && <Button variant="secondary" onClick={resume}>Resume {lesson.title}</Button>}
      {!lesson && nextLesson && <Button disabled={busy || loading || !progress} onClick={() => start(nextLesson.id)}>Next up: {nextLesson.title}</Button>}
      <ol className="tutorial-checklist__lessons">
        {lessons.map((entry, index) => <li key={entry.id} className={completed.includes(entry.id) ? "tutorial-checklist__lesson--complete" : undefined}>
          <div className="tutorial-checklist__tile-heading">
            <span className="tutorial-checklist__icon" aria-hidden="true">{completed.includes(entry.id) ? <Check /> : lessonVisuals[entry.id].icon}</span>
            <div><span className="tutorial-guide__hint">LESSON {index + 1} · {entry.steps.length} STEPS</span><h3>{entry.title}</h3></div>
          </div>
          <p>{entry.summary}</p>
          <LessonVisual id={entry.id} />
          <div className="tutorial-checklist__tile-footer"><span>{completed.includes(entry.id) ? "Completed" : entry.id === nextLesson?.id ? "Suggested next" : "Ready when you are"}</span>
          <Button className="tutorial-checklist__lesson-action" size="small" variant="secondary" aria-label={`${completed.includes(entry.id) ? "Replay" : "Start"} ${entry.title}`} disabled={busy || loading || !progress} onClick={() => start(entry.id)}>
            {completed.includes(entry.id) ? "Replay" : "Start"}<ChevronRight aria-hidden="true" />
          </Button>
          </div>
        </li>)}
      </ol>
    </Modal>
    {lesson && step && !isOpen && <aside aria-label="Tutorial guide" className={`tutorial-guide${collapsed ? " tutorial-guide--collapsed" : ""}`} data-window-system>
      <header className="tutorial-guide__header">
        <div><span className="tutorial-guide__hint">{lesson.title} · {stepIndex + 1}/{lesson.steps.length}</span><h2 ref={coachTitle} tabIndex={-1} aria-live="polite">{collapsed ? spacePaused ? "Guide paused to keep your UI clear" : "Tutorial paused here" : step.title}</h2>
          <progress className="tutorial-guide__position" aria-label="Lesson position" max={lesson.steps.length} value={stepIndex + 1} />
          {!collapsed && <p className="tutorial-guide__compact-action">{confirmed ? "Step complete" : required[achieved]?.label ?? "Read, then continue"}</p>}
        </div>
        <Button size="small" variant="tertiary" leadingIcon={collapsed ? <WindowRestore /> : <WindowMinimize />} aria-label={collapsed ? "Show guide" : "Hide guide"} aria-expanded={!collapsed} onClick={() => { if (collapsed) resume(); else setCollapsed(true); }}>{collapsed ? "Show guide" : "Hide guide"}</Button>
      </header>
      {!collapsed && <div ref={coachBody} className="tutorial-guide__body" role="region" aria-label="Tutorial step details" tabIndex={0}>
        <StepVisual step={step} />
        <section className="tutorial-guide__next-action" aria-label="Next action">
          <span className="tutorial-guide__action-icon" aria-hidden="true">{confirmed || ready && required.length > 0 ? <Check /> : lessonVisuals[lesson.id].icon}</span>
          <div><span className="tutorial-guide__hint">{confirmed ? "NICE WORK" : outsideJourney ? "RETURN TO CONTINUE" : required.length && ready ? "ACTIONS COMPLETE" : required.length ? `YOUR NEXT ACTION · ${achieved + 1}/${required.length}` : "QUICK CONCEPT"}</span>
            <strong>{confirmed ? "Step complete" : outsideJourney ? "Return to this step" : required[achieved]?.label ?? (required.length ? "Ready to continue" : "Read, then continue")}</strong>
          </div>
        </section>
        {step.group && <p className="tutorial-guide__hint"><strong>{step.group.label} journey.</strong> {step.group.description}</p>}
        <details className="tutorial-guide__explanation"><summary>Task details</summary><p>{step.task}</p></details>
        {step.action && <Button size="small" variant="secondary" disabled={busy} onClick={() => { if (step.action) onAction(step.action.id); }}>{step.action.label}</Button>}
        {step.journey && onNavigateStep && <Button size="small" variant="tertiary" disabled={busy} onClick={() => onNavigateStep(step)}>Return to this step</Button>}
        <details className="tutorial-guide__explanation"><summary>Concept &amp; tips</summary><p>{mobile && step.mobileDescription ? step.mobileDescription : step.description}</p></details>
        {required.length > 0 && <ol className="tutorial-guide__requirements" aria-label="Step requirements">
          {required.map((requirement, index) => <li key={requirement.label} data-complete={index < achieved} aria-current={index === achieved ? "step" : undefined}>
            {index < achieved ? <Check aria-label="Complete" /> : <span aria-hidden="true">{index + 1}</span>}
            <span>{requirement.label}</span>
          </li>)}
        </ol>}
        <p className="tutorial-guide__hint" role="status" aria-live="polite">
          {confirmed ? "Step complete! Moving on..." : outsideJourney ? "You are outside this step's collection. Use Return to this step to continue, or skip." : required.length ? "Complete the actions to continue automatically, or skip. Nothing is submitted for you." : "Read this concept, then continue when ready."}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="tutorial-guide__actions">
          <Button size="small" variant="tertiary" disabled={busy || stepIndex === 0} onClick={() => move(stepIndex - 1)}>Back</Button>
          {stepIndex < lesson.steps.length - 1 ? <>
            <Button size="small" disabled={busy || !ready || confirmed} onClick={() => move(stepIndex + 1)}>Next step</Button>
            <Button size="small" variant="tertiary" disabled={busy} onClick={() => move(stepIndex + 1)}>Skip step</Button>
          </> : <>
            <Button size="small" disabled={busy || !ready || confirmed} onClick={() => { void finish(); }}>{busy ? "Saving..." : previousDone ? "Finish lesson" : "Finish walkthrough"}</Button>
            {required.length > 0 && <Button size="small" variant="tertiary" disabled={busy} onClick={() => { setLessonId(null); onOpenChange(true); }}>Skip step</Button>}
          </>}
          <Button size="small" variant="tertiary" disabled={busy} onClick={() => { setLessonId(null); onOpenChange(true); }}>Skip lesson</Button>
          {step.group && <Button size="small" variant="tertiary" disabled={busy} onClick={skipGroup}>Skip {step.group.label} journey</Button>}
        </div>
      </div>}
    </aside>}
  </>;
}
