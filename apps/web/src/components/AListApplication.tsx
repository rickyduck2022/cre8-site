import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AudioLines, Check, Disc3, Radio, Send, Users } from "@craft/icons";
import { Button, type AListApplication as Application, type AListApplicationFields, type AListProvider, type AListRole } from "@craft/ui";
import "./AListApplication.css";

const roles: AListRole[] = ["DJ", "Producer", "DJ & Producer", "MC / Vocalist", "Other"];
const providers: Array<{ key: AListProvider; label: string }> = [
  { key: "instagram", label: "Instagram" }, { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" }, { key: "soundcloud", label: "SoundCloud" },
];

function ApplicationSection({ number, title, description, optional = false, children }: {
  number: string; title: string; description: string; optional?: boolean; children: ReactNode;
}) {
  const titleId = useId();
  return <section className="alist-application__section" aria-labelledby={titleId}>
    <header className="alist-application__section-heading">
      <span className="alist-application__section-number" aria-hidden="true">{number}</span>
      <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
      <span className="alist-application__requirement">{optional ? "Optional" : "Required"}</span>
    </header>
    <div className="alist-application__section-body">{children}</div>
  </section>;
}

const roleIcons = [Disc3, AudioLines, Radio, Users, Check];

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
  const roleErrorId = useId();
  const firstRoleRef = useRef<HTMLInputElement>(null);
  const lastDecision = application?.decisions.at(-1);
  const canSubmit = !approved && (!application || ["rejected", "revoked", "more_information"].includes(application.status));
  const statusLabel = application?.status === "more_information" ? "More information requested" : application?.status === "pending" ? "Pending review" : application?.status;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields.roles.length) { setError("Select at least one role."); firstRoleRef.current?.focus(); return; }
    setError("");
    setBusy(true);
    try { await onSubmit(fields); } finally { setBusy(false); }
  }

  function setListItem(key: "events" | "supporters" | "labels", index: number, value: string) {
    setFields((current) => ({ ...current, [key]: Array.from({ length: 3 }, (_, i) => i === index ? value : current[key][i] ?? "") }));
  }

  return (
    <div className="alist-application">
      <header className="alist-application__intro">
        <div><span className="eyebrow">ARTIST COMMUNITY / A-LIST</span><h1>A-List Submission</h1><p>Your sound. Your story. Tell us what you bring to the community.</p></div>
        <div className="alist-application__intro-note"><Radio aria-hidden="true" /><p>Apply for access to exclusive dubs and A-List distribution.<span>Applications are reviewed by the cre8 team.</span></p></div>
      </header>
      {application && <section className="alist-application__status" aria-label="Application status">
        <strong>Status: {statusLabel}</strong>
        {lastDecision?.note && <p>Admin message: {lastDecision.note}</p>}
        {application.status === "pending" && <p>Your application is awaiting review.</p>}
      </section>}
      {!application && approved && <section className="alist-application__status" aria-label="Application status"><strong>Status: Approved</strong><p>Your account already has A-List access.</p></section>}
      {canSubmit && <form className="alist-application__form" onSubmit={(event) => void submit(event)}>
        <ApplicationSection number="01" title="Artist identity" description="Start with the name and roles that represent you.">
          <label>Artist name<input required autoComplete="nickname" maxLength={100} value={fields.artistName} onChange={(event) => setFields({ ...fields, artistName: event.target.value })} /></label>
          <fieldset aria-describedby={error ? roleErrorId : undefined}><legend>Roles (select all that apply)</legend>
            <div className="alist-application__roles">{roles.map((role, index) => {
              const Icon = roleIcons[index];
              return <label key={role}>
                <Icon aria-hidden="true" />
                <span>{role}</span>
                <input ref={index === 0 ? firstRoleRef : undefined} type="checkbox" checked={fields.roles.includes(role)}
                  onChange={(event) => {
                    setFields({ ...fields, roles: event.target.checked ? [...fields.roles, role] : fields.roles.filter((item) => item !== role) });
                    if (event.target.checked) setError("");
                  }} />
              </label>;
            })}</div>
            {error && <p className="alist-application__error" id={roleErrorId} role="alert">{error}</p>}
          </fieldset>
        </ApplicationSection>
        <ApplicationSection number="02" title="Behind the sound" description="Give us a little background on your musical journey.">
          <div className="alist-application__grid alist-application__experience">
            <label>How long have you been DJing?<input required maxLength={100} placeholder="e.g. 5 years, playing clubs and radio" value={fields.djExperience} onChange={(event) => setFields({ ...fields, djExperience: event.target.value })} /></label>
            <label>How long have you been producing? (optional)<input maxLength={100} placeholder="e.g. 3 years, focused on jungle" value={fields.producerExperience} onChange={(event) => setFields({ ...fields, producerExperience: event.target.value })} /></label>
          </div>
        </ApplicationSection>
        <ApplicationSection number="03" title="Your scene" description="Share a few highlights: where you play, who supports you and where you release." optional>
          <div className="alist-application__highlights">
            {([["events", "Event or brand", "Events & brands", Radio], ["supporters", "Supporting artist", "Artist support", Users], ["labels", "Record label", "Record labels", Disc3]] as const).map(([key, label, title, Icon]) =>
              <fieldset className="alist-application__highlight" key={key} aria-label={`Up to three ${key === "supporters" ? "supporting artists" : key === "labels" ? "record labels" : "events or brands"} (optional)`}>
                <legend><Icon aria-hidden="true" />{title}</legend>
                <p>Up to three {key === "supporters" ? "supporting artists" : key === "labels" ? "record labels" : "events or brands"}.</p>
                <div className="alist-application__list">{[0, 1, 2].map((index) =>
                  <label key={index}><span className="sr-only">{label} {index + 1}</span><span className="alist-application__list-number" aria-hidden="true">{index + 1}</span>
                    <input aria-label={`${label} ${index + 1}`} maxLength={120} placeholder={label} value={fields[key][index] ?? ""} onChange={(event) => setListItem(key, index, event.target.value)} />
                  </label>)}</div>
              </fieldset>)}
          </div>
        </ApplicationSection>
        <ApplicationSection number="04" title="Find you online" description="Link the profiles that best showcase your music and community." optional>
          <fieldset><legend className="sr-only">Social media (optional)</legend>
            <p className="alist-application__hint">Follower counts are self-reported and unverified.</p>
            <div className="alist-application__socials">{providers.map(({ key, label }) =>
              <div className="alist-application__social-card" key={key}>
                <div className="alist-application__provider"><span aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span><h3>{label}</h3></div>
                <label><span className="sr-only">{label} </span>profile URL<input type="url" maxLength={300} placeholder="https://" value={fields.social[key].url} onChange={(event) => setFields({ ...fields, social: { ...fields.social, [key]: { ...fields.social[key], url: event.target.value } } })} /></label>
                <label><span className="sr-only">{label} </span>followers (optional, unverified)<input type="number" inputMode="numeric" min="0" max="10000000000" step="1" placeholder="Not provided" value={fields.social[key].followers ?? ""} onChange={(event) => setFields({ ...fields, social: { ...fields.social, [key]: { ...fields.social[key], followers: event.target.value === "" ? null : Number(event.target.value) } } })} /></label>
              </div>)}</div>
          </fieldset>
        </ApplicationSection>
        <ApplicationSection number="05" title="Anything else?" description="A little more context can help us understand your work." optional>
          <label>Additional information (optional)<textarea maxLength={2000} rows={4} placeholder="Residencies, radio shows, upcoming releases, or anything else you'd like us to know..." value={fields.additionalInfo} onChange={(event) => setFields({ ...fields, additionalInfo: event.target.value })} /></label>
          <span className="alist-application__character-count">{fields.additionalInfo.length.toLocaleString()} / 2,000</span>
        </ApplicationSection>
        <footer className="alist-application__submit"><div><strong>Ready to send your story?</strong><p>Check your details before sending them for review.</p></div><Button type="submit" leadingIcon={<Send aria-hidden="true" />} loading={busy} disabled={busy}>{application ? "Resubmit application" : "Submit application"}</Button></footer>
      </form>}
    </div>
  );
}
