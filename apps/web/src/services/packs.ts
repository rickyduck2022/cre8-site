import type { Dub, DubPack } from "@craft/ui";
export { packAudience, packFileCount, packSize, packTypeLabel } from "@craft/ui";

export type PackItem = DubPack["items"][number];
export type PackGrant = NonNullable<DubPack["grants"]>[number];
export type Pack = DubPack;

export interface PackDetails {
  title: string;
  description: string;
  kind: Pack["kind"];
  distribution: Pack["distribution"];
  aListPublic: boolean;
  licence: string;
}

export function canAddDubToPack(pack: Pick<Pack, "distribution" | "aListPublic">, dub: Dub) {
  return (dub.distribution ?? "worldwide") === pack.distribution
    && (pack.distribution !== "alist" || (dub.aListPublic === true) === pack.aListPublic);
}

export async function packRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method, credentials: "same-origin", signal,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (response.status === 401) throw new PackSignInRequired();
  if (response.status === 204) return undefined as T;
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `The pack request failed (${response.status}).`);
  return result;
}

export class PackSignInRequired extends Error {
  constructor() { super("Sign in to access this pack."); }
}

export function packHash(id: string) { return `#pack?id=${encodeURIComponent(id)}`; }
export function packUrl(id: string) { return `${window.location.origin}/${packHash(id)}`; }
export function signInForPack(id: string) { window.location.hash = `#sign-in?pack=${encodeURIComponent(id)}`; }

export async function downloadPack(id: string) {
  const result = await packRequest<{ downloadUrl: string; fileName: string }>(`/api/packs/${encodeURIComponent(id)}/download`, "POST");
  const url = new URL(result.downloadUrl, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/packs/")) {
    throw new Error("The server returned an invalid pack download link.");
  }
  const response = await fetch(url.href, { credentials: "same-origin" });
  if (response.status === 401) throw new PackSignInRequired();
  if (!response.ok) {
    const body = await response.json() as { error?: string };
    throw new Error(body.error ?? "The archive could not be downloaded.");
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("The pack archive is empty.");
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = result.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
