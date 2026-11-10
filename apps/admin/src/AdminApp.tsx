import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Avatar, Badge, Brand, Button, Navigation, SearchField, type AListApplication } from "@craft/ui";
import { AudioLines, Disc3, Radio, Users } from "@craft/icons";
import { AListReviews } from "./AListReviews";

type Section = "overview" | "members" | "releases" | "applications";
type UserRow = { id: string; username: string; displayName: string; genre: string; role: string; presence: string; createdAt: string | null; uploads: number; friends: number };
type DubRow = { id: string; title: string; artist: string; uploader: string; username: string; uploadedAt: string; genre: string; tags: string[]; likes: number; downloads: number };
type Dashboard = { generatedAt: string; administrator: { username: string; displayName: string }; metrics: { members: number; tracks: number; downloads: number; connections: number; uploadsThisWeek: number; membersThisWeek: number }; users: UserRow[]; dubs: DubRow[]; topDubs: DubRow[]; activity: Array<{ date: string; uploads: number; members: number }> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
  return body as T;
}

const sectionLabels: Record<Section, string> = { overview: "Overview", applications: "A-List reviews", members: "Members", releases: "Releases" };
function readSection(): Section {
  const hash = window.location.hash.slice(1);
  return hash === "members" || hash === "releases" || hash === "applications" ? hash : "overview";
}
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Legacy member";

