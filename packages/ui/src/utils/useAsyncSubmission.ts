import { useEffect, useRef, useState } from "react";

export function useAsyncSubmission(failureMessage: string, resetKey?: unknown) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => { setError(""); }, [resetKey]);

  async function run(action: () => unknown | Promise<unknown>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const result = await action();
      if (result === false || result === null) {
        setError(failureMessage);
        return false;
      }
      return true;
    } catch (submissionError) {
      setError(submissionError instanceof Error && submissionError.message
        ? submissionError.message : failureMessage);
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function requestClose(onClose: () => void) {
    if (!inFlight.current) onClose();
  }

  return { pending, error, run, requestClose };
}
