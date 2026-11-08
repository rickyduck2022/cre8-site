export interface UploadResponse {
  uploadId: string;
}

export function uploadFile(
  file: File,
  type: "audio" | "artwork" | "avatar" | "banner",
  onProgress: (loaded: number, total: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const path = type === "audio" ? "/api/uploads" : `/api/uploads?type=${type}`;
    request.open("POST", path);
    request.withCredentials = true;
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener("load", () => {
      let body: { uploadId?: string; error?: string };
      try {
        body = JSON.parse(request.responseText) as typeof body;
      } catch {
        reject(new Error("The server returned an invalid upload response."));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(body.error ?? `Upload failed (${request.status}).`));
        return;
      }
      if (!body.uploadId) {
        reject(new Error("The server did not confirm the uploaded file."));
        return;
      }
      resolve({ uploadId: body.uploadId });
    });
    request.addEventListener("error", () => {
      reject(new Error("A network error interrupted the file upload."));
    });
    request.addEventListener("abort", () => {
      reject(new Error("The file upload was cancelled."));
    });
    request.addEventListener("timeout", () => {
      reject(new Error("The file upload timed out. Please try again."));
    });
    request.send(file);
  });
}
