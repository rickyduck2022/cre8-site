import { useMemo, useRef, useState } from "react";
import { AudioLines, ChevronRight, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { ShareDubIcon } from "../../molecules/ShareDubIcon/ShareDubIcon";
import { DubCard } from "../../organisms/DubCard/DubCard";
import { DubStatistics } from "../../organisms/DubStatistics/DubStatistics";
import { DubPackCollection, type DubPackCollectionProps } from "../../organisms/DubPackCard/DubPackCollection";
import type { Dub } from "../communityTypes";
import type { MediaKind } from "../../types/domain";
import "../CommunityPageTemplates.css";
import "./MyDubsTemplate.css";

export interface MyDubsTemplateProps {
  mediaKind?: MediaKind;
  title?: string;
  activePackId?: string | null;
  dubs: Dub[];
  packs?: DubPackCollectionProps["packs"];
  ownerUsername?: string;
  onPlayPack?: DubPackCollectionProps["onPlayAll"];
  onOpenPack?: DubPackCollectionProps["onOpenPack"];
  onDownloadPack?: DubPackCollectionProps["onDownloadPack"];
  onSharePack?: DubPackCollectionProps["onSharePack"];
  onActivateQueue?: DubPackCollectionProps["onActivateQueue"];
  likedDubIds: Set<string>;
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onSeek?: (timeSeconds: number, dub: Dub) => void;
  onSeekProgress?: (progress: number, dub: Dub) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onDownload: (dub: Dub) => void;
  onPlay: (dub: Dub) => void;
  onShareDub: () => void;
  onShareWithFriend?: (dub: Dub) => void;
  onEditDub: (dub: Dub) => void;
  onDeleteDub: (dub: Dub) => void;
  onRevokeGrant?: (dubId: string, userId: string) => void;
  onAddToPack?: (dub: Dub) => void;
  onOpenProfile?: (username: string) => void;
}

export function MyDubsTemplate({
  mediaKind,
  title = mediaKind === "sample" ? "Your Samples" : "My Dubs",
  dubs,
  packs = [],
  ownerUsername,
  onPlayPack,
  onOpenPack,
  onDownloadPack,
  onSharePack,
  onActivateQueue,
  activePackId,
  likedDubIds,
  nowPlayingId,
  isPlaying,
  currentTimeSeconds = 0,
  durationSeconds,
  volume,
  shuffle,
  repeat,
  playbackError,
  onSeek,
  onSeekProgress,
  onPrevious,
  onNext,
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  onDownload,
  onPlay,
  onShareDub,
  onShareWithFriend,
  onEditDub,
  onDeleteDub,
  onRevokeGrant,
  onAddToPack,
  onOpenProfile,
}: MyDubsTemplateProps) {
  const isSample = mediaKind === "sample";
  const noun = isSample ? "sample" : "dub";
  const uploadLabel = isSample ? "Create Sample Pack" : "Share a dub";
  const [query, setQuery] = useState("");
  const statisticsRefs = useRef(new Map<string, HTMLDetailsElement>());
  const filteredDubs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return dubs.filter((dub) =>
      !needle || [dub.title, dub.artist, dub.genre, ...(dub.tags ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [dubs, query]);
  const pagination = usePagination(filteredDubs, query);
  const manageAccess = (dubId: string) => {
    const details = statisticsRefs.current.get(dubId);
    if (!details) return;
    details.open = true;
    details.querySelector<HTMLElement>(".dub-statistics__access")?.focus();
  };

  return (
    <div className="my-dubs-template">
      <section className="page-intro">
        <div>
          <span className="eyebrow">YOUR STUDIO</span>
          <h1>{title}</h1>
          <p>{isSample ? "Manage your samples, packs and usage terms." : "Manage your releases and keep your music moving."}</p>
        </div>
        <div className="my-dubs-template__intro-actions">
          <Badge dot variant="audio">{dubs.length} {noun}{dubs.length === 1 ? "" : "s"}</Badge>
          <Button aria-label={uploadLabel} hideLabelOnMobile leadingIcon={<ShareDubIcon desktopIcon={<AudioLines />} />} onClick={onShareDub}>
            {uploadLabel}
          </Button>
        </div>
      </section>

      <SearchField
        aria-label={isSample ? "Search your samples" : title === "My Dubs" ? "Search my dubs" : "Search your dubs"}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search your tracks, tags, or genres"
        value={query}
      />

      {ownerUsername && onPlayPack && onOpenPack && <DubPackCollection
        packs={packs} mediaKind={mediaKind} ownerUsername={ownerUsername} query={query} likedDubIds={likedDubIds}
        nowPlayingId={nowPlayingId} isPlaying={isPlaying} currentTimeSeconds={currentTimeSeconds}
        durationSeconds={durationSeconds} volume={volume} shuffle={shuffle} repeat={repeat} playbackError={playbackError}
        onPlay={onPlay} onPlayAll={onPlayPack} onOpenPack={onOpenPack} onDownloadPack={onDownloadPack} onSharePack={onSharePack}
        onDownload={onDownload} onOpenProfile={onOpenProfile} onSeek={onSeek} onSeekProgress={onSeekProgress}
        activePackId={activePackId} onActivateQueue={onActivateQueue} onPrevious={onPrevious} onNext={onNext}
        onShuffleChange={onShuffleChange} onRepeatChange={onRepeatChange} onVolumeChange={onVolumeChange} />}

      <section aria-label={title} className="my-dubs-template__list feed-list">
        {pagination.items.map((dub) => (
          <div className="my-dubs-template__track" key={dub.id}>
            <DubCard
              dub={dub}
              hasLiked={likedDubIds.has(dub.id)}
              isPlaying={isPlaying && nowPlayingId === dub.id}
              isCurrentTrack={nowPlayingId === dub.id}
              currentTimeSeconds={currentTimeSeconds}
              durationSeconds={durationSeconds}
              volume={volume}
              shuffle={shuffle}
              repeat={repeat}
              playbackError={nowPlayingId === dub.id ? playbackError : undefined}
              onSeek={onSeek}
              onSeekProgress={onSeekProgress}
              onPrevious={onPrevious}
              onNext={onNext}
              onVolumeChange={onVolumeChange}
              onShuffleChange={onShuffleChange}
              onRepeatChange={onRepeatChange}
              onDownload={onDownload}
              onOpenProfile={onOpenProfile}
              onPlay={onPlay}
              onEdit={onEditDub}
              onDelete={onDeleteDub}
              onShareWithFriend={onShareWithFriend}
              onAddToPack={onAddToPack}
              onManageAccess={dub.distribution === "private" ? () => manageAccess(dub.id) : undefined}
              manageable
            />
            <details
              className={`my-dubs-template__statistics my-dubs-template__statistics--${dub.distribution ?? "worldwide"}`}
              ref={(element) => {
                if (element) statisticsRefs.current.set(dub.id, element);
                else statisticsRefs.current.delete(dub.id);
              }}
            >
              <summary><span>Statistics for {dub.title}</span><ChevronRight aria-hidden="true" /></summary>
              <DubStatistics dub={dub} onRevokeGrant={onRevokeGrant} onOpenProfile={onOpenProfile} />
            </details>
          </div>
        ))}
        {filteredDubs.length === 0 && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>{dubs.length ? `No ${noun}s found` : `Your first ${noun} starts here`}</strong>
            <span>{dubs.length ? "Try another track, tag, or genre." : isSample ? "Create a Sample Pack to upload samples and define their usage terms." : "Share a dub to add it to your collection."}</span>
            {!dubs.length && <Button aria-label={uploadLabel} hideLabelOnMobile leadingIcon={<ShareDubIcon desktopIcon={<AudioLines />} />} onClick={onShareDub}>{uploadLabel}</Button>}
          </div>
        )}
      </section>
      <Pagination
        itemCount={filteredDubs.length}
        label={isSample ? "Your samples" : "My dubs"}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />

    </div>
  );
}
