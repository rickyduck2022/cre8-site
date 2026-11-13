import { describe, expect, it } from "vitest";
import { createEmptyDubSearchFilters } from "../organisms/DubSearch/DubSearch";
import { matchesOwnedFile, matchesOwnedPack, trackFormat } from "./collectionFilters";
import type { Dub, DubPack } from "../types/domain";

const filters = () => ({ ...createEmptyDubSearchFilters(), distributions: ["worldwide", "private", "alist"] as NonNullable<Dub["distribution"]>[] });
const dub: Dub = { id: "one", title: "Jungle vocal", artist: "Artist", uploader: "artist", uploadedAt: "", bpm: 174, genre: "Jungle", tags: ["Jungle"], duration: "00:20", likes: 0, downloads: 0, artwork: "", message: "", mediaKind: "vocal", distribution: "private", bitrateKbps: 320, audioFileName: "voice.wav" };
const pack: DubPack = { id: "pack", title: "Private draft", kind: "sample", description: "", status: "draft", distribution: "private", ownerUsername: "artist", ownerDisplayName: "Artist", totalBytes: 0, items: [] };

describe("owned collection filtering", () => {
  it("includes private files and empty drafts with all audiences and no file criteria", () => {
    expect(matchesOwnedFile(dub, "", filters())).toBe(true);
    expect(matchesOwnedPack(pack, "", filters())).toBe(true);
    expect(matchesOwnedPack(pack, "DRAFT", filters())).toBe(true);
    expect(matchesOwnedPack(pack, "unrelated", filters())).toBe(false);
  });
  it("matches types, audiences, any selected tag and bounded metadata together", () => {
    const selection = { ...filters(), mediaKind: "vocal" as const, tags: ["Liquid", "Jungle"], minBpm: "170", maxBpm: "180", fileType: "WAV", minBitrate: "300" };
    expect(matchesOwnedFile(dub, "jungle", selection)).toBe(true);
    expect(matchesOwnedFile(dub, "", { ...selection, mediaKind: "sample" })).toBe(false);
    expect(matchesOwnedFile(dub, "", { ...selection, distributions: ["worldwide"] })).toBe(false);
    expect(matchesOwnedFile({ ...dub, bitrateKbps: undefined }, "", selection)).toBe(false);
    expect(matchesOwnedFile(dub, "", { ...selection, maxBpm: "160" })).toBe(false);
    expect(trackFormat(dub)).toBe("WAV");
  });
  it("requires all file details to match the same pack member", () => {
    const selection = { ...filters(), tags: ["Jungle"], minBitrate: "300" };
    const members = { ...pack, items: [
      { dub: { ...dub, bitrateKbps: 128 } },
      { dub: { ...dub, id: "two", tags: ["Liquid"] } },
    ] };
    expect(matchesOwnedPack(members, "", selection)).toBe(false);
    expect(matchesOwnedPack({ ...pack, items: [{ dub }] }, "", selection)).toBe(true);
    expect(matchesOwnedPack(pack, "", selection)).toBe(false);
    expect(matchesOwnedPack({ ...pack, items: [{ dub }] }, "", { ...filters(), mediaKind: "vocal" })).toBe(false);
  });
});