export function AdminApp() {
  const [section, setSection] = useState<Section>(readSection);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    const [result, reviews] = await Promise.all([
      request<Dashboard>("/api/admin/overview"),
      request<{ applications: AListApplication[] }>("/api/admin/alist/applications"),
    ]);
    setDashboard(result);
    setPendingReviews(reviews.applications.filter((application) => application.status === "pending").length);
  }, []);

  useEffect(() => {
    void loadDashboard().catch((cause: unknown) => {
      if (cause instanceof Error && cause.message !== "Sign in to continue.") setError(cause.message);
    }).finally(() => setLoading(false));
  }, [loadDashboard]);

  useEffect(() => {
    const update = () => { setSection(readSection()); setQuery(""); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  function navigate(next: Section) {
    window.location.hash = next;
    setSection(next);
    setQuery("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setBusy(true);
    try {
      await request("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      await loadDashboard();
      setPassword("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try {
      await request("/api/logout", { method: "POST", body: "{}" });
      setDashboard(null); setPassword(""); navigate("overview");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-out failed."); }
    finally { setBusy(false); }
  }

  async function refresh(reloadReviews = true) {
    setBusy(true); setError("");
    try {
      await loadDashboard();
      if (reloadReviews) setReviewRefreshKey((key) => key + 1);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Refresh failed."); }
    finally { setBusy(false); }
  }

  const filteredUsers = useMemo(() => (dashboard?.users ?? []).filter((user) => `${user.displayName} ${user.username} ${user.genre}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [dashboard, query]);
  const filteredDubs = useMemo(() => (dashboard?.dubs ?? []).filter((dub) => `${dub.title} ${dub.artist} ${dub.uploader} ${dub.genre}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [dashboard, query]);

  if (loading) return <main className="admin-login"><p role="status">Loading administration...</p></main>;
  if (!dashboard) return <main className="admin-login">
    <section className="admin-login__card" aria-labelledby="admin-login-title">
      <Brand href="#overview" /><Badge variant="accent">ADMINISTRATION</Badge>
      <div><h1 id="admin-login-title">Look after your community.</h1><p>Review artist applications, manage A-List access and explore community activity.</p></div>
      {error && <p role="alert" className="admin-error">{error}</p>}
      <form className="admin-login__form" onSubmit={(event) => void handleLogin(event)}>
        <label>Username<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.currentTarget.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></label>
        <Button type="submit" loading={busy}>Sign in to admin</Button>
      </form>
      <p>Administrator access is managed by your cre8 system owner.</p>
      <a href="/">Back to community</a>
    </section>
  </main>;

  const currentUser = dashboard.administrator;
  const navItem = (key: Section, icon: ReactNode, badge?: string) => ({
    label: sectionLabels[key], href: `#${key}`, icon, badge,
    onClick: () => { setSection(key); setQuery(""); },
  });
  const maxActivity = Math.max(1, ...dashboard.activity.flatMap((day) => [day.uploads, day.members]));
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Navigation activeItem={sectionLabels[section]} userName={currentUser.displayName} userDetail="Administrator"
        sections={[
          { label: "Workspace", items: [navItem("overview", <Radio />)] },
          { label: "Artist journey", items: [navItem("applications", <AudioLines />, String(pendingReviews))] },
          { label: "Community", items: [navItem("members", <Users />, String(dashboard.metrics.members)), navItem("releases", <Disc3 />, String(dashboard.metrics.tracks))] },
        ]} />
      <div className="admin-sidebar__actions"><a href="/">Open community</a><Button variant="tertiary" size="small" disabled={busy} onClick={() => void logout()}>Sign out</Button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span><span className="eyebrow">ADMINISTRATION</span><strong>{sectionLabels[section]}</strong></span><div><Avatar name={currentUser.displayName} size="small" /><Button variant="secondary" size="small" loading={busy} onClick={() => void refresh()}>Refresh data</Button></div></header>
      <div className="admin-content">
        {error && <p role="alert" className="admin-error">{error}</p>}
        {section === "applications" && <AListReviews request={request} refreshKey={reviewRefreshKey} onChange={() => void refresh(false)} />}
        {section === "overview" && <>
          <div className="page-heading"><div><span className="eyebrow">COMMUNITY WORKSPACE</span><h1>Your community, in focus.</h1><p>Start with artist reviews, then follow the people and music behind the numbers.</p></div><Badge variant="default">{dateLabel(dashboard.generatedAt)}</Badge></div>
          <section className="admin-journeys" aria-label="Administration tasks">
            <article className="admin-journey admin-journey--priority"><AudioLines aria-hidden="true" /><Badge variant="accent">{pendingReviews} pending</Badge><h2>Review artist applications</h2><p>Read an artist's story, request more information or grant A-List access.</p><Button onClick={() => navigate("applications")}>Review A-List applications</Button></article>
            <article className="admin-journey"><Users aria-hidden="true" /><h2>Explore your members</h2><p>Find an artist and understand their uploads, connections and community profile.</p><Button variant="secondary" onClick={() => navigate("members")}>Browse members</Button></article>
            <article className="admin-journey"><Disc3 aria-hidden="true" /><h2>Follow the music</h2><p>Find releases by track, artist or genre and see how the community engages.</p><Button variant="secondary" onClick={() => navigate("releases")}>Browse releases</Button></article>
          </section>
          <section className="metric-grid" aria-label="Community totals">
            {[["Members", dashboard.metrics.members, `${dashboard.metrics.membersThisWeek} new this week`], ["Tracks uploaded", dashboard.metrics.tracks, `${dashboard.metrics.uploadsThisWeek} new this week`], ["Downloads", dashboard.metrics.downloads, "All time"], ["Connections", dashboard.metrics.connections, "Across the community"]].map(([label, value, detail]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value.toLocaleString("en-GB")}</strong><small>{detail}</small></article>)}
          </section>
          <section className="panel activity-panel" aria-labelledby="activity-title"><div className="panel-heading"><div><h2 id="activity-title">Community activity</h2><p>New members and uploads over the last seven days.</p></div></div>
            <div className="activity-chart" role="img" aria-label={dashboard.activity.map((day) => `${day.date}: ${day.members} new members, ${day.uploads} uploads`).join("; ")}>
              {dashboard.activity.map((day) => <div className="activity-chart__day" key={day.date}><div className="activity-chart__bars"><span className="activity-chart__bar activity-chart__bar--members" style={{ height: `${day.members / maxActivity * 100}%` }} /><span className="activity-chart__bar activity-chart__bar--uploads" style={{ height: `${day.uploads / maxActivity * 100}%` }} /></div><small>{new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(`${day.date}T12:00:00`))}</small></div>)}
            </div><div className="activity-legend"><span>New members</span><span>Track uploads</span></div>
          </section>
          <section className="panel"><div className="panel-heading"><div><h2>Most downloaded</h2><p>The releases connecting with your community.</p></div><Button variant="tertiary" size="small" onClick={() => navigate("releases")}>View releases</Button></div>
            <div className="top-track-list">{dashboard.topDubs.length ? dashboard.topDubs.map((dub, index) => <div className="top-track" key={dub.id}><span className="top-track__rank">{index + 1}</span><Disc3 aria-hidden="true" /><span className="top-track__name"><strong>{dub.title}</strong><small>{dub.artist}</small></span><Badge variant="default">{dub.downloads} downloads</Badge></div>) : <p className="empty-state">Your first community releases will appear here.</p>}</div>
          </section>
        </>}
        {(section === "members" || section === "releases") && <>
          <div className="page-heading"><div><span className="eyebrow">COMMUNITY / {section.toUpperCase()}</span><h1>{sectionLabels[section]}</h1><p>{section === "members" ? "Find artists and explore their community activity." : "Discover uploads and understand their reach."}</p></div>{section === "members" && <Button variant="secondary" onClick={() => navigate("applications")}>Manage A-List access</Button>}</div>
          <div className="table-toolbar"><SearchField aria-label={section === "members" ? "Search members" : "Search releases"} placeholder={section === "members" ? "Search names, usernames or genres" : "Search tracks, artists or genres"} value={query} onChange={(event) => setQuery(event.target.value)} /><span role="status">{section === "members" ? filteredUsers.length : filteredDubs.length} results</span></div>
          <section className="panel data-panel" aria-label={section === "members" ? "Member directory" : "Release inventory"}><div className="data-table-wrap" role="region" aria-label={`Scrollable ${section} table`} tabIndex={0}><table className="data-table"><caption className="sr-only">{section === "members" ? "Community members" : "Community releases"}</caption>
            <thead><tr>{(section === "members" ? ["Member", "Genre", "Role", "Uploads", "Connections", "Joined", "Profile"] : ["Track", "Genre", "Uploaded by", "Likes", "Downloads", "Added"]).map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{section === "members" ? filteredUsers.map((user) => <tr key={user.id}><td><div className="member-cell"><Avatar name={user.displayName} size="small" /><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></div></td><td>{user.genre || "Not provided"}</td><td><Badge variant="default">{user.role}</Badge></td><td>{user.uploads}</td><td>{user.friends}</td><td>{dateLabel(user.createdAt)}</td><td><a href={`/#profile?${new URLSearchParams({ user: user.username })}`}>View profile</a></td></tr>) : filteredDubs.map((dub) => <tr key={dub.id}><td><div className="release-cell"><Disc3 aria-hidden="true" /><span><strong>{dub.title}</strong><small>{dub.artist}</small></span></div></td><td>{dub.genre || "Uncategorized"}</td><td><a href={`/#profile?${new URLSearchParams({ user: dub.username })}`}>{dub.uploader}</a></td><td>{dub.likes}</td><td>{dub.downloads}</td><td>{dateLabel(dub.uploadedAt)}</td></tr>)}</tbody>
          </table></div>{(section === "members" ? filteredUsers : filteredDubs).length === 0 && <div className="empty-state"><h2>No {section} found</h2><p>{query ? "Try a different name, artist or genre." : "Community activity will appear here."}</p>{query && <Button variant="secondary" size="small" onClick={() => setQuery("")}>Clear search</Button>}</div>}</section>
        </>}
        <p className="admin-footnote">Snapshot updated {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(dashboard.generatedAt))}. Refresh to retrieve the latest activity.</p>
      </div>
    </main>
  </div>;
}
