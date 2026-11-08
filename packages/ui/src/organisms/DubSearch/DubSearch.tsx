import { useId, useState } from "react";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { TagSelector } from "../../molecules/TagSelector/TagSelector";
import type { Dub } from "../../templates/communityTypes";
import "./DubSearch.css";

type Distribution = NonNullable<Dub["distribution"]>;

export interface DubSearchFilters {
  tags: string[];
  distributions: Distribution[];
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
    distributions: [],
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
    filters.distributions.length +
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
  showDistributionFilter?: boolean;
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
  showDistributionFilter = true,
}: DubSearchProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(filters);
  const filterCount = getDubSearchFilterCount(filters);
  const updateFilter = <K extends keyof DubSearchFilters>(
    key: K,
    value: DubSearchFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

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
          onClick={() => {
            if (!expanded) setDraft(filters);
            setExpanded(!expanded);
          }}
          variant="secondary"
        >
          Filters {filterCount > 0 && <Badge>{filterCount}</Badge>}
        </Button>
      </div>
      {expanded && (
        <form className="dub-search__panel" id={panelId} onSubmit={(event) => {
          event.preventDefault();
          onFiltersChange(draft);
          setExpanded(false);
        }}>
          {showDistributionFilter && (
            <fieldset className="dub-search__distributions">
              <legend>Distribution · match any</legend>
              <div className="dub-search__distribution-options">
                {([
                  ["worldwide", "Worldwide"],
                  ["private", "Private"],
                  ["alist", "A-List"],
                ] as const).map(([value, label]) => (
                  <label className={`dub-search__distribution dub-search__distribution--${value}`} key={value}>
                    <input
                      checked={draft.distributions.includes(value)}
                      onChange={(event) => updateFilter("distributions", event.target.checked
                        ? [...draft.distributions, value]
                        : draft.distributions.filter((item) => item !== value))}
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <span className="dub-search__distribution-hint">By default, the feed shows Worldwide and eligible A-List dubs. Select Private to include your own and shared private dubs.</span>
            </fieldset>
          )}
          <TagSelector
            label="Tags · match any"
            options={DUB_SEARCH_TAGS}
            value={draft.tags}
            onChange={(value) => updateFilter("tags", value)}
          />
          <div className="dub-search__controls">
            <RangeInput
              label="BPM"
              unit="BPM"
              minValue={draft.minBpm}
              maxValue={draft.maxBpm}
              max={300}
              onMinChange={(value) => updateFilter("minBpm", value)}
              onMaxChange={(value) => updateFilter("maxBpm", value)}
            />
            <label className="dub-search__select">
              <span>File type</span>
              <select
                aria-label="File type"
                onChange={(event) => updateFilter("fileType", event.target.value)}
                value={draft.fileType}
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
              minValue={draft.minBitrate}
              maxValue={draft.maxBitrate}
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
            <div className="dub-search__actions">
              {(filterCount > 0 || getDubSearchFilterCount(draft) > 0 || query) && (
                <Button
                  onClick={() => {
                    onQueryChange("");
                    const empty = createEmptyDubSearchFilters();
                    setDraft(empty);
                    onFiltersChange(empty);
                  }}
                  variant="tertiary"
                >
                  Clear search
                </Button>
              )}
              <Button type="submit">Apply filters</Button>
            </div>
          </div>
        </form>
      )}
      {error && (
        <p className="dub-search__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
