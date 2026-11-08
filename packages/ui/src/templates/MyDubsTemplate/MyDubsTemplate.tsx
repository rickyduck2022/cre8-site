import { useMemo, useState } from "react";
import { AudioLines, Search } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { Pagination, usePagination } from "../../molecules/Pagination/Pagination";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { DubCard } from "../../organisms/DubCard/DubCard";
import { Modal } from "../../organisms/Modal/Modal";
import { DubUploadForm } from "../../molecules/DubUploadForm/DubUploadForm";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import type { ArtistOption, Dub } from "../communityTypes";
import type { DubUploadFormValues } from "../../molecules/DubUploadForm/DubUploadForm";
import type { UploadProgressState } from "../../molecules/notificationTypes";
import "../CommunityPageTemplates.css";
import "./MyDubsTemplate.css";

export interface MyDubsTemplateProps {
  dubs: Dub[];
  artists: ArtistOption[];
  likedDubIds: Set<string>;
  nowPlayingId: string | null;
  isPlaying: boolean;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  volume?: number;
  shuffle?: boolean;
  repeat?: boolean;
  playbackError?: string | null;
  onSeek?: (timeSeconds: number) => void;
  onVolumeChange?: (volume: number) => void;
  onShuffleChange?: (enabled: boolean) => void;
  onRepeatChange?: (enabled: boolean) => void;
  onDownload: (dub: Dub) => void;
  onPlay: (dub: Dub) => void;
  onShareDub: () => void;
  onUpdateDub: (dubId: string, values: DubUploadFormValues) => Promise<Dub | null>;
  onDeleteDub: (dubId: string) => Promise<boolean>;
  uploadProgress?: UploadProgressState | null;
  uploadError?: string;
}

export function MyDubsTemplate({
  artists,
  dubs,
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
  onVolumeChange,
  onShuffleChange,
  onRepeatChange,
  onDownload,
  onPlay,
  onShareDub,
  onUpdateDub,
  onDeleteDub,
  uploadProgress = null,
  uploadError = "",
}: MyDubsTemplateProps) {
  const [query, setQuery] = useState("");
  const [editingDub, setEditingDub] = useState<Dub | null>(null);
  const [deletingDub, setDeletingDub] = useState<Dub | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const filteredDubs = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return dubs.filter((dub) =>
      !needle || [dub.title, dub.artist, dub.genre, ...(dub.tags ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [dubs, query]);
  const pagination = usePagination(filteredDubs, query);

  async function saveDub(values: DubUploadFormValues) {
    if (!editingDub) return false;
    const updated = await onUpdateDub(editingDub.id, values);
    if (!updated) return false;
    setEditingDub(null);
    return updated;
  }

  async function deleteDub() {
    if (!deletingDub || isDeleting) return;
    setIsDeleting(true);
    try {
      if (await onDeleteDub(deletingDub.id)) setDeletingDub(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="my-dubs-template">
      <section className="page-intro">
        <div>
          <span className="eyebrow">YOUR STUDIO</span>
          <h1>My Dubs</h1>
          <p>Manage your releases and keep your music moving.</p>
        </div>
        <div className="my-dubs-template__intro-actions">
          <Badge dot variant="audio">{dubs.length} {dubs.length === 1 ? "dub" : "dubs"}</Badge>
          <Button leadingIcon={<AudioLines aria-hidden="true" />} onClick={onShareDub}>
            Share a dub
          </Button>
        </div>
      </section>

      <SearchField
        aria-label="Search my dubs"
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search your tracks, tags, or genres"
        value={query}
      />

      <section aria-label="My Dubs" className="my-dubs-template__list feed-list">
        {pagination.items.map((dub) => (
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
            onVolumeChange={onVolumeChange}
            onShuffleChange={onShuffleChange}
            onRepeatChange={onRepeatChange}
            onDownload={onDownload}
            onPlay={onPlay}
            onEdit={setEditingDub}
            onDelete={setDeletingDub}
            manageable
            key={dub.id}
          />
        ))}
        {filteredDubs.length === 0 && (
          <div className="empty-state">
            <Search aria-hidden="true" />
            <strong>{dubs.length ? "No dubs found" : "Your first dub starts here"}</strong>
            <span>{dubs.length ? "Try another track, tag, or genre." : "Share a dub to add it to your collection."}</span>
            {!dubs.length && <Button onClick={onShareDub}>Share a dub</Button>}
          </div>
        )}
      </section>
      <Pagination
        itemCount={filteredDubs.length}
        label="My dubs"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
      />

      <Modal
        isOpen={Boolean(editingDub)}
        onClose={() => setEditingDub(null)}
        title={editingDub ? `Edit ${editingDub.title}` : "Edit dub"}
      >
        {editingDub && (
          <DubUploadForm
            key={editingDub.id}
            artists={artists}
            initialDub={editingDub}
            onCancel={() => setEditingDub(null)}
            onSubmit={saveDub}
            submissionError={uploadError}
            uploadProgress={uploadProgress}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deletingDub)}
        onClose={() => !isDeleting && setDeletingDub(null)}
        title="Delete dub?"
      >
        <p className="my-dubs-template__delete-copy">
          Delete <strong>{deletingDub?.title}</strong>? This also removes its audio and artwork from your releases.
        </p>
        <ModalFooter>
          <Button disabled={isDeleting} onClick={() => setDeletingDub(null)} variant="secondary">
            Cancel
          </Button>
          <Button disabled={isDeleting} loading={isDeleting} onClick={() => void deleteDub()} variant="primary">
            Delete dub
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
