import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { DubPackCard, type DubPackCardProps } from "./DubPackCard";
import type { DubPack, MediaKind } from "../../types/domain";

export interface DubPackCollectionProps extends Omit<DubPackCardProps, "pack" | "matchingDubIds"> {
  packs: DubPack[];
  ownerUsername: string;
  query?: string;
  mediaKind?: MediaKind;
}

export function DubPackCollection({ packs, ownerUsername, query = "", mediaKind, ...playback }: DubPackCollectionProps) {
  const needle = query.trim().toLocaleLowerCase();
  const owned = packs.filter((pack) => pack.ownerUsername === ownerUsername && pack.status === "published" && (!mediaKind || pack.kind === mediaKind));
  const filtered = owned.filter((pack) => !needle || [pack.title, pack.description, ...pack.items.flatMap(({ dub }) => [dub.title, dub.artist, dub.genre, ...(dub.tags ?? [])])]
    .some((value) => value.toLocaleLowerCase().includes(needle)));
  const pagination = usePagination(filtered, `${ownerUsername}|${query}`);
  if (!owned.length) return null;
  const title = mediaKind === "vocal" ? "Vocal Packs" : mediaKind === "sample" ? "Sample Packs" : mediaKind === "dub" ? "Dub Packs" : "Dub, Sample & Vocal Packs";
  return <section className="dub-pack-collection" aria-label={mediaKind ? title : "Dub, Sample and Vocal Packs"} ref={pagination.listRef}>
    <h2>{title} <span className="pack-muted">({filtered.length})</span></h2>
    {!filtered.length && <p className="pack-muted">No packs match your search.</p>}
    {pagination.items.map((pack) => <DubPackCard key={pack.id} {...playback} pack={pack} />)}
    <Pagination itemCount={filtered.length} label="Packs" onPageChange={pagination.setPage}
      onPageSizeChange={pagination.setPageSize} page={pagination.page} pageSize={pagination.pageSize} totalPages={pagination.totalPages} />
  </section>;
}
