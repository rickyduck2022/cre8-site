export function sharedDubHash(dubId: string): string {
  return `#share?dub=${encodeURIComponent(dubId)}`;
}

export function externalDubUrl(dubId: string): string {
  return `${window.location.origin}/${sharedDubHash(dubId)}`;
}

export function signInForDubHash(dubId: string): string {
  return `#sign-in?dub=${encodeURIComponent(dubId)}`;
}

export function sharedDubIdFromHash(hash: string): string | null {
  if (hash.split("?")[0] !== "#share") return null;
  return new URLSearchParams(hash.split("?")[1]).get("dub") ?? "";
}

export function returnToSharedDub(): void {
  if (window.location.hash.split("?")[0] !== "#sign-in") return;
  const packId = new URLSearchParams(window.location.hash.split("?")[1]).get("pack");
  if (packId) { window.location.hash = `#pack?id=${encodeURIComponent(packId)}`; return; }
  const dubId = new URLSearchParams(window.location.hash.split("?")[1]).get("dub");
  if (dubId) window.location.hash = sharedDubHash(dubId);
}
