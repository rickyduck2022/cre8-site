import { useState } from "react";
import { ChevronDown } from "@craft/icons";
import { FilterTab } from "../../atoms/FilterTab/FilterTab";
import "../Molecules.css";

export interface FeedControlsProps {
  filters?: string[];
  activeFilter?: string;
  sortOptions?: string[];
  onFilterChange?: (filter: string) => void;
  onSortChange?: (sort: string) => void;
  className?: string;
}

export function FeedControls({
  activeFilter,
  className,
  filters = ["All dubs", "Not played yet", "Enthusiasts"],
  onFilterChange,
  onSortChange,
  sortOptions = ["Latest first", "Oldest first"],
}: FeedControlsProps) {
  const [selected, setSelected] = useState(activeFilter ?? filters[0] ?? "");
  const [sort, setSort] = useState(sortOptions[0] ?? "");

  return (
    <div className={["feed-controls", className].filter(Boolean).join(" ")}>
      <div className="feed-controls__filters" role="tablist" aria-label="Feed filters">
        {filters.map((filter) => (
          <FilterTab
            key={filter}
            active={selected === filter}
            onClick={() => {
              setSelected(filter);
              onFilterChange?.(filter);
            }}
          >
            {filter}
          </FilterTab>
        ))}
      </div>
      <label className="feed-controls__sort">
        <span className="sr-only">Sort feed</span>
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            onSortChange?.(event.target.value);
          }}
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
    </div>
  );
}
