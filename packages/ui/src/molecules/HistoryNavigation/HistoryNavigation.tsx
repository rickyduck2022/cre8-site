import { ChevronRight } from "@craft/icons";
import { EdgeTab } from "../../atoms/EdgeTab/EdgeTab";
import "./HistoryNavigation.css";

export interface HistoryNavigationProps {
  canGoBack: boolean;
  onBack: () => void;
}

export function HistoryNavigation({ canGoBack, onBack }: HistoryNavigationProps) {
  return (
    <nav className="history-navigation" aria-label="Page history">
      <EdgeTab aria-label="Go back" title="Go back" className="history-navigation__back" disabled={!canGoBack} leadingIcon={<ChevronRight aria-hidden="true" />} onClick={onBack} />
    </nav>
  );
}
