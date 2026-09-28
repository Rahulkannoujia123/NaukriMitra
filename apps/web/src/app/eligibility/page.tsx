"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type JobOption = { id: string; slug: string; postName: string; organization: string };
type Result = { status: "ELIGIBLE" | "CHECK_MANUALLY" | "NOT_ELIGIBLE"; reasons: string[] };
const labels = { ELIGIBLE: "Eligible", CHECK_MANUALLY: "Check notification", NOT_ELIGIBLE: "Not eligible" };
export default function EligibilityPage() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch(`${API}/api/v1/jobs?page=1&pageSize=100`).then(async response => { if (response.ok) setJobs((await response.json()).data); }).catch(() => setMessage("The jobs service is unavailable.")); }, []);
  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setResult(null); setBusy(true);
    const form = new FormData(event.currentTarget);
    const jobId = String(form.get("jobId") ?? "");
    const birthDate = String(form.get("dateOfBirth") ?? "");
    const experience = String(form.get("experienceMonths") ?? "");
    const body = {
      dateOfBirth: birthDate ? new Date(`${birthDate}T00:00:00.000Z`).toISOString() : null,
      qualification: String(form.get("qualification") ?? "") || null,
      category: String(form.get("category") ?? "") || null,
      state: String(form.get("state") ?? "") || null,
      experienceMonths: experience ? Number(experience) : null,
    };
    try {
      const response = await fetch(`${API}/api/v1/jobs/${encodeURIComponent(jobId)}/eligibility`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not assess this listing.");
      setResult(data.result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not assess this listing."); }
    finally { setBusy(false); }
  }
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-light" href="/jobs">Browse jobs <ArrowRight size={15}/></a></div></header><section className="listing-page"><div className="container eligibility-page"><a className="link" href="/"><ArrowLeft size={14}/> Home</a><span className="eyebrow dark"><ShieldCheck size={14}/> ELIGIBILITY CHECKER</span><h1>Check a job against your profile</h1><p>We compare only criteria recorded in the listing. Conditions that need interpretation stay marked for manual review.</p><form className="eligibility-form update-card" onSubmit={check}><label>Job listing<select name="jobId" required defaultValue=""><option value="" disabled>Select a published job</option>{jobs.map(job=><option key={job.id} value={job.id}>{job.postName} · {job.organization}</option>)}</select></label><div className="eligibility-fields"><label>Date of birth<input name="dateOfBirth" type="date"/></label><label>Qualification<select name="qualification" defaultValue=""><option value="">Select qualification</option><option>10th</option><option>12th</option><option>Diploma</option><option>Graduate</option><option>Postgraduate</option><option>Doctorate</option></select></label><label>Category<select name="category" defaultValue=""><option value="">Select category</option><option>General</option><option>OBC</option><option>SC</option><option>ST</option><option>EWS</option></select></label><label>State<input name="state" maxLength={100} placeholder="e.g. Maharashtra"/></label><label>Experience (months)<input name="experienceMonths" type="number" min="0" max="1200"/></label></div><button className="btn btn-primary" disabled={busy || jobs.length === 0}>{busy ? "Checking…" : "Check eligibility"} <ArrowRight size={15}/></button>{message && <p className="form-error" role="alert">{message}</p>}</form>{result && <section className={`eligibility-result ${result.status.toLowerCase()}`} aria-live="polite"><h2>{labels[result.status]}</h2><ul>{result.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p><CircleHelp size={15}/> Final eligibility is determined by the official notification.</p></section>}</div></section></main>;
}
