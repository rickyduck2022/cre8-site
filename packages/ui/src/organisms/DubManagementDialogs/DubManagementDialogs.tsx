import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { DubUploadForm } from "../../molecules/DubUploadForm/DubUploadForm";
import type { DubUploadFormValues } from "../../molecules/DubUploadForm/DubUploadForm";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import type { UploadProgressState } from "../../molecules/notificationTypes";
import { Modal } from "../Modal/Modal";
import type { ArtistOption, Buddy, Dub } from "../../types/domain";
import "./DubManagementDialogs.css";

export interface DubManagementDialogsProps {
  editingDub: Dub | null;
  deletingDub: Dub | null;
  artists: ArtistOption[];
  buddies?: Buddy[];
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
  deletingDub,
  editingDub,
  onCloseDelete,
  onCloseEdit,
  onDeleteDub,
  onUpdateDub,
  uploadError = "",
  uploadProgress = null,
}: DubManagementDialogsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function saveDub(values: DubUploadFormValues) {
    if (!editingDub) return false;
    setIsSaving(true);
    try {
      const updated = await onUpdateDub(editingDub.id, values);
      if (!updated) return false;
      onCloseEdit();
      return updated;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDub() {
    if (!deletingDub || isDeleting) return;
    setIsDeleting(true);
    try {
      if (await onDeleteDub(deletingDub.id)) onCloseDelete();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={Boolean(editingDub)}
        onClose={() => !isSaving && onCloseEdit()}
        title={editingDub ? `Edit ${editingDub.title}` : "Edit dub"}
      >
        {editingDub && (
          <DubUploadForm
            key={editingDub.id}
            artists={artists}
            buddies={buddies}
            initialDub={editingDub}
            onCancel={onCloseEdit}
            onSubmit={saveDub}
            submissionError={uploadError}
            uploadProgress={uploadProgress}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deletingDub)}
        onClose={() => !isDeleting && onCloseDelete()}
        title="Delete dub?"
      >
        <p className="dub-management-dialogs__delete-copy">
          Delete <strong>{deletingDub?.title}</strong>? This also removes its audio and artwork from your releases.
        </p>
        <ModalFooter>
          <Button disabled={isDeleting} onClick={onCloseDelete} variant="secondary">
            Cancel
          </Button>
          <Button disabled={isDeleting} loading={isDeleting} onClick={() => void deleteDub()} variant="primary">
            Delete dub
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
