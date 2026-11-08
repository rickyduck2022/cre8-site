import { Check } from "@craft/icons";
import "./AListBadge.css";

export function AListBadge() {
  return <span className="alist-badge" role="img" aria-label="A-List approved" title="A-List approved"><Check aria-hidden="true" /></span>;
}
