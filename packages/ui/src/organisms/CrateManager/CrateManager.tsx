import { useMemo, useState } from "react";
import { Disc3, Folder, Plus } from "@craft/icons";
import { Button } from "../../atoms/Button/Button";
import { CreateCrateForm } from "../../molecules/CreateCrateForm/CreateCrateForm";
import { SearchField } from "../../molecules/SearchField/SearchField";
import type { Dub } from "../../types/domain";
import "./CrateManager.css";

export interface ManagedCrate {
  id: string;
  name: string;
  dubIds: string[];
}

export interface CrateManagerProps {
  crates: ManagedCrate[];
  dubs: Dub[];
  pendingDub?: Dub | null;
  onCreateCrate: (name: string) => Promise<boolean>;
  onRenameCrate: (crateId: string, name: string) => Promise<boolean>;
  onDeleteCrate: (crateId: string) => Promise<boolean>;
  onSetDubInCrate: (crateId: string, dubId: string, add: boolean) => Promise<boolean>;
  onAddPendingDub?: (crateId: string, dubId: string) => Promise<boolean>;
  onOpenCrate: (crateId: string) => void;
}

export function CrateManager({
  crates,
  dubs,
  pendingDub = null,
  onCreateCrate,
  onRenameCrate,
  onDeleteCrate,
  onSetDubInCrate,
  onAddPendingDub,
  onOpenCrate,
}: CrateManagerProps) {
  const [crateSearch, setCrateSearch] = useState("");
  const [dubSearch, setDubSearch] = useState("");
  const [addingCrate, setAddingCrate] = useState(false);
  const [editingCrateId, setEditingCrateId] = useState<string | null>(null);
  const [deletingCrateId, setDeletingCrateId] = useState<string | null>(null);
  const [expandedCrateId, setExpandedCrateId] = useState<string | null>(null);

  const uniqueCrates = useMemo(() => {
    const grouped = new Map<string, ManagedCrate>();
    for (const crate of crates) {
      const key = crate.name.trim().toLocaleLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.dubIds = [...new Set([...existing.dubIds, ...crate.dubIds])];
      } else {
        grouped.set(key, { ...crate, dubIds: [...crate.dubIds] });
      }
    }
    return [...grouped.values()];
  }, [crates]);

  const visibleCrates = useMemo(() => {
    const query = crateSearch.trim().toLocaleLowerCase();
    return uniqueCrates.filter((crate) => !query || crate.name.toLocaleLowerCase().includes(query));
  }, [crateSearch, uniqueCrates]);

  const visibleDubs = useMemo(() => {
    const query = dubSearch.trim().toLocaleLowerCase();
    return dubs.filter((dub) =>
      !query || [dub.title, dub.artist, dub.genre].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [dubSearch, dubs]);

  async function submitCreate(name: string) {
    const succeeded = await onCreateCrate(name);
    if (succeeded) setAddingCrate(false);
    return succeeded;
  }

  async function submitRename(crateId: string, name: string) {
    const succeeded = await onRenameCrate(crateId, name);
    if (succeeded) setEditingCrateId(null);
    return succeeded;
  }

  async function confirmDelete(crateId: string) {
    if (await onDeleteCrate(crateId)) {
      setDeletingCrateId(null);
      if (expandedCrateId === crateId) setExpandedCrateId(null);
      if (editingCrateId === crateId) setEditingCrateId(null);
    }
  }

  return (
    <div className="crate-manager">
      <p className="crate-manager__intro">
        Organise your dubs into crates. Rename or remove a crate any time; deleting one keeps its tracks in your feed.
      </p>
      <div className="crate-manager__toolbar">
        <SearchField
          aria-label="Search crates"
          onChange={(event) => setCrateSearch(event.currentTarget.value)}
          placeholder="Search crates"
          value={crateSearch}
        />
        <Button
          leadingIcon={<Plus />}
          onClick={() => {
            setAddingCrate((isAdding) => !isAdding);
            setEditingCrateId(null);
          }}
          size="small"
          variant={addingCrate ? "secondary" : "primary"}
        >
          {addingCrate ? "Cancel" : "Add crate"}
        </Button>
      </div>

      {addingCrate && (
        <div className="crate-manager__create">
          <CreateCrateForm
            onCancel={() => setAddingCrate(false)}
            onSubmit={submitCreate}
          />
        </div>
      )}

      {pendingDub && (
        <div className="crate-manager__pending-track" role="status">
          <Disc3 aria-hidden="true" />
          <span>Choose a crate for <strong>{pendingDub.title}</strong></span>
        </div>
      )}

      {visibleCrates.length > 0 ? (
        <ul className="crate-manager__list">
          {visibleCrates.map((crate) => {
            const isExpanded = expandedCrateId === crate.id;
            const isEditing = editingCrateId === crate.id;
            const isDeleting = deletingCrateId === crate.id;
            const pendingDubIsSaved = pendingDub ? crate.dubIds.includes(pendingDub.id) : false;
            return (
              <li className="crate-manager__item" key={crate.id}>
                <article>
                  <div className="crate-manager__row">
                    <div className="crate-manager__identity">
                      <Folder aria-hidden="true" />
                      <div>
                        <strong>{crate.name}</strong>
                        <span>{crate.dubIds.length} {crate.dubIds.length === 1 ? "dub" : "dubs"}</span>
                      </div>
                    </div>
                    <div className="crate-manager__actions">
                      <Button aria-label={`Open ${crate.name}`} onClick={() => onOpenCrate(crate.id)} size="small" variant="tertiary">Open</Button>
                      <Button
                        aria-label={isEditing ? `Cancel editing ${crate.name}` : `Edit ${crate.name}`}
                        onClick={() => {
                          setEditingCrateId(isEditing ? null : crate.id);
                          setAddingCrate(false);
                          setDeletingCrateId(null);
                        }}
                        size="small"
                        variant="tertiary"
                      >
                        {isEditing ? "Cancel edit" : "Edit"}
                      </Button>
                      <Button
                        aria-label={isDeleting ? `Cancel deleting ${crate.name}` : `Delete ${crate.name}`}
                        onClick={() => setDeletingCrateId(isDeleting ? null : crate.id)}
                        size="small"
                        variant="tertiary"
                      >
                        {isDeleting ? "Cancel" : "Delete"}
                      </Button>
                      <Button
                        aria-expanded={isExpanded}
                        onClick={() => {
                          setExpandedCrateId(isExpanded ? null : crate.id);
                          setDubSearch("");
                        }}
                        size="small"
                        variant="secondary"
                      >
                        {isExpanded ? "Hide tracks" : "Manage tracks"}
                      </Button>
                      {pendingDub && onAddPendingDub && (
                        <Button
                          aria-label={pendingDubIsSaved ? `${pendingDub.title} is already in ${crate.name}` : `Add ${pendingDub.title} to ${crate.name}`}
                          disabled={pendingDubIsSaved}
                          onClick={() => void onAddPendingDub(crate.id, pendingDub.id)}
                          size="small"
                          variant="primary"
                        >
                          {pendingDubIsSaved ? "Already added" : "Add to crate"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="crate-manager__inline-form">
                      <CreateCrateForm
                        initialName={crate.name}
                        key={crate.id}
                        onCancel={() => setEditingCrateId(null)}
                        onSubmit={(name) => submitRename(crate.id, name)}
                        submitLabel="Save name"
                      />
                    </div>
                  )}

                  {isDeleting && (
                    <div className="crate-manager__confirm" role="alert">
                      <p>Delete “{crate.name}”? Its tracks will stay in the Dub Feed.</p>
                      <Button onClick={() => void confirmDelete(crate.id)} size="small" variant="primary">Delete crate</Button>
                      <Button onClick={() => setDeletingCrateId(null)} size="small" variant="tertiary">Keep crate</Button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="crate-manager__tracks">
                      <SearchField
                        aria-label={`Search dubs for ${crate.name}`}
                        onChange={(event) => setDubSearch(event.currentTarget.value)}
                        placeholder="Search your dubs"
                        value={dubSearch}
                      />
                      {visibleDubs.length > 0 ? (
                        <ul className="crate-manager__track-list">
                          {visibleDubs.map((dub) => {
                            const isInCrate = crate.dubIds.includes(dub.id);
                            return (
                              <li key={dub.id}>
                                <div className="crate-manager__track-info">
                                  <Disc3 aria-hidden="true" />
                                  <span><strong>{dub.title}</strong><small>{dub.artist} · {dub.genre}</small></span>
                                </div>
                                <Button
                                  aria-label={`${isInCrate ? "Remove" : "Add"} ${dub.title} ${isInCrate ? "from" : "to"} ${crate.name}`}
                                  onClick={() => void onSetDubInCrate(crate.id, dub.id, !isInCrate)}
                                  size="small"
                                  variant={isInCrate ? "tertiary" : "secondary"}
                                >
                                  {isInCrate ? "Remove" : "Add"}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="crate-manager__empty">
                          {dubs.length === 0 ? "Share a dub first, then add it to this crate." : "No dubs match your search."}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="crate-manager__empty" role="status">
          <Folder aria-hidden="true" />
          <strong>{crates.length === 0 ? "No crates yet" : "No matching crates"}</strong>
          <span>{crates.length === 0 ? "Create a crate to start collecting dubs." : "Try a different search."}</span>
        </div>
      )}
    </div>
  );
}
