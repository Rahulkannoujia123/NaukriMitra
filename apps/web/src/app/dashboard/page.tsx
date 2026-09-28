"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, ClipboardList, LogOut, ShieldCheck, UserRound } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Account = { email: string; role: string; profile?: Record<string, unknown> | null };
type DashboardJob = { id: string; slug: string; postName: string; organization: string; applicationEnd: string | null; verificationStatus: string };
type Match = { job: DashboardJob; reasons: string[] };
type SavedItem = { id: string; job: DashboardJob };
type ApplicationItem = { id: string; state: string; job: DashboardJob };
type ReminderItem = { id: string; jobId: string; offset: string };
const applicationStates = ["INTERESTED", "SAVED", "APPLIED", "ADMIT_CARD_DOWNLOADED", "EXAM_COMPLETED", "RESULT_AWAITED", "SELECTED", "NOT_SELECTED"];
const stateLabels: Record<string, string> = { INTERESTED: "Interested", SAVED: "Saved", APPLIED: "Applied", ADMIT_CARD_DOWNLOADED: "Admit card downloaded", EXAM_COMPLETED: "Exam completed", RESULT_AWAITED: "Result awaited", SELECTED: "Selected", NOT_SELECTED: "Not selected" };
const reminderOffsets = ["DAYS_7", "DAYS_3", "DAYS_1", "LAST_DATE"];
const reminderLabels: Record<string, string> = { DAYS_7: "7 days before", DAYS_3: "3 days before", DAYS_1: "1 day before", LAST_DATE: "On the last date" };

