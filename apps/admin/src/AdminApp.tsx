import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Avatar, Badge, Button } from "@craft/ui";
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

const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Legacy member";

export function AdminApp() {
  const [section, setSection] = useState<Section>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; displayName: string } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    const result = await request<Dashboard>("/api/admin/overview");
    setDashboard(result);
    return result;
  }, []);

  useEffect(() => {
    void loadDashboard().then((result) => {
      setCurrentUser(result.administrator);
    }).catch((cause: unknown) => {
      if (cause instanceof Error && cause.message !== "Sign in to continue.") setError(cause.message);
    });
  }, [loadDashboard]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await request("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      const result = await loadDashboard();
      setCurrentUser(result.administrator);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await request("/api/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setDashboard(null); setCurrentUser(null); setPassword(""); setSection("overview");
  }

  const filteredUsers = useMemo(() => (dashboard?.users ?? []).filter((user) => `${user.displayName} ${user.username} ${user.genre}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [dashboard, query]);
  const filteredDubs = useMemo(() => (dashboard?.dubs ?? []).filter((dub) => `${dub.title} ${dub.artist} ${dub.uploader} ${dub.genre}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [dashboard, query]);

  if (!currentUser || !dashboard) return <main className="admin-login">
    <div className="admin-login__card">
      <a className="admin-brand" href="#overview" aria-label="cre8 Admin home"><span className="admin-brand__mark">c</span><span>cre8<span className="admin-brand__sub"> / CONTROL ROOM</span></span></a>
      <div className="admin-login__intro"><Badge variant="audio" dot>SECURE ACCESS</Badge><h1>Good to have you back.</h1><p>Sign in with an administrator account to manage the cre8 community.</p></div>
      {error && <div role="alert" className="admin-error">{error}</div>}
      <form className="admin-login__form" onSubmit={handleLogin}>
        <label>Username<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.currentTarget.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></label>
        <Button type="submit" size="large" loading={busy}>Sign in to admin <span aria-hidden="true">↗</span></Button>
      </form>
      <p className="admin-login__foot">Administrator access is managed by your cre8 system owner.</p>
    </div>
    <div className="admin-login__art" aria-hidden="true"><div className="sound-orbit sound-orbit--one"/><div className="sound-orbit sound-orbit--two"/><div className="sound-orbit sound-orbit--three"/><div className="sound-core">c<span>8</span></div><div className="sound-caption">THE COMMUNITY, IN MOTION</div></div>
  </main>;

  const activeItems: Record<Section, string> = { overview: "Overview", members: "Members", releases: "Releases", applications: "A-List Applications" };
  const maxActivity = Math.max(1, ...(dashboard.activity.map((day) => day.uploads + day.members)));
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="#overview"><span className="admin-brand__mark">c</span><span>cre8<span className="admin-brand__sub"> / ADMIN</span></span></a>
      <div className="admin-workspace"><span className="admin-workspace__icon">c8</span><span><strong>Community</strong><small>Administration</small></span><span className="admin-workspace__dots">···</span></div>
      <div className="admin-nav-label">WORKSPACE</div>
      <nav className="admin-nav" aria-label="Admin sections">{(["overview", "members", "releases", "applications"] as Section[]).map((item) => <button key={item} type="button" className={section === item ? "is-active" : ""} onClick={() => { setSection(item); setQuery(""); }}><span className="admin-nav__icon">{item === "overview" ? "◫" : item === "members" ? "♧" : item === "applications" ? "★" : "♫"}</span>{activeItems[item]}{item === "members" && <span className="admin-nav__count">{dashboard.metrics.members}</span>}</button>)}</nav>
      <div className="admin-sidebar__bottom"><div className="admin-live"><span/>All systems operational</div><div className="admin-sidebar__version">CRE8 ADMIN <span>v1.0</span></div></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div className="admin-breadcrumb">Workspace <span>/</span> <strong>{activeItems[section]}</strong></div><div className="admin-topbar__right"><span className="admin-status"><i/> Live data</span><span className="admin-topbar__divider"/><button className="admin-user" onClick={() => void logout()} type="button" title="Sign out"><Avatar name={currentUser.displayName} size="small"/><span><strong>{currentUser.displayName}</strong><small>Administrator · Sign out</small></span><span className="admin-user__arrow">⌄</span></button></div></header>
      <div className="admin-content">
        {error && <div role="alert" className="admin-error admin-error--inline">{error}</div>}
        {section === "applications" && <AListReviews request={request} />}
        {section === "overview" && <>
          <div className="page-heading"><div><div className="eyebrow">SUNDAY, {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date()).toUpperCase()}</div><h1>Community overview<span className="heading-period">.</span></h1><p>Here’s what’s happening across your community.</p></div><Button variant="secondary" onClick={() => void loadDashboard().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed."))}><span aria-hidden="true">↻</span> Refresh data</Button></div>
          <div className="metric-grid">{[{ name: "Total members", value: dashboard.metrics.members, delta: `+${dashboard.metrics.membersThisWeek} this week`, icon: "♧", tone: "lime" }, { name: "Tracks uploaded", value: dashboard.metrics.tracks, delta: `+${dashboard.metrics.uploadsThisWeek} this week`, icon: "♫", tone: "orange" }, { name: "Total downloads", value: dashboard.metrics.downloads, delta: "All time", icon: "↓", tone: "blue" }, { name: "Connections made", value: dashboard.metrics.connections, delta: "Across the community", icon: "⌘", tone: "violet" }].map((metric) => <article className="metric-card" key={metric.name}><div className="metric-card__top"><span>{metric.name}</span><span className={`metric-card__icon metric-card__icon--${metric.tone}`}>{metric.icon}</span></div><div className="metric-card__value">{metric.value.toLocaleString("en-GB")}</div><div className="metric-card__delta"><span>↗</span> {metric.delta}</div></article>)}</div>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Community activity</h2><p>Member sign-ups and new uploads over the last 7 days</p></div><Badge variant="default">LAST 7 DAYS</Badge></div><div className="activity-chart" role="img" aria-label="Daily member sign-ups and track uploads for the past seven days">{dashboard.activity.map((day) => { const height = Math.max(5, (day.uploads + day.members) / maxActivity * 100); return <div className="activity-chart__day" key={day.date}><div className="activity-chart__bars"><div className="activity-chart__bar activity-chart__bar--members" style={{ height: `${Math.max(4, day.members / maxActivity * 100)}%` }} title={`${day.members} members`} /><div className="activity-chart__bar activity-chart__bar--uploads" style={{ height: `${Math.max(4, day.uploads / maxActivity * 100)}%` }} title={`${day.uploads} uploads`} /></div><span className="activity-chart__guide" style={{ bottom: `${height}%` }}/><span className="activity-chart__label">{new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(`${day.date}T12:00:00`))}</span></div> })}</div><div className="activity-legend"><span><i className="activity-legend__member"/> New members</span><span><i className="activity-legend__upload"/> Track uploads</span></div></section>
          <section className="panel"><div className="panel-heading"><div><h2>Top tracks</h2><p>Most downloaded across your community</p></div><button className="text-link" type="button" onClick={() => setSection("releases")}>View all releases <span>→</span></button></div><div className="top-track-list">{dashboard.topDubs.length ? dashboard.topDubs.map((dub, i) => <div className="top-track" key={dub.id}><span className="top-track__rank">{String(i + 1).padStart(2, "0")}</span><span className="top-track__cover">♫</span><span className="top-track__name"><strong>{dub.title}</strong><small>{dub.artist}</small></span><span className="top-track__genre">{dub.genre || "Uncategorized"}</span><span className="top-track__downloads">↓ {dub.downloads}</span><span className="top-track__likes">♡ {dub.likes}</span></div>) : <div className="empty-state">Your first community releases will appear here.</div>}</div></section>
          <div className="admin-footnote">Data shown from your cre8 community <span>·</span> Updated {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(dashboard.generatedAt))}</div>
        </>}
        {section === "members" && <><div className="page-heading"><div><div className="eyebrow">YOUR COMMUNITY</div><h1>Members<span className="heading-period">.</span></h1><p>Get to know the artists and listeners in your community.</p></div><Badge variant="audio" dot>{dashboard.metrics.members} members</Badge></div><div className="table-toolbar"><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search members" aria-label="Search members"/><kbd>⌘ K</kbd></label><span className="table-toolbar__count">{filteredUsers.length} members</span></div><section className="panel data-panel"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>MEMBER</th><th>GENRE</th><th>ROLE</th><th>TRACKS</th><th>CONNECTIONS</th><th>JOINED</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td><div className="member-cell"><Avatar name={user.displayName} size="medium"/><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></div></td><td>{user.genre || "—"}</td><td><Badge variant="default">{user.role}</Badge></td><td>{user.uploads}</td><td>{user.friends}</td><td>{dateLabel(user.createdAt)}</td></tr>)}</tbody></table>{filteredUsers.length === 0 && <div className="empty-state">No members match “{query}”.</div>}</div></section></>}
        {section === "releases" && <><div className="page-heading"><div><div className="eyebrow">THE MUSIC</div><h1>Releases<span className="heading-period">.</span></h1><p>Every track shared with the cre8 community.</p></div><Badge variant="audio" dot>{dashboard.metrics.tracks} releases</Badge></div><div className="table-toolbar"><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search tracks, artists or genres" aria-label="Search releases"/><kbd>⌘ K</kbd></label><span className="table-toolbar__count">{filteredDubs.length} releases</span></div><section className="panel data-panel"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>TRACK</th><th>GENRE</th><th>UPLOADED BY</th><th>LIKES</th><th>DOWNLOADS</th><th>DATE ADDED</th></tr></thead><tbody>{filteredDubs.map((dub) => <tr key={dub.id}><td><div className="release-cell"><span className="release-cell__cover">♫</span><span><strong>{dub.title}</strong><small>{dub.artist}</small></span></div></td><td>{dub.genre || "Uncategorized"}</td><td><span className="uploader">{dub.uploader}<small>@{dub.username}</small></span></td><td>♡ {dub.likes}</td><td>↓ {dub.downloads}</td><td>{dateLabel(dub.uploadedAt)}</td></tr>)}</tbody></table>{filteredDubs.length === 0 && <div className="empty-state">No releases match “{query}”.</div>}</div></section></>}
      </div>
    </main>
  </div>;
}
