import { useEffect, useRef, useState } from "react";
import type { UploadResult } from "@craft/ui";

export function useUploadResults(notify: (message: string, type: "success" | "error") => void, owner?: string) {
  const [results, setResults] = useState<UploadResult[]>([]);
  const timers = useRef(new Map<string, number>());
  const publish = useRef(notify);
  publish.current = notify;
  useEffect(() => {
    setResults([]);
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    };
  }, [owner]);
  function finish(message: string, type: UploadResult["type"] = "success") {
    const id = crypto.randomUUID();
    setResults((previous) => [...previous, { id, message, type }]);
    timers.current.set(id, window.setTimeout(() => {
      timers.current.delete(id);
      setResults((previous) => previous.filter((result) => result.id !== id));
      publish.current(message, type);
    }, 30000));
  }
  function dismiss(id: string) {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setResults((previous) => previous.filter((result) => result.id !== id));
  }
  return { uploadResults: results, finishUpload: finish, dismissUploadResult: dismiss };
}
