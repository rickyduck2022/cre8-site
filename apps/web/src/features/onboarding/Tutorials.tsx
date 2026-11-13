import { useCallback, useEffect, useRef, useState } from "react";
import { TutorialGuide, useMobileLayout, type TutorialLessonId, type TutorialProgress, type TutorialStep } from "@craft/ui";
import { onboardingLessons } from "./lessons";
import { TutorialFocus } from "./TutorialFocus";

interface ProgressResponse {
  version: 1;
  desktop: TutorialProgress;
  mobile: TutorialProgress;
}
function isPlatformProgress(value: unknown): value is TutorialProgress {
  return typeof value === "object" && value !== null && "dismissed" in value && typeof value.dismissed === "boolean"
    && "completed" in value && Array.isArray(value.completed)
    && value.completed.every((id: unknown) => onboardingLessons.some((lesson) => lesson.id === id));
}
function isProgressResponse(value: unknown): value is ProgressResponse {
  return typeof value === "object" && value !== null && "version" in value && value.version === 1
    && "desktop" in value && isPlatformProgress(value.desktop) && "mobile" in value && isPlatformProgress(value.mobile);
}

async function requestProgress(signal: AbortSignal, body?: unknown): Promise<ProgressResponse> {
  const response = await fetch("/api/onboarding", {
    credentials: "same-origin", signal,
    ...(body === undefined ? {} : {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : `Tutorial progress request failed (${response.status}).`;
    throw new Error(message);
  }
  if (!isProgressResponse(result)) throw new Error("The server returned invalid tutorial progress. Please retry.");
  return result;
}

export function Tutorials({ ownerId, isOpen, onOpenChange, onAction, onNavigateStep, onStepChange }: {
  ownerId: string; isOpen: boolean; onOpenChange: (open: boolean) => void; onAction: (action: string) => void;
  onNavigateStep?: (step: TutorialStep) => void;
  onStepChange?: (step: TutorialStep | null) => void;
}) {
  const mobile = useMobileLayout();
  const platform = mobile ? "mobile" : "desktop";
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [activeStep, setActiveStep] = useState<TutorialStep | null>(null);
  const [pauseForSpace, setPauseForSpace] = useState(false);
  const pause = useCallback(() => setPauseForSpace(true), []);
  const updateStep = useCallback((step: TutorialStep | null) => {
    if (!step) setPauseForSpace(false);
    setActiveStep(step); onStepChange?.(step);
  }, [onStepChange]);
  const lifetime = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const offered = useRef(new Set<string>());
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setLoading(true); setProgress(null); setError(""); offered.current.clear();
    void requestProgress(controller.signal).then((result) => {
      if (!controller.signal.aborted) setProgress(result);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Tutorial progress could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ownerId, reload]);
  const save = useCallback(async (lessonId?: TutorialLessonId) => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || saving.current) return false;
    saving.current = true; setBusy(true); setError("");
    try {
      const result = await requestProgress(controller.signal, { ownerId, platform, action: lessonId ? "complete" : "dismiss", ...(lessonId ? { lessonId } : {}) });
      if (controller.signal.aborted) return false;
      setProgress(result);
      return true;
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Tutorial progress could not be saved.");
      return false;
    } finally {
      saving.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [ownerId, platform]);
  useEffect(() => {
    if (isOpen && progress && !busy && !progress[platform].dismissed && !offered.current.has(platform)) {
      offered.current.add(platform);
      void save();
    }
  }, [isOpen, progress, platform, save, busy]);
  return <><TutorialGuide key={platform} lessons={onboardingLessons} progress={progress?.[platform] ?? null}
    isOpen={isOpen} onOpenChange={onOpenChange} loading={loading} busy={busy} error={error} pauseForSpace={pauseForSpace}
    onRetry={() => setReload((value) => value + 1)} onDismiss={save} onComplete={save} onAction={onAction} onStepChange={updateStep} onNavigateStep={onNavigateStep} />
    <TutorialFocus step={activeStep} onUnavailableSpace={pause} /></>;
}
