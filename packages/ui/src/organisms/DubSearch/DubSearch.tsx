import { useId, useState } from "react";
import { Settings2, X } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { TagSelector } from "../../molecules/TagSelector/TagSelector";
import type { Dub } from "../../types/domain";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { Modal } from "../Modal/Modal";
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
    distributions: ["worldwide", "alist"],
    minBpm: "",
    maxBpm: "",
    fileType: "",
    minBitrate: "",
    maxBitrate: "",
  };
}

export function getDubSearchFilterCount(filters: DubSearchFilters, defaultDistributions: Distribution[] = ["worldwide", "alist"]): number {
  return (
    filters.tags.length +
    Number(
      filters.distributions.length !== defaultDistributions.length ||
      defaultDistributions.some((distribution) => !filters.distributions.includes(distribution)),
    ) +
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
  onSearch?: () => void;
  fileTypes?: string[];
  resultCount: number;
  isSearching?: boolean;
  error?: string | null;
  showDistributionFilter?: boolean;
  defaultDistributions?: Distribution[];
  distributionHint?: string;
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
  onSearch,
  fileTypes = [],
  resultCount,
  isSearching = false,
  error,
  showDistributionFilter = true,
  defaultDistributions = ["worldwide", "alist"],
  distributionHint = "A-List dubs require approval unless public. Select Private to include your own and shared private dubs.",
}: DubSearchProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(filters);
  const mobile = useMobileLayout();
  const filterCount = getDubSearchFilterCount(filters, defaultDistributions);
  const updateFilter = <K extends keyof DubSearchFilters>(
    key: K,
    value: DubSearchFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  function applyFilters(next: DubSearchFilters) {
    setDraft(next);
    onFiltersChange(next);
    onSearch?.();
  }
  function resetFilters() {
    applyFilters({ ...createEmptyDubSearchFilters(), distributions: [...defaultDistributions] });
    setExpanded(false);
  }
  const chips: Array<{ label: string; remove: () => void }> = filters.tags.map((tag) => ({
    label: tag,
    remove: () => applyFilters({ ...filters, tags: filters.tags.filter((item) => item !== tag) }),
  }));
  if (filters.distributions.length !== defaultDistributions.length || defaultDistributions.some((item) => !filters.distributions.includes(item))) {
    const labels = { worldwide: "Worldwide", private: "Private", alist: "A-List" };
    chips.push({
      label: `Distribution: ${filters.distributions.map((item) => labels[item]).join(", ") || "None"}`,
      remove: () => applyFilters({ ...filters, distributions: [...defaultDistributions] }),
    });
  }
  for (const [label, minKey, maxKey] of [["BPM", "minBpm", "maxBpm"], ["kbps", "minBitrate", "maxBitrate"]] as const) {
    if (filters[minKey] || filters[maxKey]) chips.push({
      label: `${label}: ${filters[minKey] || "0"} - ${filters[maxKey] || "any"}`,
      remove: () => applyFilters({ ...filters, [minKey]: "", [maxKey]: "" }),
    });
  }
  if (filters.fileType) chips.push({
    label: `Format: ${filters.fileType}`,
    remove: () => applyFilters({ ...filters, fileType: "" }),
  });

  const footer = (
    <>
      <span aria-live="polite">
        {isSearching
          ? "Searching…"
          : `${resultCount} ${resultCount === 1 ? "dub" : "dubs"} found`}
      </span>
      <div className="dub-search__actions">
        {(filterCount > 0 || getDubSearchFilterCount(draft, defaultDistributions) > 0 || query) && (
          <Button
            onClick={() => {
              onQueryChange("");
              resetFilters();
            }}
            variant="tertiary"
          >
            Clear search
          </Button>
        )}
        <Button form={panelId} type="submit">Apply filters</Button>
      </div>
    </>
  );

  const panel = (
    <form className="dub-search__panel" id={panelId} onSubmit={(event) => {
      event.preventDefault();
      applyFilters(draft);
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
          <span className="dub-search__distribution-hint">{distributionHint}</span>
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
      {mobile
        ? <ModalFooter className="dub-search__footer">{footer}</ModalFooter>
        : <div className="dub-search__footer">{footer}</div>}
    </form>
  );

  return (
    <section aria-label="Search dubs" className="dub-search">
      <div className="dub-search__row">
        <SearchField
          aria-label="Search tracks, artists, tags, or genres"
          onChange={(event) => {
            onQueryChange(event.target.value);
            onSearch?.();
          }}
          placeholder="Search tracks, artists, tags, or genres"
          value={query}
        />
        <Button
          aria-label={filterCount ? `Filters, ${filterCount} active` : "Filters"}
          aria-controls={expanded ? panelId : undefined}
          aria-expanded={expanded}
          aria-haspopup={mobile ? "dialog" : undefined}
          className="dub-search__toggle"
          leadingIcon={<Settings2 />}
          onClick={() => {
            if (!expanded) setDraft(filters);
            setExpanded(!expanded);
          }}
          variant="secondary"
        >
          <span className="dub-search__toggle-label">Filters</span> {filterCount > 0 && <Badge className="dub-search__count">{filterCount}</Badge>}
        </Button>
      </div>
      {filterCount > 0 && (
        <div className="dub-search__active" role="group" aria-label="Active filters">
          {chips.map((chip) => <Button key={chip.label} size="small" variant="tertiary"
            aria-label={`Remove ${chip.label} filter`} leadingIcon={<X aria-hidden="true" />} onClick={chip.remove}>
            {chip.label}
          </Button>)}
          <Button size="small" variant="secondary" onClick={resetFilters}>Clear filters</Button>
        </div>
      )}
      {expanded && (mobile ? (
        <Modal className="dub-search__dialog" isOpen onClose={() => setExpanded(false)} title="Filter dubs">
          {panel}
        </Modal>
      ) : panel)}
      {error && (
        <p className="dub-search__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
