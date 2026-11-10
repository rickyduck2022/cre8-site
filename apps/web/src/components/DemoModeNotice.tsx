import { useState } from "react";
import { Button } from "@craft/ui";

const dismissalKey = "cre8:local-backend-notice-dismissed";

function isDismissed() {
  try {
    return window.localStorage.getItem(dismissalKey) === "true";
  } catch (error) {
    console.warn("Unable to read local backend notice preference.", error);
    return false;
  }
}

export function DemoModeNotice() {
  const [dismissed, setDismissed] = useState(isDismissed);
  const [saveError, setSaveError] = useState(false);

  function dismiss() {
    try {
      window.localStorage.setItem(dismissalKey, "true");
      setDismissed(true);
    } catch (error) {
      console.warn("Unable to save local backend notice preference.", error);
      setSaveError(true);
    }
  }

  if (dismissed) return null;

  return (
    <div className="demo-notice" role="note">
      <span className="demo-notice__pulse" aria-hidden="true" />
      <span className="demo-notice__copy">
        <strong>Local backend</strong> — community changes are saved on this
        development server. Both local artist accounts are available.
        {saveError && <span className="demo-notice__error" role="alert"> Unable to save your preference. Check browser storage and try again.</span>}
      </span>
      <Button aria-label="Dismiss local backend notice" className="demo-notice__dismiss" onClick={dismiss} size="small" variant="tertiary">
        <span aria-hidden="true">&times;</span>
      </Button>
    </div>
  );
}
