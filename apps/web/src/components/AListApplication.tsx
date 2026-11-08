import { useState, type FormEvent } from "react";
import { Button, type AListApplication as Application, type AListApplicationFields, type AListProvider, type AListRole } from "@craft/ui";
import "./AListApplication.css";

const roles: AListRole[] = ["DJ", "Producer", "DJ & Producer", "MC / Vocalist", "Other"];
const providers: Array<{ key: AListProvider; label: string }> = [
  { key: "instagram", label: "Instagram" }, { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" }, { key: "soundcloud", label: "SoundCloud" },
];

function emptyFields(artistName: string): AListApplicationFields {
  return {
    artistName, roles: [], djExperience: "", producerExperience: "", events: ["", "", ""],
    supporters: ["", "", ""], labels: ["", "", ""],
    social: {
      instagram: { url: "", followers: null }, tiktok: { url: "", followers: null },
      facebook: { url: "", followers: null }, soundcloud: { url: "", followers: null },
    },
    additionalInfo: "",
  };
}

export function AListApplication({ application, artistName, approved, onSubmit }: {
  application: Application | null;
  artistName: string;
  approved?: boolean;
  onSubmit: (fields: AListApplicationFields) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<AListApplicationFields>(() => application?.versions.at(-1)?.fields ?? emptyFields(artistName));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastDecision = application?.decisions.at(-1);
  const canSubmit = !approved && (!application || ["rejected", "revoked", "more_information"].includes(application.status));
  const statusLabel = application?.status === "more_information" ? "More information requested" : application?.status === "pending" ? "Pending review" : application?.status;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields.roles.length) { setError("Select at least one role."); return; }
    setError("");
    setBusy(true);
    try { await onSubmit(fields); } finally { setBusy(false); }
  }

  function setListItem(key: "events" | "supporters" | "labels", index: number, value: string) {
    setFields((current) => ({ ...current, [key]: Array.from({ length: 3 }, (_, i) => i === index ? value : current[key][i] ?? "") }));
  }

  return (
    <div className="alist-application">
      <header className="page-intro"><div><span className="eyebrow">ARTIST COMMUNITY</span><h1>A-List Submission</h1><p>Apply for access to exclusive dubs and A-List distribution.</p></div></header>
      {application && <section className="alist-application__status" aria-label="Application status">
        <strong>Status: {statusLabel}</strong>
        {lastDecision?.note && <p>Admin message: {lastDecision.note}</p>}
        {application.status === "pending" && <p>Your application is awaiting review.</p>}
      </section>}
      {!application && approved && <section className="alist-application__status" aria-label="Application status"><strong>Status: Approved</strong><p>Your account already has A-List access.</p></section>}
      {canSubmit && <form className="alist-application__form" onSubmit={(event) => void submit(event)}>
        <label>Artist name<input required maxLength={100} value={fields.artistName} onChange={(event) => setFields({ ...fields, artistName: event.target.value })} /></label>
        <fieldset><legend>Roles (select all that apply)</legend><div className="alist-application__roles">{roles.map((role) => <label key={role}><input type="checkbox" checked={fields.roles.includes(role)} onChange={(event) => setFields({ ...fields, roles: event.target.checked ? [...fields.roles, role] : fields.roles.filter((item) => item !== role) })} />{role}</label>)}</div></fieldset>
        <label>How long have you been DJing?<input required maxLength={100} value={fields.djExperience} onChange={(event) => setFields({ ...fields, djExperience: event.target.value })} /></label>
        <label>How long have you been producing? (optional)<input maxLength={100} value={fields.producerExperience} onChange={(event) => setFields({ ...fields, producerExperience: event.target.value })} /></label>
        {([["events", "Event or brand"], ["supporters", "Supporting artist"], ["labels", "Record label"]] as const).map(([key, label]) => <fieldset key={key}><legend>Up to three {key === "supporters" ? "supporting artists" : key === "labels" ? "record labels" : "events or brands"}</legend><div className="alist-application__grid">{[0, 1, 2].map((index) => <label key={index}>{label} {index + 1}<input maxLength={120} value={fields[key][index] ?? ""} onChange={(event) => setListItem(key, index, event.target.value)} /></label>)}</div></fieldset>)}
        <fieldset><legend>Social media</legend><p>Follower counts are self-reported and unverified.</p>{providers.map(({ key, label }) => <div className="alist-application__grid" key={key}><label>{label} profile URL{key === "soundcloud" && " (optional)"}<input type="url" required={key !== "soundcloud"} maxLength={300} value={fields.social[key].url} onChange={(event) => setFields({ ...fields, social: { ...fields.social, [key]: { ...fields.social[key], url: event.target.value } } })} /></label><label>{label} followers (optional, unverified)<input type="number" min="0" max="10000000000" step="1" value={fields.social[key].followers ?? ""} onChange={(event) => setFields({ ...fields, social: { ...fields.social, [key]: { ...fields.social[key], followers: event.target.value === "" ? null : Number(event.target.value) } } })} /></label></div>)}</fieldset>
        <label>Additional information (optional)<textarea maxLength={2000} rows={5} value={fields.additionalInfo} onChange={(event) => setFields({ ...fields, additionalInfo: event.target.value })} /></label>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" loading={busy} disabled={busy}>{application ? "Resubmit application" : "Submit application"}</Button>
      </form>}
    </div>
  );
}
