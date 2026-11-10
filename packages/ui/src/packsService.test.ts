import { afterEach, expect, it, vi } from "vitest";
import { downloadPack, packAudience, packFileCount, packHash, packRequest, PackSignInRequired, signInForPack } from "../../../apps/web/src/services/packs";
import { packTrackMetadata } from "../../../apps/web/src/components/PackTrackFields";
import { returnToSharedDub } from "../../../apps/web/src/services/externalDubLinks";

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("returns to the exact shared pack after authentication", () => {
  signInForPack("pack with spaces");
  expect(window.location.hash).toBe("#sign-in?pack=pack%20with%20spaces");
  returnToSharedDub();
  expect(window.location.hash).toBe(packHash("pack with spaces"));
});

it("shares metadata validation between uploads and existing-file editing", () => {
  const values = { title: "  Loop ", artistId: "artist", bpm: "174", key: " F minor ", tags: " Jungle, , Liquid " };
  expect(packTrackMetadata(values)).toEqual({ title: "Loop", artistId: "artist", bpm: 174, key: "F minor", tags: ["Jungle", "Liquid"] });
  expect(() => packTrackMetadata({ ...values, bpm: "174.5" })).toThrow("BPM must be between 1 and 300");
  expect(() => packTrackMetadata({ ...values, title: " " })).toThrow("Provide a title and artist.");
});

it("formats pack counts and audience consistently", () => {
  expect(packFileCount("sample", 1)).toBe("1 sample");
  expect(packFileCount("dub", 2)).toBe("2 tracks");
  expect(packAudience({ distribution: "alist", aListPublic: true })).toBe("Public A-List");
});

it("surfaces API errors and distinguishes expired authentication", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({
    status: 409, ok: false, json: async () => ({ error: "Confirm new recipient access." }),
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(packRequest("/api/packs")).rejects.toBeInstanceOf(PackSignInRequired);
  await expect(packRequest("/api/packs/one", "PATCH", { dubIds: ["new"] })).rejects.toThrow("Confirm new recipient access.");
});

it("rejects cross-origin archive links instead of downloading them", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ downloadUrl: "https://example.com/archive.zip", fileName: "pack.zip" }),
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(downloadPack("one")).rejects.toThrow("invalid pack download link");
  expect(fetcher).toHaveBeenCalledOnce();
});

it("requires the archive response to succeed and contain a nonempty file", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({
    ok: true, status: 200, json: async () => ({ downloadUrl: "/api/packs/one/archive", fileName: "pack.zip" }),
  }).mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob([]) });
  vi.stubGlobal("fetch", fetcher);
  await expect(downloadPack("one")).rejects.toThrow("archive is empty");
});
