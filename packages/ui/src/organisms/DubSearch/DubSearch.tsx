import { useId, useState } from "react";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { TagSelector } from "../../molecules/TagSelector/TagSelector";
import "./DubSearch.css";

export interface DubSearchFilters {
  tags: string[];
  minBpm: string;
  maxBpm: string;
  fileType: string;
  minBitrate: string;
  maxBitrate: string;
}

export const DUB_SEARCH_TAGS = [
  "Jump Up",
  "Rollers",
  "Dancefloor",
  "Jungle",
  "Liquid",
  "Neurofunk",
  "Vocal",
  "Deep",
  "Minimal",
  "Techstep",
  "Atmospheric",
  "Old School",
];

export function createEmptyDubSearchFilters(): DubSearchFilters {
  return {
    tags: [],
    minBpm: "",
    maxBpm: "",
    fileType: "",
    minBitrate: "",
    maxBitrate: "",
  };
}

export function getDubSearchFilterCount(filters: DubSearchFilters): number {
  return (
    filters.tags.length +
    Number(Boolean(filters.minBpm || filters.maxBpm)) +
    Number(Boolean(filters.fileType)) +
    Number(Boolean(filters.minBitrate || filters.maxBitrate))
  );
}

export interface DubSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  filters: DubSearchFilters;
  onFiltersChange: (filters: DubSearchFilters) => void;
  fileTypes?: string[];
  resultCount: number;
  isSearching?: boolean;
  error?: string | null;
}

interface RangeInputProps {
  label: string;
  unit: string;
  minValue: string;
  maxValue: string;
  max: number;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}

function RangeInput({
  label,
  unit,
  minValue,
  maxValue,
  max,
  onMinChange,
  onMaxChange,
}: RangeInputProps) {
  return (
    <fieldset className="dub-search__range">
      <legend>{label}</legend>
      <label>
        <span>Min {unit}</span>
        <input
          aria-label={`Minimum ${label}`}
          max={max}
          min="0"
          onChange={(event) => onMinChange(event.target.value)}
          type="number"
          value={minValue}
        />
      </label>
      <label>
        <span>Max {unit}</span>
        <input
          aria-label={`Maximum ${label}`}
          max={max}
          min="0"
          onChange={(event) => onMaxChange(event.target.value)}
          type="number"
          value={maxValue}
        />
      </label>
    </fieldset>
  );
}

export function DubSearch({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  fileTypes = [],
  resultCount,
  isSearching = false,
  error,
}: DubSearchProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const filterCount = getDubSearchFilterCount(filters);
  const updateFilter = <K extends keyof DubSearchFilters>(
    key: K,
    value: DubSearchFilters[K],
  ) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section aria-label="Search dubs" className="dub-search">
      <div className="dub-search__row">
        <SearchField
          aria-label="Search tracks, artists, tags, or genres"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search tracks, artists, tags, or genres"
          value={query}
        />
        <Button
          aria-controls={panelId}
          aria-expanded={expanded}
          className="dub-search__toggle"
          onClick={() => setExpanded(!expanded)}
          variant="secondary"
        >
          Filters {filterCount > 0 && <Badge>{filterCount}</Badge>}
        </Button>
      </div>
      {expanded && (
        <div className="dub-search__panel" id={panelId}>
          <TagSelector
            label="Tags · match any"
            options={DUB_SEARCH_TAGS}
            value={filters.tags}
            onChange={(value) => updateFilter("tags", value)}
          />
          <div className="dub-search__controls">
            <RangeInput
              label="BPM"
              unit="BPM"
              minValue={filters.minBpm}
              maxValue={filters.maxBpm}
              max={300}
              onMinChange={(value) => updateFilter("minBpm", value)}
              onMaxChange={(value) => updateFilter("maxBpm", value)}
            />
            <label className="dub-search__select">
              <span>File type</span>
              <select
                aria-label="File type"
                onChange={(event) => updateFilter("fileType", event.target.value)}
                value={filters.fileType}
              >
                <option value="">Any format</option>
                {fileTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <RangeInput
              label="Bitrate"
              unit="kbps"
              minValue={filters.minBitrate}
              maxValue={filters.maxBitrate}
              max={1000}
              onMinChange={(value) => updateFilter("minBitrate", value)}
              onMaxChange={(value) => updateFilter("maxBitrate", value)}
            />
          </div>
          <div className="dub-search__footer">
            <span aria-live="polite">
              {isSearching
                ? "Searching…"
                : `${resultCount} ${resultCount === 1 ? "dub" : "dubs"} found`}
            </span>
            {(filterCount > 0 || query) && (
              <Button
                onClick={() => {
                  onQueryChange("");
                  onFiltersChange(createEmptyDubSearchFilters());
                }}
                variant="tertiary"
              >
                Clear search
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="dub-search__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
