import { Button } from "../../atoms/Button/Button";
import { DubUploadForm } from "../../molecules/DubUploadForm/DubUploadForm";
import type { DubUploadFormValues } from "../../molecules/DubUploadForm/DubUploadForm";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import type { UploadProgressState } from "../../molecules/notificationTypes";
import { Modal } from "../Modal/Modal";
import type { ArtistOption, Buddy, Dub } from "../../types/domain";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import "./DubManagementDialogs.css";

export interface DubManagementDialogsProps {
  editingDub: Dub | null;
  deletingDub: Dub | null;
  artists: ArtistOption[];
  buddies?: Buddy[];
  aListMembers?: Buddy[];
  uploadProgress?: UploadProgressState | null;
  uploadError?: string;
  onCloseEdit: () => void;
  onCloseDelete: () => void;
  onUpdateDub: (dubId: string, values: DubUploadFormValues) => Promise<Dub | null>;
  onDeleteDub: (dubId: string) => Promise<boolean>;
}

export function DubManagementDialogs({
  artists,
  buddies,
  aListMembers,
  deletingDub,
  editingDub,
  onCloseDelete,
  onCloseEdit,
  onDeleteDub,
  onUpdateDub,
  uploadError = "",
  uploadProgress = null,
}: DubManagementDialogsProps) {
  const saving = useAsyncSubmission("The dub could not be saved. Check the notification and try again.", editingDub?.id);
  const deleting = useAsyncSubmission("The dub could not be deleted. Check the notification and try again.", deletingDub?.id);
  const closeEdit = () => saving.requestClose(onCloseEdit);
  const closeDelete = () => deleting.requestClose(onCloseDelete);

  async function saveDub(values: DubUploadFormValues) {
    if (!editingDub) return false;
    const saved = await saving.run(() => onUpdateDub(editingDub.id, values));
    if (saved) onCloseEdit();
    return saved;
  }

  async function deleteDub() {
    if (!deletingDub) return;
    if (await deleting.run(() => onDeleteDub(deletingDub.id))) onCloseDelete();
  }

  return (
    <>
      <Modal
        isOpen={Boolean(editingDub)}
        onClose={closeEdit}
        closeDisabled={saving.pending}
        title={editingDub ? `Edit ${editingDub.title}` : "Edit dub"}
      >
        {editingDub && (
          <DubUploadForm
            key={editingDub.id}
            artists={artists}
            buddies={buddies}
            aListMembers={aListMembers}
            initialDub={editingDub}
            onCancel={closeEdit}
            onSubmit={saveDub}
            submissionError={uploadError || saving.error}
            uploadProgress={uploadProgress}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deletingDub)}
        onClose={closeDelete}
        closeDisabled={deleting.pending}
        title="Delete dub?"
      >
        <p className="dub-management-dialogs__delete-copy">
          Delete <strong>{deletingDub?.title}</strong>? This also removes its audio and artwork from your releases.
        </p>
        {deleting.error && <p className="dub-management-dialogs__error" role="alert">{deleting.error}</p>}
        <ModalFooter>
          <Button disabled={deleting.pending} onClick={closeDelete} variant="secondary">
            Cancel
          </Button>
          <Button disabled={deleting.pending} loading={deleting.pending} onClick={() => void deleteDub()} variant="primary">
            Delete dub
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
