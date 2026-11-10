import type { ArtistOption } from "@craft/ui";

export interface PackTrackValues {
  title: string;
  artistId: string;
  bpm: string;
  key: string;
  tags: string;
}

export function packTrackMetadata(values: PackTrackValues) {
  if (!values.title.trim() || !values.artistId) throw new Error("Provide a title and artist.");
  if (values.bpm && (!Number.isInteger(Number(values.bpm)) || Number(values.bpm) < 1 || Number(values.bpm) > 300)) {
    throw new Error("BPM must be between 1 and 300.");
  }
  return {
    title: values.title.trim(), artistId: values.artistId,
    bpm: values.bpm ? Number(values.bpm) : 0, key: values.key.trim(),
    tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

export function PackTrackFields({ values, artists, sample, onChange, editing = false }: {
  values: PackTrackValues;
  artists: ArtistOption[];
  sample: boolean;
  onChange: (patch: Partial<PackTrackValues>) => void;
  editing?: boolean;
}) {
  return <div className="pack-fields">
    <div className="pack-field-grid">
      <label>{editing ? "Title" : "File title"}<input maxLength={100} value={values.title} onChange={(event) => onChange({ title: event.currentTarget.value })} /></label>
      <label>Artist<select value={values.artistId} onChange={(event) => onChange({ artistId: event.currentTarget.value })}>
        {!artists.length && <option value="">Create an artist profile first</option>}
        {artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
      </select></label>
      <label>BPM (optional)<input type="number" min={1} max={300} value={values.bpm} onChange={(event) => onChange({ bpm: event.currentTarget.value })} /></label>
      {sample && <label>Musical key (optional)<input maxLength={30} value={values.key} onChange={(event) => onChange({ key: event.currentTarget.value })} /></label>}
    </div>
    <label>Tags (comma separated)<input value={values.tags} onChange={(event) => onChange({ tags: event.currentTarget.value })} /></label>
  </div>;
}
