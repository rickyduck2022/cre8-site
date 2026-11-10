export class DownloadSignInRequired extends Error {
  constructor() {
    super("Sign in to download this dub.");
  }
}

export async function downloadDubFile(dubId: string): Promise<void> {
  const response = await fetch(`/api/dubs/${encodeURIComponent(dubId)}/download`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
  });
  if (response.status === 401) throw new DownloadSignInRequired();
  const body: { audioUrl?: string; audioFileName?: string; error?: string } = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Download failed (${response.status}).`);
  if (!body.audioUrl || !body.audioFileName) throw new Error("The download response is incomplete. Please try again.");
  const link = document.createElement("a");
  link.href = body.audioUrl;
  link.download = body.audioFileName;
  document.body.append(link);
  link.click();
  link.remove();
}
