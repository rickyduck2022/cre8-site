import { useEffect, useState } from "react";
import { Button, type AListApplication, type AListProvider } from "@craft/ui";

type ReviewApplication = AListApplication & { username: string; displayName: string; approved: boolean };
type Decision = "approve" | "reject" | "request_information" | "revoke";
type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function AListReviews({ request }: { request: Request }) {
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; username: string; displayName: string }>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [revocationNote, setRevocationNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [result, memberResult] = await Promise.all([
      request<{ applications: ReviewApplication[] }>("/api/admin/alist/applications"),
      request<{ members: Array<{ id: string; username: string; displayName: string }> }>("/api/admin/alist/members"),
    ]);
    setApplications(result.applications);
    setMembers(memberResult.members);
  }
  useEffect(() => {
    void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Applications could not be loaded.")).finally(() => setLoading(false));
  }, []);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Access could not be revoked.");
    } finally { setBusy(false); }
  }
  return <div className="alist-reviews">
    <div className="page-heading"><div><div className="eyebrow">ARTIST COMMUNITY</div><h1>A-List applications<span className="heading-period">.</span></h1><p>Review applications and manage A-List access.</p></div></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <p>Loading applications...</p> : <div className="alist-reviews__layout">
      <section className="panel alist-reviews__list" aria-label="Applications">
        {applications.length ? applications.map((item) => <button type="button" className={selectedId === item.id ? "is-active" : ""} key={item.id} onClick={() => { setSelectedId(item.id); setNote(""); setError(""); }}>
          <strong>{item.versions.at(-1)?.fields.artistName}</strong><span>@{item.username}</span><span>{item.status.replaceAll("_", " ")} · {new Date(item.updatedAt).toLocaleDateString()}</span>
        </button>) : <p>No applications yet.</p>}
      </section>
      {selected && fields ? <section className="panel alist-reviews__detail" aria-label="Application details">
        <h2>{fields.artistName} <small>@{selected.username}</small></h2>
        <p>Status: <strong>{selected.status.replaceAll("_", " ")}</strong> · Submitted {new Date(selected.createdAt).toLocaleString()}</p>
        <p>Roles: {fields.roles.join(", ")}</p>
        <p>DJ experience: {fields.djExperience}</p>
        <p>Producing experience: {fields.producerExperience || "Not provided"}</p>
        <p>Events or brands: {fields.events.join(", ") || "Not provided"}</p>
        <p>Supporting artists: {fields.supporters.join(", ") || "Not provided"}</p>
        <p>Record labels: {fields.labels.join(", ") || "Not provided"}</p>
        <h3>Social media</h3>
        {(["instagram", "tiktok", "facebook", "soundcloud"] as AListProvider[]).map((provider) => <p key={provider}>{provider}: {fields.social[provider].url ? <a href={fields.social[provider].url} target="_blank" rel="noopener noreferrer">{fields.social[provider].url}</a> : "Not provided"} {fields.social[provider].followers !== null && ` · ${fields.social[provider].followers?.toLocaleString()} followers (self-reported, unverified)`}</p>)}
        <h3>Additional information</h3><p className="alist-reviews__text">{fields.additionalInfo || "Not provided"}</p>
        <h3>Decision history</h3>
        {selected.decisions.length ? <ul>{selected.decisions.map((decision, index) => <li key={`${decision.decidedAt}-${index}`}>{decision.action.replaceAll("_", " ")} by @{decision.administrator} · {new Date(decision.decidedAt).toLocaleString()}{decision.note && `: ${decision.note}`}</li>)}</ul> : <p>No decisions yet.</p>}
        {selected.versions.length > 1 && <details><summary>Previous submissions</summary>{selected.versions.slice(0, -1).map((version, index) => <div key={`${version.submittedAt}-${index}`}><h3>Submitted {new Date(version.submittedAt).toLocaleString()}</h3><pre className="alist-reviews__text">{JSON.stringify(version.fields, null, 2)}</pre></div>)}</details>}
        {(selected.status === "pending" || (selected.status === "approved" && selected.approved)) && <>
          <label className="alist-reviews__note">Message to artist (required when requesting information)<textarea maxLength={2000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="alist-reviews__actions">
            {selected.status === "pending" ? <><Button disabled={busy} onClick={() => void decide("approve")}>Approve</Button><Button disabled={busy} variant="secondary" onClick={() => void decide("reject")}>Reject</Button><Button disabled={busy} variant="secondary" onClick={() => void decide("request_information")}>Request more information</Button></> : <Button disabled={busy} variant="secondary" onClick={() => void decide("revoke")}>Revoke A-List access</Button>}
          </div>
        </>}
      </section> : <section className="panel alist-reviews__detail"><p>Select an application to review it.</p></section>}
    </div>}
    {!loading && members.length > 0 && <section className="panel alist-reviews__detail">
      <h2>Approved members</h2>
      <p>Revoke access for any approved member, including members approved before applications were introduced.</p>
      <label className="alist-reviews__note">Revocation message (optional)<textarea maxLength={2000} rows={2} value={revocationNote} onChange={(event) => setRevocationNote(event.target.value)} /></label>
      <ul>{members.map((member) => <li key={member.id}>{member.displayName} (@{member.username}){" "}<Button size="small" variant="secondary" disabled={busy} onClick={() => void revokeMember(member.id)}>Revoke access for {member.displayName}</Button></li>)}</ul>
    </section>}
  </div>;
}
