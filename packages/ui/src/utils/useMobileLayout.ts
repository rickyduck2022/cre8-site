import { useSyncExternalStore } from "react";

const mobileQuery = "(max-width: 760px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isMobile() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.(mobileQuery).matches);
}

export function useMobileLayout() {
  return useSyncExternalStore(subscribe, isMobile, () => false);
}
