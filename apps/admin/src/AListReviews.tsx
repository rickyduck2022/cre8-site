import { useCallback, useEffect, useState } from "react";
import { Avatar, Badge, Button, Modal, ModalFooter, SearchField, type AListApplication, type AListProvider } from "@craft/ui";

type ReviewApplication = AListApplication & { username: string; displayName: string; approved: boolean };
type Decision = "approve" | "reject" | "request_information" | "revoke";
type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function AListReviews({ request, onChange, refreshKey = 0 }: { request: Request; onChange?: () => void; refreshKey?: number }) {
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; username: string; displayName: string }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [revocationNote, setRevocationNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [confirmation, setConfirmation] = useState<{ action: "reject" | "revoke"; member?: { id: string; displayName: string } } | null>(null);

  const load = useCallback(async () => {
    const [result, memberResult] = await Promise.all([
      request<{ applications: ReviewApplication[] }>("/api/admin/alist/applications"),
      request<{ members: Array<{ id: string; username: string; displayName: string }> }>("/api/admin/alist/members"),
    ]);
    setApplications(result.applications);
    setMembers(memberResult.members);
  }, [request]);
  useEffect(() => {
    setLoading(true);
    setError("");
    void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Applications could not be loaded.")).finally(() => setLoading(false));
  }, [load, refreshKey]);
  const selected = applications.find((item) => item.id === selectedId);
  const fields = selected?.versions.at(-1)?.fields;
  async function decide(action: Decision) {
    if (!selected || busy) return;
    if (action === "request_information" && !note.trim()) { setError("Enter the information you need from the artist."); return; }
    setBusy(true);
    setError("");
    try {
      await request(`/api/admin/alist/applications/${encodeURIComponent(selected.id)}/decision`, {
        method: "POST", body: JSON.stringify({ action, note }),
      });
      setNote("");
      await load();
      onChange?.();
      setConfirmation(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Decision could not be saved.");
    } finally { setBusy(false); }
  }
  async function revokeMember(userId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/admin/alist/members/${encodeURIComponent(userId)}/revoke`, { method: "POST", body: JSON.stringify({ note: revocationNote }) });
      setRevocationNote("");
      await load();
      onChange?.();
      setConfirmation(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Access could not be revoked.");
    } finally { setBusy(false); }
  }
  const filtered = applications.filter((item) => (status === "all" || item.status === status)
    && `${item.versions.at(-1)?.fields.artistName} ${item.username}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.updatedAt.localeCompare(a.updatedAt));
  return <div className="alist-reviews">
    <div className="page-heading"><div><div className="eyebrow">ARTIST JOURNEY / REVIEW & ACCESS</div><h1>A-List reviews</h1><p>Understand the artist, make a decision and keep them informed.</p></div></div>
    <ol className="admin-review-steps" aria-label="Review process"><li><span>01</span> Choose an application</li><li><span>02</span> Read the artist's story</li><li><span>03</span> Decide & respond</li></ol>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <p>Loading applications...</p> : <div className="alist-reviews__layout">
      <section className="panel alist-reviews__list" aria-label="Applications">
        <div><h2>Review queue</h2><p>{applications.filter((item) => item.status === "pending").length} awaiting a decision</p></div>
        <SearchField aria-label="Search applications" placeholder="Artist or username" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label className="admin-field">Application status<select value={status} onChange={(event) => setStatus(event.target.value)}>{["all", "pending", "more_information", "approved", "rejected", "revoked"].map((value) => <option key={value} value={value}>{value === "all" ? "All applications" : value.replaceAll("_", " ")}</option>)}</select></label>
        <div className="alist-reviews__queue">{filtered.length ? filtered.map((item) => <Button variant="tertiary" aria-pressed={selectedId === item.id} className={selectedId === item.id ? "is-active" : ""} key={item.id} onClick={() => { setSelectedId(item.id); setNote(""); setError(""); }}>
          <strong>{item.versions.at(-1)?.fields.artistName}</strong><span>@{item.username}</span><Badge variant={item.status === "pending" ? "accent" : "default"}>{item.status.replaceAll("_", " ")}</Badge><small>Updated {new Date(item.updatedAt).toLocaleDateString()}</small>
        </Button>) : <p className="empty-state">{applications.length ? "No applications match these filters." : "No applications yet."}</p>}</div>
      </section>
      {selected && fields ? <section className="panel alist-reviews__detail" aria-label="Application details">
        <header className="admin-review-identity"><Avatar name={fields.artistName} size="medium" /><div><h2>{fields.artistName}</h2><a href={`/#profile?${new URLSearchParams({ user: selected.username })}`}>@{selected.username}</a></div><Badge variant={selected.status === "pending" ? "accent" : "default"}>{selected.status.replaceAll("_", " ")}</Badge></header>
        <p>Submitted {new Date(selected.createdAt).toLocaleString()}</p>
        <section className="admin-review-section"><h3>01 / Artist identity & experience</h3><dl className="admin-facts">
          <div><dt>Roles</dt><dd>{fields.roles.join(", ")}</dd></div><div><dt>DJ experience</dt><dd>{fields.djExperience}</dd></div><div><dt>Producing experience</dt><dd>{fields.producerExperience || "Not provided"}</dd></div>
        </dl></section>
        <section className="admin-review-section"><h3>02 / Their scene</h3><dl className="admin-facts">
          <div><dt>Events or brands</dt><dd>{fields.events.filter(Boolean).join(", ") || "Not provided"}</dd></div><div><dt>Supporting artists</dt><dd>{fields.supporters.filter(Boolean).join(", ") || "Not provided"}</dd></div><div><dt>Record labels</dt><dd>{fields.labels.filter(Boolean).join(", ") || "Not provided"}</dd></div>
        </dl></section>
        <section className="admin-review-section"><h3>03 / Online presence</h3><div className="admin-socials">
        {(["instagram", "tiktok", "facebook", "soundcloud"] as AListProvider[]).map((provider) => <div key={provider}><strong>{provider}</strong><p>{fields.social[provider].url ? <a href={fields.social[provider].url} target="_blank" rel="noopener noreferrer">{fields.social[provider].url}</a> : "Not provided"}</p>{fields.social[provider].followers !== null && <small>{fields.social[provider].followers?.toLocaleString()} followers (self-reported, unverified)</small>}</div>)}
        </div></section>
        <section className="admin-review-section"><h3>04 / Additional information</h3><p className="alist-reviews__text">{fields.additionalInfo || "Not provided"}</p></section>
        <section className="admin-review-section"><h3>Decision history</h3>
        {selected.decisions.length ? <ul>{selected.decisions.map((decision, index) => <li key={`${decision.decidedAt}-${index}`}>{decision.action.replaceAll("_", " ")} by @{decision.administrator} · {new Date(decision.decidedAt).toLocaleString()}{decision.note && `: ${decision.note}`}</li>)}</ul> : <p>No decisions yet.</p>}
        {selected.versions.length > 1 && <details><summary>Previous submissions</summary>{selected.versions.slice(0, -1).map((version, index) => <div key={`${version.submittedAt}-${index}`}><h3>Submitted {new Date(version.submittedAt).toLocaleString()}</h3><pre className="alist-reviews__text">{JSON.stringify(version.fields, null, 2)}</pre></div>)}</details>}</section>
        {(selected.status === "pending" || (selected.status === "approved" && selected.approved)) && <>
          <div className="admin-review-decision"><h3>Decide & respond</h3><p>Approval grants A-List access. Request information to let the artist update their application.</p>
          <label className="alist-reviews__note">Message to artist (required when requesting information)<textarea maxLength={2000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="alist-reviews__actions">
            {selected.status === "pending" ? <><Button disabled={busy} onClick={() => void decide("approve")}>Approve</Button><Button disabled={busy} variant="secondary" onClick={() => void decide("request_information")}>Request more information</Button><Button disabled={busy} variant="tertiary" onClick={() => setConfirmation({ action: "reject" })}>Reject</Button></> : <Button disabled={busy} variant="secondary" onClick={() => setConfirmation({ action: "revoke" })}>Revoke A-List access</Button>}
          </div></div>
        </>}
      </section> : <section className="panel alist-reviews__detail"><p>Select an application to review it.</p></section>}
    </div>}
    {!loading && <section className="panel alist-reviews__detail" aria-label="Approved members">
      <h2>Approved members</h2>
      <p>Revoke access for any approved member, including members approved before applications were introduced.</p>
      <label className="alist-reviews__note">Revocation message (optional)<textarea maxLength={2000} rows={2} value={revocationNote} onChange={(event) => setRevocationNote(event.target.value)} /></label>
      {members.length ? <ul className="admin-approved-members">{members.map((member) => <li key={member.id}><Avatar name={member.displayName} size="small" /><span><strong>{member.displayName}</strong><small>@{member.username}</small></span><Button size="small" variant="secondary" disabled={busy} onClick={() => setConfirmation({ action: "revoke", member })}>Revoke access for {member.displayName}</Button></li>)}</ul> : <p>No approved members yet.</p>}
    </section>}
    {confirmation && <Modal isOpen title={confirmation.action === "reject" ? "Reject application?" : "Revoke A-List access?"} closeDisabled={busy} onClose={() => { if (!busy) setConfirmation(null); }}>
      <p>{confirmation.action === "reject" ? "The artist can submit a new application after rejection." : `This removes A-List access for ${confirmation.member?.displayName ?? fields?.artistName}.`}</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <ModalFooter><Button disabled={busy} variant="secondary" onClick={() => setConfirmation(null)}>Cancel</Button><Button loading={busy} onClick={() => void (confirmation.member ? revokeMember(confirmation.member.id) : decide(confirmation.action))}>{confirmation.action === "reject" ? "Confirm rejection" : "Confirm revocation"}</Button></ModalFooter>
    </Modal>}
  </div>;
}
