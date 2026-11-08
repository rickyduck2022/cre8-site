export function readAudioDurationSeconds(file: File): Promise<number | undefined> {
  if (typeof Audio === "undefined" || typeof URL.createObjectURL !== "function") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    let source: string | undefined;
    let audio: HTMLAudioElement;
    try {
      source = URL.createObjectURL(file);
      audio = new Audio();
    } catch {
      if (source) URL.revokeObjectURL(source);
      resolve(undefined);
      return;
    }
    const objectUrl = source;
    let settled = false;
    const timeoutId = window.setTimeout(() => finish(undefined), 10_000);

    function finish(duration?: number) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      audio.removeAttribute("src");
      URL.revokeObjectURL(objectUrl);
      resolve(duration && Number.isFinite(duration) && duration > 0 ? duration : undefined);
    }

    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => finish(audio.duration), { once: true });
    audio.addEventListener("error", () => finish(undefined), { once: true });
    audio.src = objectUrl;
  });
}
