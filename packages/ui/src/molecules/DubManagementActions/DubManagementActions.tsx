import { Button } from "../../atoms/Button/Button";
import "./DubManagementActions.css";

export interface DubManagementActionsProps {
  title: string;
  onEdit: () => void;
  onDelete: () => void;
  size?: "small" | "medium";
}

export function DubManagementActions({
  onDelete,
  onEdit,
  size = "small",
  title,
}: DubManagementActionsProps) {
  return (
    <div className="dub-management-actions" aria-label={`Manage ${title}`}>
      <Button aria-label={`Edit ${title}`} onClick={onEdit} size={size} variant="secondary">
        Edit
      </Button>
      <Button aria-label={`Delete ${title}`} onClick={onDelete} size={size} variant="tertiary">
        Delete
      </Button>
    </div>
  );
}
