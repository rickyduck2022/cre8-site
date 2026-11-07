import { Folder } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "../Molecules.css";

export interface CrateOption {
  id: string;
  name: string;
}

export interface CratePickerProps {
  crates: CrateOption[];
  onSelect: (crateId: string) => void;
  onCancel: () => void;
}

export function CratePicker({ crates, onCancel, onSelect }: CratePickerProps) {
  return (
    <div className="crate-picker">
      {crates.length > 0 ? (
        <ul className="crate-picker__list">
          {crates.map((crate) => (
            <li key={crate.id}>
              <Button
                className="crate-picker__option"
                leadingIcon={<Folder />}
                onClick={() => onSelect(crate.id)}
                variant="secondary"
              >
                {crate.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="crate-picker__empty">
          You don't have any crates yet. Create one from the sidebar first.
        </p>
      )}
      <div className="crate-form__actions">
        <Button onClick={onCancel} variant="tertiary">Cancel</Button>
      </div>
    </div>
  );
}
