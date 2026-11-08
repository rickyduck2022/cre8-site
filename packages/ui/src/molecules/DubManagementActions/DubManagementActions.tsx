import { Pencil, Trash } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "./DubManagementActions.css";

export interface DubManagementActionsProps {
  title: string;
  onEdit: () => void;
  onDelete: () => void;
  size?: "small" | "medium";
  showIcons?: boolean;
}

export function DubManagementActions({
  onDelete,
  onEdit,
  size = "small",
  showIcons = false,
  title,
}: DubManagementActionsProps) {
  return (
    <div className="dub-management-actions" aria-label={`Manage ${title}`}>
      <Button aria-label={`Edit ${title}`} leadingIcon={showIcons ? <Pencil /> : undefined} onClick={onEdit} size={size} variant="secondary">
        Edit
      </Button>
      <Button aria-label={`Delete ${title}`} leadingIcon={showIcons ? <Trash /> : undefined} onClick={onDelete} size={size} variant="tertiary">
        Delete
      </Button>
    </div>
  );
}