export default function DashboardPage() {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eligible, setEligible] = useState<Match[]>([]);
  const [checkManually, setCheckManually] = useState<Match[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  async function loadTracking(token: string) {
    const [savedResponse, applicationResponse, reminderResponse] = await Promise.all([
      fetch(`${API}/api/v1/me/saved-jobs`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/v1/me/applications`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/v1/me/reminders`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (savedResponse.ok) setSavedJobs((await savedResponse.json()).data);
    if (applicationResponse.ok) setApplications((await applicationResponse.json()).data);
    if (reminderResponse.ok) setReminders((await reminderResponse.json()).data);
  }
  useEffect(() => { void (async () => {
    let token = sessionStorage.getItem("ns_access");
    if (!token) { const refreshed = await fetch(`${API}/api/v1/auth/refresh`, { method: "POST", credentials: "include" }); if (refreshed.ok) { const data = await refreshed.json(); token = data.accessToken; sessionStorage.setItem("ns_access", token!); } }
    if (!token) { window.location.assign("/login"); return; }
    const response = await fetch(`${API}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { sessionStorage.removeItem("ns_access"); setError("Your session ended. Please sign in again."); return; }
    const data = await response.json(); setUser(data.user);
    const matches = await fetch(`${API}/api/v1/me/matches`, { headers: { Authorization: `Bearer ${token}` } });
    if (matches.ok) { const result = await matches.json(); setEligible(result.eligible); setCheckManually(result.checkManually); }
    await loadTracking(token);
  })(); }, []);
  async function logout() { await fetch(`${API}/api/v1/auth/logout`, { method: "POST", credentials: "include" }); sessionStorage.removeItem("ns_access"); window.location.assign("/"); }
  async function saveJob(jobId: string) {
    const token = sessionStorage.getItem("ns_access");
    if (!token) return;
    const response = await fetch(`${API}/api/v1/me/saved-jobs`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ jobId }) });
    if (response.ok) await loadTracking(token);
    else setError("Could not save this listing. Please try again.");
  }
  async function removeSavedJob(jobId: string) {
    const token = sessionStorage.getItem("ns_access");
    if (!token) return;
    const response = await fetch(`${API}/api/v1/me/saved-jobs/${encodeURIComponent(jobId)}`, { method: "DELETE", credentials: "include", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) await loadTracking(token);
    else setError("Could not remove this saved listing. Please try again.");
  }
  async function updateApplication(jobId: string, state: string) {
    const token = sessionStorage.getItem("ns_access");
    if (!token) return;
    const response = await fetch(`${API}/api/v1/me/applications/${encodeURIComponent(jobId)}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ state }) });
    if (response.ok) await loadTracking(token);
    else setError("Could not update this application. Please try again.");
  }
  async function updateReminders(jobId: string, offsets: string[]) {
    const token = sessionStorage.getItem("ns_access");
    if (!token) return;
    const response = await fetch(`${API}/api/v1/me/reminders/${encodeURIComponent(jobId)}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ offsets }) });
    if (response.ok) await loadTracking(token);
    else setError(response.status === 422 ? "This listing has no recorded application deadline, so reminders cannot be set." : "Could not save reminder preferences.");
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const token = sessionStorage.getItem("ns_access");
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form.entries());
    for (const key of ["passingYear", "percentage", "experienceMonths", "salaryMin"]) { const value = body[key]; body[key] = value ? Number(value) : null; }
    const dob = body.dateOfBirth; body.dateOfBirth = dob ? new Date(`${dob}T00:00:00.000Z`).toISOString() : null;
    for (const key of ["preferredDepartments", "preferredLocations"]) { const value = String(body[key] ?? ""); body[key] = value.split(",").map(item => item.trim()).filter(Boolean); }
    const response = await fetch(`${API}/api/v1/me/profile`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (response.ok) {
      const matched = await fetch(`${API}/api/v1/me/matches`, { headers: { Authorization: `Bearer ${token}` } });
      if (matched.ok) { const result = await matched.json(); setEligible(result.eligible); setCheckManually(result.checkManually); }
      setNotice("Profile saved. We’ve refreshed your matches using recorded job criteria."); return;
    }
    setError("Could not save your profile. Check each field and try again.");
  }
  const profile = user?.profile ?? {};
  const value = (key: string) => typeof profile[key] === "string" || typeof profile[key] === "number" ? String(profile[key]) : "";
  return <main>
    <header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Mitra</span></span></a><button className="btn btn-light" onClick={logout}><LogOut size={15}/> Sign out</button></div></header>
    <div className="container dashboard-page">
      <div className="dashboard-title"><div><span className="eyebrow dark"><UserRound size={14}/> PERSONAL DASHBOARD</span><h1>{user ? `Welcome, ${user.email.split("@")[0]}` : "Loading your dashboard…"}</h1><p>Build your profile to get relevant job matches.</p></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="success-note" role="status">{notice}</div>}
      <div className="metrics"><div className="metric"><div className="metric-icon"><BriefcaseBusiness size={19}/></div><div><strong>{eligible.length}</strong><small>Eligible job matches</small></div></div><div className="metric"><div className="metric-icon"><CalendarDays size={19}/></div><div><strong>—</strong><small>Closing soon</small></div></div><div className="metric"><div className="metric-icon"><ClipboardList size={19}/></div><div><strong>{applications.length}</strong><small>Applications tracked</small></div></div><div className="metric"><div className="metric-icon"><ShieldCheck size={19}/></div><div><strong>{checkManually.length}</strong><small>Need notification check</small></div></div></div>
      {(eligible.length > 0 || checkManually.length > 0) && <section className="update-card match-results"><div className="section-head"><div><h2>Your profile matches</h2><p>Eligible listings are separated from jobs that need a manual notification check.</p></div></div>{eligible.map(({job,reasons})=><article className="match-item" key={job.slug}><div><span className="pill">ELIGIBLE</span><h3>{job.postName}</h3><p>{job.organization} · {reasons[0]}</p></div><div className="match-actions"><button className="btn btn-light" onClick={()=>void saveJob(job.id)} disabled={savedJobs.some(saved=>saved.job.id===job.id)}>{savedJobs.some(saved=>saved.job.id===job.id)?"Saved":"Save job"}</button><button className="btn btn-light" onClick={()=>void updateApplication(job.id,"INTERESTED")} disabled={applications.some(application=>application.job.id===job.id)}>{applications.some(application=>application.job.id===job.id)?"Tracking":"Track application"}</button><a className="link" href={`/jobs/${job.slug}`}>View job <ArrowRight size={14}/></a></div></article>)}{checkManually.map(({job,reasons})=><article className="match-item" key={job.slug}><div><span className="status">CHECK NOTIFICATION</span><h3>{job.postName}</h3><p>{job.organization} · {reasons[0]}</p></div><div className="match-actions"><button className="btn btn-light" onClick={()=>void saveJob(job.id)} disabled={savedJobs.some(saved=>saved.job.id===job.id)}>{savedJobs.some(saved=>saved.job.id===job.id)?"Saved":"Save job"}</button><button className="btn btn-light" onClick={()=>void updateApplication(job.id,"INTERESTED")} disabled={applications.some(application=>application.job.id===job.id)}>{applications.some(application=>application.job.id===job.id)?"Tracking":"Track application"}</button><a className="link" href={`/jobs/${job.slug}`}>Review criteria <ArrowRight size={14}/></a></div></article>)}</section>}
      <section className="tracking-grid">
        <div className="update-card"><div className="section-head"><div><h2>Saved jobs</h2><p>{savedJobs.length} opportunities saved for later.</p></div></div>{savedJobs.length === 0 ? <p className="empty-state">Save an opportunity from your matches to keep it here.</p> : savedJobs.map(({job})=><article className="saved-job-entry" key={job.id}><div className="match-item"><div><h3>{job.postName}</h3><p>{job.organization}</p></div><div className="match-actions"><button className="btn btn-light" onClick={()=>void updateApplication(job.id,"INTERESTED")} disabled={applications.some(application=>application.job.id===job.id)}>{applications.some(application=>application.job.id===job.id)?"Tracking":"Track application"}</button><button className="btn btn-light" onClick={()=>void removeSavedJob(job.id)}>Remove</button><a className="link" href={`/jobs/${job.slug}`}>View job <ArrowRight size={14}/></a></div></div><fieldset className="reminder-options"><legend>Deadline reminders</legend>{reminderOffsets.map(offset=><label key={offset}><input type="checkbox" checked={reminders.some(reminder=>reminder.jobId===job.id&&reminder.offset===offset)} onChange={event=>{const current=reminders.filter(reminder=>reminder.jobId===job.id).map(reminder=>reminder.offset); const next=event.target.checked?[...current,offset]:current.filter(item=>item!==offset); void updateReminders(job.id,next);}}/> {reminderLabels[offset]}</label>)}</fieldset></article>)}</div>
        <div className="update-card"><div className="section-head"><div><h2>Application tracker</h2><p>Record where you are in each recruitment process.</p></div></div>{applications.length === 0 ? <p className="empty-state">Choose a status to start tracking an opportunity.</p> : applications.map(({job,state})=><article className="match-item" key={job.id}><div><h3>{job.postName}</h3><p>{job.organization}</p></div><label className="tracker-select" aria-label={`Application status for ${job.postName}`}><select value={state} onChange={event=>void updateApplication(job.id,event.target.value)}>{applicationStates.map(option=><option key={option} value={option}>{stateLabels[option]}</option>)}</select></label></article>)}</div>
      </section>
      <div className="dashboard-grid"><section className="update-card"><div className="section-head"><div><h2>Complete your job profile</h2><p>We only use details you choose to provide.</p></div></div>
        <form key={user?.email ?? "loading"} className="profile-form" onSubmit={saveProfile}>
          <label>Date of birth<input name="dateOfBirth" type="date" defaultValue={value("dateOfBirth").slice(0, 10)}/></label>
          <label>Gender<select name="gender" defaultValue={value("gender")}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label>
          <label>Qualification<select name="qualification" defaultValue={value("qualification")}><option value="">Select qualification</option><option>10th</option><option>12th</option><option>Diploma</option><option>Graduate</option><option>Postgraduate</option><option>Doctorate</option></select></label>
          <label>Degree<input name="degree" placeholder="e.g. B.Tech" defaultValue={value("degree")}/></label>
          <label>Branch<input name="branch" placeholder="e.g. Computer Science" defaultValue={value("branch")}/></label>
          <label>Percentage<input name="percentage" type="number" min="0" max="100" step="0.01" defaultValue={value("percentage")}/></label><label>Passing year<input name="passingYear" type="number" min="1940" max="2100" defaultValue={value("passingYear")}/></label>
          <label>Category<select name="category" defaultValue={value("category")}><option value="">Select category</option><option>General</option><option>OBC</option><option>SC</option><option>ST</option><option>EWS</option></select></label>
          <label>Experience (months)<input name="experienceMonths" type="number" min="0" defaultValue={value("experienceMonths")}/></label>
          <label>State<input name="state" placeholder="e.g. Maharashtra" defaultValue={value("state")}/></label>
          <label>District<input name="district" placeholder="Your district" defaultValue={value("district")}/></label>
          <label>Preferred departments<input name="preferredDepartments" placeholder="SSC, Railways, Banking" defaultValue={Array.isArray(profile.preferredDepartments) ? profile.preferredDepartments.join(", ") : ""}/></label>
          <label>Preferred job locations<input name="preferredLocations" placeholder="Pune, Maharashtra" defaultValue={Array.isArray(profile.preferredLocations) ? profile.preferredLocations.join(", ") : ""}/></label>
          <label>Minimum salary preference (₹ / month)<input name="salaryMin" type="number" min="0" defaultValue={value("salaryMin")}/></label>
          <button className="btn btn-primary" type="submit">Save profile <ArrowRight size={15}/></button>
        </form>
      </section><aside className="update-card dashboard-aside"><h2>Your dashboard</h2><p>As verified recruitment information is added, this space will bring together:</p><ul><li>Jobs that match your eligibility</li><li>Saved opportunities and application status</li><li>Upcoming exam milestones</li><li>Closing date reminders</li></ul><div className="demo-note">If official conditions cannot be confirmed from your profile, the result will say “Check notification.”</div></aside></div>
    </div>
  </main>;
}
