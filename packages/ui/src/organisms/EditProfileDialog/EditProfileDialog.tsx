import { EditProfileForm, type EditableProfile } from "../../molecules/EditProfileForm/EditProfileForm";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import { Modal } from "../Modal/Modal";

export interface EditProfileDialogProps {
  profile: EditableProfile;
  onClose: () => void;
  onSubmit: (profile: EditableProfile) => boolean | Promise<boolean>;
}

export function EditProfileDialog({ profile, onClose, onSubmit }: EditProfileDialogProps) {
  const submission = useAsyncSubmission("Profile could not be updated. Check the notification and try again.");
  const close = () => submission.requestClose(onClose);

  async function save(values: EditableProfile) {
    if (await submission.run(() => onSubmit(values))) onClose();
  }

  return (
    <Modal isOpen title="Edit your profile" onClose={close} closeDisabled={submission.pending}>
      <EditProfileForm
        profile={profile}
        isSubmitting={submission.pending}
        submissionError={submission.error}
        onCancel={close}
        onSubmit={(values) => void save(values)}
      />
    </Modal>
  );
}
