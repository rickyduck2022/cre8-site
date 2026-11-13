import { useState } from "react";
import { Button } from "../../atoms/Button/Button";
import { CardActions } from "../../molecules/CardActions/CardActions";
import { useAsyncSubmission } from "../../utils/useAsyncSubmission";
import "./DubPackCard.css";

export function PackEditorActions({ title, onEdit, onDelete, disabled = false }: {
  title: string;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const deletion = useAsyncSubmission("The pack could not be deleted.", title);
  if (!onEdit && !onDelete) return null;
  return <div className="pack-editor-actions">
    <CardActions title={`${title} controls`} label="Pack controls" layout="grid" separated>
      {onEdit && <Button size="small" variant="secondary" disabled={disabled || deletion.pending} onClick={onEdit}>Edit pack</Button>}
      {onDelete && <Button size="small" variant="secondary" disabled={disabled || deletion.pending}
        aria-expanded={confirming} onClick={() => setConfirming(!confirming)}>Delete pack</Button>}
    </CardActions>
    {confirming && onDelete && <div role="group" aria-label="Confirm pack deletion">
      <p>Delete {title}? Its files remain in Your Dubs, Your Samples or Your Vocals based on their remaining published pack memberships. Pack-only access will be removed; downloaded files cannot be recalled.</p>
      <CardActions title={`${title} deletion`} layout="grid">
        <Button size="small" disabled={disabled || deletion.pending} loading={deletion.pending}
          onClick={() => void deletion.run(onDelete).then((deleted) => { if (deleted) setConfirming(false); })}>Confirm delete pack</Button>
        <Button size="small" variant="secondary" disabled={deletion.pending} onClick={() => setConfirming(false)}>Cancel</Button>
      </CardActions>
    </div>}
    {deletion.error && <p role="alert">{deletion.error}</p>}
  </div>;
}
