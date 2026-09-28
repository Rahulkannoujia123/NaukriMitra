"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ClipboardList, FilePlus2, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type AdminJob = { id: string; slug: string; postName: string; organization: string; status: string; verificationStatus: string; applicationEnd: string | null };
type AuditEntry = { id: string; action: string; entityType: string; entityId: string; createdAt: string; actor: { email: string } | null };
type AdminUser = { id: string; email: string; role: string; createdAt: string };
type SourceSnapshot = { id: string; sourceOrganization: string; sourceUrl: string; noticeTitle: string; recordType: string; detailUrl: string | null; applicationUrl: string | null; publishedAt: string | null; observedAt: string; verificationStatus: string; extractedFields: string[]; unverifiedFields: string[]; retrievalNote: string | null };
type Stats = { jobs: number; publishedJobs: number; jobsAwaitingSourceReview: number; updates: number; exams: number; users: number };
const roles = ["USER", "SUPER_ADMIN", "EDITOR", "MODERATOR"];
const eventTypes = ["APPLICATION_START", "APPLICATION_END", "ADMIT_CARD", "EXAM", "ANSWER_KEY", "RESULT"];
function dateTime(value: FormDataEntryValue | null) { return value ? new Date(`${String(value)}T00:00:00.000Z`).toISOString() : null; }
function list(value: FormDataEntryValue | null) { return String(value ?? "").split(",").map(item => item.trim()).filter(Boolean); }
function documentRows(value: FormDataEntryValue | null) { return String(value ?? "").split("\n").map(line => line.trim()).filter(Boolean).map(line => { const [documentName, ...conditionParts] = line.split("|"); const condition = conditionParts.join("|").trim(); return { documentName: documentName.trim(), required: true, condition: condition || null, sourcePage: null }; }); }

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sourceSnapshots, setSourceSnapshots] = useState<SourceSnapshot[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, accessToken: string, method = "GET", body?: unknown) {
    const response = await fetch(`${API}/api/v1${path}`, { method, credentials: "include", headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(result?.message ?? result?.error ?? "Request failed.");
    return result;
  }
  async function load(accessToken: string) {
    const [jobResult, statResult] = await Promise.all([request("/admin/jobs", accessToken), request("/admin/analytics", accessToken)]);
    setJobs(jobResult.data); setStats(statResult.data);
    try { setAudit((await request("/admin/audit-logs?take=12", accessToken)).data); } catch { setAudit([]); }
    try { setUsers((await request("/admin/users", accessToken)).data); } catch { setUsers([]); }
    try { setSourceSnapshots((await request("/admin/source-snapshots?status=REVIEW_REQUIRED", accessToken)).data); } catch { setSourceSnapshots([]); }
  }
  useEffect(() => { void (async () => {
    try {
      let accessToken = sessionStorage.getItem("ns_access");
      if (!accessToken) { const refreshed = await fetch(`${API}/api/v1/auth/refresh`, { method: "POST", credentials: "include" }); if (refreshed.ok) { const result = await refreshed.json(); accessToken = result.accessToken; sessionStorage.setItem("ns_access", accessToken!); } }
      if (!accessToken) { window.location.assign("/login"); return; }
      const result = await request("/me", accessToken);
      if (!["SUPER_ADMIN", "EDITOR"].includes(result.user.role)) { setError("This account does not have editor access."); return; }
      setToken(accessToken); setRole(result.user.role); setCurrentUserId(result.user.id); await load(accessToken);
    } catch { setError("Could not load the admin workspace. Check the API and account permissions."); }
  })(); }, []);

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await request("/admin/jobs", token, "POST", {
        slug: form.get("slug"), organization: form.get("organization"), postName: form.get("postName"),
        vacancy: form.get("vacancy") ? Number(form.get("vacancy")) : null,
        salaryText: form.get("salaryText") || null, salaryMin: form.get("salaryMin") ? Number(form.get("salaryMin")) : null,
        applicationStart: dateTime(form.get("applicationStart")), applicationEnd: dateTime(form.get("applicationEnd")),
        examDate: dateTime(form.get("examDate")), location: list(form.get("location")), states: list(form.get("states")), departments: list(form.get("departments")),
        sourceUrl: form.get("sourceUrl"), sourceOrganization: form.get("sourceOrganization"), notificationUrl: form.get("notificationUrl"), applicationUrl: form.get("applicationUrl"),
        qualifications: [{ qualification: form.get("qualification"), degree: form.get("degree") || null, branch: form.get("branch") || null }],
        documents: documentRows(form.get("documents")),
      });
      if (form.get("confirmSource") === "on") {
        await request(`/admin/jobs/${created.data.id}/verify-source`, token, "POST", { sourceUrl: form.get("sourceUrl"), sourceOrganization: form.get("sourceOrganization"), notificationUrl: form.get("notificationUrl"), applicationUrl: form.get("applicationUrl") });
        await request(`/admin/jobs/${created.data.id}/publish`, token, "POST", {});
        setNotice("Job source recorded and listing published.");
      } else setNotice("Job saved as a draft. Verify its source before publishing.");
      formElement.reset(); await load(token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the job."); }
    finally { setBusy(false); }
  }
  async function createUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget; const form = new FormData(formElement); const jobId = String(form.get("jobId"));
    try {
      const created = await request(`/admin/jobs/${encodeURIComponent(jobId)}/updates`, token, "POST", { type: form.get("type"), title: form.get("title"), details: form.get("details") || null, officialUrl: form.get("officialUrl") || null, sourceOrganization: form.get("sourceOrganization") || null, sourceKind: form.get("sourceKind") });
      if (form.get("publish") === "on") { await request(`/admin/updates/${created.data.id}/publish`, token, "POST", {}); setNotice("Update published."); }
      else setNotice("Update saved as a draft.");
      formElement.reset(); await load(token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the update."); }
    finally { setBusy(false); }
  }
  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const exam = await request("/admin/exams", token, "POST", { slug: form.get("slug"), name: form.get("name"), organization: form.get("organization"), overview: form.get("overview") || null, officialUrl: form.get("officialUrl") || null, sourceKind: form.get("sourceKind") });
      if (form.get("eventType")) await request(`/admin/exams/${exam.data.id}/events`, token, "POST", { type: form.get("eventType"), date: dateTime(form.get("eventDate")), title: form.get("eventTitle") || null, officialUrl: form.get("eventUrl") || null, sourceKind: form.get("eventSourceKind") });
      setNotice("Exam and supplied milestone saved."); formElement.reset(); await load(token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the exam."); }
    finally { setBusy(false); }
  }
  async function archiveJob(jobId: string) {
    setError(""); setNotice("");
    try { await request(`/admin/jobs/${encodeURIComponent(jobId)}/archive`, token, "POST", {}); setNotice("Listing archived."); await load(token); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not archive the listing."); }
  }
  async function changeRole(userId: string, nextRole: string) {
    setError(""); setNotice("");
    try { await request(`/admin/users/${encodeURIComponent(userId)}/role`, token, "PATCH", { role: nextRole }); setNotice("Account role updated and recorded in the audit log."); await load(token); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the role."); }
  }
  async function markSnapshotReviewed(snapshotId: string) {
    setError(""); setNotice("");
    try { await request(`/admin/source-snapshots/${encodeURIComponent(snapshotId)}/review`, token, "PATCH", { status: "VERIFIED" }); setNotice("Source snapshot marked reviewed; it is still not a published job."); await load(token); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update source review status."); }
  }

  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-light" href="/"><ArrowLeft size={14}/> Public site</a></div></header><section className="listing-page"><div className="container admin-page"><span className="eyebrow dark"><ShieldCheck size={14}/> ADMIN WORKSPACE {role && `· ${role.replace("_", " ")}`}</span><h1>Recruitment content</h1><p>Record facts from primary sources. Publishing official material requires source review.</p>{error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="success-note" role="status">{notice}</div>}{stats && <div className="metrics admin-metrics">{[["All listings", stats.jobs], ["Published", stats.publishedJobs], ["Source review", stats.jobsAwaitingSourceReview], ["Updates", stats.updates], ["Exams", stats.exams], ["Accounts", stats.users]].map(([label, value])=><div className="metric" key={label}><div><strong>{value}</strong><small>{label}</small></div></div>)}</div>}
    <div className="admin-columns"><section className="admin-section"><h2><FilePlus2 size={18}/> Add government job</h2><form className="admin-form" onSubmit={createJob}><label>URL slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required placeholder="ssc-cgl-2026"/></label><label>Organization<input name="organization" required maxLength={180}/></label><label>Post name<input name="postName" required maxLength={180}/></label><label>Qualification<input name="qualification" required placeholder="Graduate"/></label><label>Degree<input name="degree" placeholder="B.Tech"/></label><label>Branch<input name="branch" placeholder="Computer Science"/></label><label>Vacancies<input name="vacancy" type="number" min="0"/></label><label>Salary text<input name="salaryText" placeholder="As stated in notice"/></label><label>Minimum salary<input name="salaryMin" type="number" min="0"/></label><label>Application starts<input name="applicationStart" type="date"/></label><label>Application deadline<input name="applicationEnd" type="date"/></label><label>Exam date<input name="examDate" type="date"/></label><label>Locations, comma-separated<input name="location"/></label><label>Eligible states, comma-separated<input name="states"/></label><label>Departments, comma-separated<input name="departments"/></label><label>Documents from notice<textarea name="documents" placeholder="Aadhaar or ID | only if specified\nDegree certificate | original and self-attested copy"/></label><label>Source organization<input name="sourceOrganization" required/></label><label>Official source URL<input name="sourceUrl" type="url" required/></label><label>Notification URL<input name="notificationUrl" type="url" required/></label><label>Application URL<input name="applicationUrl" type="url" required/></label><label className="admin-confirm"><input name="confirmSource" type="checkbox"/> I checked these facts against the original government notice and approve publishing.</label><button className="btn btn-primary" disabled={busy}>Save listing <ArrowRight size={14}/></button></form></section>
    <section className="admin-section"><h2><ClipboardList size={18}/> Add recruitment update</h2><form className="admin-form" onSubmit={createUpdate}><label>Job listing<select name="jobId" required defaultValue=""><option value="" disabled>Select a listing</option>{jobs.map(job=><option key={job.id} value={job.id}>{job.postName} · {job.organization} · {job.status}</option>)}</select></label><label>Update type<select name="type"><option value="RESULT">Result</option><option value="ADMIT_CARD">Admit card</option><option value="ANSWER_KEY">Answer key</option><option value="CUTOFF">Cutoff</option><option value="MERIT_LIST">Merit list</option><option value="EXAM_DATE">Exam date</option></select></label><label>Title<input name="title" required maxLength={180}/></label><label>Details<textarea name="details" maxLength={5000}/></label><label>Source type<select name="sourceKind"><option value="OFFICIAL">Official</option><option value="EDITORIAL">Editorial</option><option value="COMMUNITY">Community</option><option value="AI">AI-generated</option></select></label><label>Source organization<input name="sourceOrganization"/></label><label>Official update URL<input name="officialUrl" type="url"/></label><label className="admin-confirm"><input name="publish" type="checkbox"/> Publish now after source checks</label><button className="btn btn-primary" disabled={busy}>Save update <ArrowRight size={14}/></button></form>
    <h2 className="admin-subhead"><CalendarDaysIcon/> Add exam and milestone</h2><form className="admin-form" onSubmit={createExam}><label>Exam slug<input name="slug" required placeholder="ssc-cgl"/></label><label>Exam name<input name="name" required/></label><label>Organization<input name="organization" required/></label><label>Overview<textarea name="overview"/></label><label>Source type<select name="sourceKind"><option value="OFFICIAL">Official</option><option value="EDITORIAL">Editorial</option><option value="COMMUNITY">Community</option></select></label><label>Official exam URL<input name="officialUrl" type="url"/></label><label>First milestone<select name="eventType"><option value="">No milestone yet</option>{eventTypes.map(type=><option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label>Milestone title<input name="eventTitle"/></label><label>Milestone date<input name="eventDate" type="date"/></label><label>Milestone source URL<input name="eventUrl" type="url"/></label><label>Milestone source type<select name="eventSourceKind"><option value="OFFICIAL">Official</option><option value="EDITORIAL">Editorial</option><option value="COMMUNITY">Community</option></select></label><button className="btn btn-primary" disabled={busy}>Save exam <ArrowRight size={14}/></button></form></section></div>
    <section className="admin-section admin-job-list"><h2>Manage listings</h2>{jobs.length === 0 ? <p className="empty-state">No job listings have been entered.</p> : jobs.map(job=><article className="match-item" key={job.id}><div><span className="tag">{job.status}</span> <span className={job.verificationStatus === "VERIFIED" ? "pill" : "status"}>{job.verificationStatus}</span><h3>{job.postName}</h3><p>{job.organization}</p></div>{job.status !== "ARCHIVED" && <button className="btn btn-light" onClick={()=>void archiveJob(job.id)}>Archive</button>}</article>)}</section>
    <section className="admin-section"><h2>Official source intake</h2><p>{sourceSnapshots.length} source observations need review. Reviewing a source does not publish a job or update.</p>{sourceSnapshots.length === 0 ? <p className="empty-state">No imported source snapshots are awaiting review.</p> : sourceSnapshots.map(snapshot=><article className="source-snapshot" key={snapshot.id}><div className="source-snapshot-head"><div><span className="tag">{snapshot.recordType.replaceAll("_", " ")}</span><h3>{snapshot.noticeTitle}</h3><p>{snapshot.sourceOrganization} · Published {snapshot.publishedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(snapshot.publishedAt)) : "date not recorded"}</p></div><button className="btn btn-light" onClick={()=>void markSnapshotReviewed(snapshot.id)}>Mark reviewed</button></div><p><b>Observed fields:</b> {snapshot.extractedFields.join(", ") || "None"}</p><p><b>Still unverified:</b> {snapshot.unverifiedFields.join(", ") || "None listed"}</p>{snapshot.retrievalNote && <p>{snapshot.retrievalNote}</p>}<div className="update-actions"><a className="link" href={snapshot.detailUrl ?? snapshot.sourceUrl} target="_blank" rel="noreferrer">Open listed source <ArrowRight size={14}/></a>{snapshot.applicationUrl && <a className="link" href={snapshot.applicationUrl} target="_blank" rel="noreferrer">Application portal <ArrowRight size={14}/></a>}</div></article>)}</section>
    {role === "SUPER_ADMIN" && <section className="admin-section"><h2>Account roles</h2><p>Role changes are added to the audit log. Avoid removing your own Super Admin access.</p>{users.map(user=><article className="match-item" key={user.id}><div><h3>{user.email}</h3><p>{user.role.replaceAll("_", " ")}</p></div><label className="role-select">Role<select value={user.role} disabled={user.id === currentUserId} onChange={event=>void changeRole(user.id,event.target.value)}>{roles.map(option=><option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label></article>)}</section>}
    {audit.length > 0 && <section className="admin-section"><h2>Recent admin activity</h2>{audit.map(entry=><div className="audit-row" key={entry.id}><b>{entry.action.replaceAll("_", " ")}</b><span>{entry.actor?.email ?? "System"} · {entry.entityType} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</span></div>)}</section>}
    <p className="admin-note">PDF storage and notification delivery require configured private storage and messaging services. Do not enter unverified or demo facts in production.</p></div></section></main>;
}
function CalendarDaysIcon() { return <ClipboardList size={18}/>; }
