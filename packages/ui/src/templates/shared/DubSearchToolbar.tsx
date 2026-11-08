import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import "./DubSearchToolbar.css";

interface DubSearchToolbarProps {
  children: ReactNode;
  query: string;
  filterCount: number;
}

export function DubSearchToolbar({ children, query, filterCount }: DubSearchToolbarProps) {
  const [minimized, setMinimized] = useState(false);
  const contentId = useId();

  return (
    <div className={`dub-search-toolbar${minimized ? " dub-search-toolbar--minimized" : ""}`}>
      <div className="dub-search-toolbar__content" id={contentId}>{children}</div>
      {minimized && (
        <div className="dub-search-toolbar__summary">
          <span className="dub-search-toolbar__summary-query">Search: {query.trim() || "All dubs"}</span>
          <span>{filterCount} {filterCount === 1 ? "filter" : "filters"} active</span>
        </div>
      )}
      <Button
        aria-controls={contentId}
        aria-expanded={!minimized}
        aria-label={minimized ? "Expand search controls" : "Minimize search controls"}
        className="dub-search-toolbar__toggle"
        leadingIcon={<ChevronDown />}
        onClick={() => setMinimized((current) => !current)}
        size="small"
        variant="tertiary"
      />
    </div>
  );
}
