import { httpError } from "../stage-a/store.mjs";

export function createStagingAdmission({ now = Date.now } = {}) {
  let windowStart = now();
  let requests = 0;
  let logins = 0;
  let active = 0;
  let authenticating = 0;
  let uploading = 0;
  return (request, response) => {
    const time = now();
    if (time - windowStart >= 60000) {
      windowStart = time;
      requests = 0;
      logins = 0;
    }
    const path = new URL(request.url, "http://localhost").pathname;
    const login = request.method === "POST" && path === "/api/login";
    const upload = request.method === "PUT" && /^\/api\/uploads\/[^/]+$/.test(path);
    if (requests >= 120 || (login && logins >= 5)
      || active >= 2 || (login && authenticating >= 1) || (upload && uploading >= 1)) {
      response.setHeader("retry-after", "60");
      response.setHeader("connection", "close");
      throw httpError(429, "Isolated staging admission limit reached.");
    }
    requests++;
    if (login) logins++;
    active++;
    if (login) authenticating++;
    if (upload) uploading++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      if (login) authenticating--;
      if (upload) uploading--;
      response.off("finish", release);
      response.off("close", release);
    };
    response.once("finish", release);
    response.once("close", release);
  };
}
