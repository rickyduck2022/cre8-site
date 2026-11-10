import { useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, LockKeyhole, Radio, Settings2, Users, X } from "@craft/icons";
import { Badge } from "../../atoms/Badge/Badge";
import { Button } from "../../atoms/Button/Button";
import { ModalFooter } from "../../molecules/ModalFooter/ModalFooter";
import { SearchField } from "../../molecules/SearchField/SearchField";
import { TagSelector } from "../../molecules/TagSelector/TagSelector";
import type { Dub, MediaKind } from "../../types/domain";
import { useMobileLayout } from "../../utils/useMobileLayout";
import { Modal } from "../Modal/Modal";
import "../../foundations/MediaPalette.css";
import "../../foundations/AudiencePalette.css";
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

function filterSelectionKey(filters: DubSearchFilters) {
  return JSON.stringify({ ...filters, tags: [...filters.tags].sort(), distributions: [...filters.distributions].sort() });
}

export interface DubSearchProps {
  mediaKind?: MediaKind;
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
  error?: string;
}

function RangeInput({
  label,
  unit,
  minValue,
  maxValue,
  max,
  onMinChange,
  onMaxChange,
  error,
}: RangeInputProps) {
  const errorId = useId();
  return (
    <fieldset className="dub-search__range">
      <legend>{label}</legend>
      <label>
        <span>Min {unit}</span>
        <input
          aria-label={`Minimum ${label}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          max={max}
          min="0"
          onChange={(event) => onMinChange(event.target.value)}
          type="number"
          placeholder="No minimum"
          value={minValue}
        />
      </label>
      <label>
        <span>Max {unit}</span>
        <input
          aria-label={`Maximum ${label}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          max={max}
          min="0"
          onChange={(event) => onMaxChange(event.target.value)}
          type="number"
          placeholder="No maximum"
          value={maxValue}
        />
      </label>
      {error && <p className="dub-search__range-error" id={errorId} role="alert">{error}</p>}
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
  mediaKind = "dub",
  distributionHint,
}: DubSearchProps) {
  const noun = mediaKind === "sample" ? "samples" : "dubs";
  const searchLabel = mediaKind === "sample" ? "Search samples, artists, tags, or genres" : "Search tracks, artists, tags, or genres";
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(filters);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const queryRef = useRef<HTMLDivElement>(null);
  const wasExpanded = useRef(false);
  const mobile = useMobileLayout();
  useLayoutEffect(() => {
    if (wasExpanded.current && !expanded) toggleRef.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);
  const filterCount = getDubSearchFilterCount(filters, defaultDistributions);
  const emptyFilters = () => ({ ...createEmptyDubSearchFilters(), distributions: [...defaultDistributions] });
  const draftChanged = filterSelectionKey(draft) !== filterSelectionKey(filters);
  function rangeError(min: string, max: string, limit: number, label: string) {
    if ([min, max].some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > limit))) {
      return `${label} must be between 0 and ${limit}.`;
    }
    return min && max && Number(min) > Number(max) ? `Minimum ${label} must not exceed the maximum.` : undefined;
  }
  const bpmError = rangeError(draft.minBpm, draft.maxBpm, 300, "BPM");
  const bitrateError = rangeError(draft.minBitrate, draft.maxBitrate, 1000, "bitrate");
  const invalidRange = Boolean(bpmError || bitrateError);
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
    applyFilters(emptyFilters());
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
      <div className="dub-search__summary">
        <span aria-live="polite">
          {isSearching
            ? "Searching…"
            : `${resultCount} ${resultCount === 1 ? mediaKind : noun} found`}
        </span>
        <span className="dub-search__draft-hint">{draftChanged ? "Unapplied changes" : "Choose filters, then apply"}</span>
      </div>
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
        <Button form={panelId} type="submit" disabled={invalidRange}>Apply filters</Button>
      </div>
    </>
  );

  const panel = (
    <form className="dub-search__panel" id={panelId} onSubmit={(event) => {
      event.preventDefault();
      if (invalidRange) return;
      applyFilters(draft);
      setExpanded(false);
    }}>
      <div className="dub-search__panel-heading">
        <div><h3>Refine your collection</h3><p>Combine sections to narrow your search. Changes apply when you are ready.</p></div>
        <Button size="small" variant="tertiary" onClick={() => setDraft(emptyFilters())}>Reset choices</Button>
      </div>
      <div className="dub-search__sections">
        {showDistributionFilter && (
          <fieldset className="dub-search__distributions">
            <legend>Release audience</legend>
            <p className="dub-search__section-hint">Select one or more. Results can match any selected audience.</p>
            <div className="dub-search__distribution-options">
              {([
                ["worldwide", "Worldwide", "Open to the community", Users],
                ["private", "Private", "Your own & shared with you", LockKeyhole],
                ["alist", "A-List", "Exclusive & public A-List releases", Radio],
              ] as const).map(([value, label, description, Icon]) => (
                <label className={`dub-search__distribution dub-search__distribution--${value} audience--${value}`} key={value}>
                  <span className="dub-search__audience-icon"><Icon aria-hidden="true" /></span>
                  <span className="dub-search__audience-copy">
                    <strong>{label}</strong>
                    <small id={`${panelId}-${value}-hint`}>{description}</small>
                    <span className="dub-search__audience-state" aria-hidden="true">{draft.distributions.includes(value) ? "Included" : "Not included"}</span>
                  </span>
                  <input
                    aria-label={label}
                    aria-describedby={`${panelId}-${value}-hint`}
                    checked={draft.distributions.includes(value)}
                    onChange={(event) => updateFilter("distributions", event.target.checked
                      ? [...draft.distributions, value]
                      : draft.distributions.filter((item) => item !== value))}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
            <span className="dub-search__distribution-hint">{distributionHint ?? `A-List ${noun} require approval unless public. Select Private to include your own and shared private ${noun}.`}</span>
            {!draft.distributions.length && <p className="dub-search__notice" role="status">No audiences selected. This will return no results.</p>}
          </fieldset>
        )}
        <div className="dub-search__tags">
          <TagSelector
            label="Tags · match any"
            options={DUB_SEARCH_TAGS}
            value={draft.tags}
            onChange={(value) => updateFilter("tags", value)}
          />
          <p className="dub-search__section-hint">Match any selected tag. Leave empty to include every style.</p>
        </div>
        <div className="dub-search__details">
          <div className="dub-search__section-heading"><h3>Sound &amp; file details</h3><p>Leave a field empty for no limit.</p></div>
          <div className="dub-search__controls">
            <RangeInput
              label="BPM"
              unit="BPM"
              minValue={draft.minBpm}
              maxValue={draft.maxBpm}
              max={300}
              error={bpmError}
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
              error={bitrateError}
              onMinChange={(value) => updateFilter("minBitrate", value)}
              onMaxChange={(value) => updateFilter("maxBitrate", value)}
            />
          </div>
        </div>
      </div>
      {mobile
        ? <ModalFooter className="dub-search__footer">{footer}</ModalFooter>
        : <div className="dub-search__footer">{footer}</div>}
    </form>
  );

  return (
    <section aria-label={`Search ${noun}`} className={`dub-search media-kind--${mediaKind}`}>
      <div className="dub-search__row">
        <div className="dub-search__query" ref={queryRef}>
          <SearchField
            aria-label={searchLabel}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onSearch?.();
            }}
            placeholder={searchLabel}
            value={query}
          />
          {query && <Button aria-label="Clear search text" className="dub-search__clear-query" leadingIcon={<X />}
            size="small" variant="tertiary" onClick={() => {
              onQueryChange("");
              queryRef.current?.querySelector("input")?.focus();
              onSearch?.();
            }} />}
        </div>
        <Button
          ref={toggleRef}
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
          variant={filterCount || expanded ? "audio" : "secondary"}
        >
          <span className="dub-search__toggle-label">Filters</span> {filterCount > 0 && <Badge className="dub-search__count">{filterCount}</Badge>}
          <ChevronDown aria-hidden="true" className="dub-search__chevron" />
        </Button>
      </div>
      {!expanded && <div className="dub-search__results" role="status">
        {isSearching ? "Searching…" : `${resultCount} ${resultCount === 1 ? mediaKind : noun} found`}
        {(query || filterCount > 0) && <span>Filtered collection</span>}
      </div>}
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
        <Modal className="dub-search__dialog" isOpen onClose={() => setExpanded(false)} title={`Filter ${noun}`}>
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
