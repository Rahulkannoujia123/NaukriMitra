"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Search, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Suggestion = { id: string; slug: string; organization: string; postName: string; applicationEnd: string | null; applicationUrl: string | null; notificationUrl: string | null; sourceUrl: string | null; sourceOrganization: string | null; lastVerifiedAt: string | null; verificationStatus: string; sourceKind: string; matchedTerms: string[] };
type Answer = { answer: string; eligibilityNotice: string; data: Suggestion[] };
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "Not announced";
export default function AssistantPage() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setAnswer(null);
    const message = String(new FormData(event.currentTarget).get("message") ?? "");
    try {
      const response = await fetch(`${API}/api/v1/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "The assistant could not search right now.");
      setAnswer(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The assistant could not search right now."); }
    finally { setBusy(false); }
  }
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-light" href="/dashboard">My dashboard <ArrowRight size={15}/></a></div></header><section className="listing-page"><div className="container assistant-page"><a className="link" href="/"><ArrowLeft size={14}/> Home</a><span className="eyebrow dark"><Search size={14}/> JOB DATABASE ASSISTANT</span><h1>Ask about published opportunities</h1><p>Answers are grounded in NaukriSetu listings. If there are no matching records, the assistant will say so.</p><form className="assistant-form" onSubmit={ask}><label htmlFor="assistant-message">Your question</label><textarea id="assistant-message" name="message" maxLength={800} required placeholder="Which government jobs are closing this week?"/><button className="btn btn-primary" disabled={busy}>{busy ? "Searching…" : "Search listings"} <ArrowRight size={15}/></button></form>{error && <div className="form-error" role="alert">{error}</div>}{answer && <section className="assistant-results" aria-live="polite"><div className="source-box"><b>{answer.answer}</b><p>{answer.eligibilityNotice}</p></div>{answer.data.map(job=><article className="update-card assistant-job" key={job.id}><div><span className={job.sourceKind === "OFFICIAL" && job.verificationStatus === "VERIFIED" && job.lastVerifiedAt ? "pill" : "status"}>{job.sourceKind === "OFFICIAL" && job.verificationStatus === "VERIFIED" && job.lastVerifiedAt ? <><ShieldCheck size={12}/> Official source verified</> : "Official source not yet verified"}</span><h2>{job.postName}</h2><p>{job.organization}</p></div><div className="job-meta"><span className="tag">Last date: {formatDate(job.applicationEnd)}</span>{job.matchedTerms.length > 0 && <span className="tag">Matched: {job.matchedTerms.join(", ")}</span>}</div><div className="update-actions"><a className="link" href={`/jobs/${job.slug}`}>Review listing <ArrowRight size={14}/></a>{job.notificationUrl && <a className="link" href={job.notificationUrl} target="_blank" rel="noreferrer">Notification <ExternalLink size={13}/></a>}{job.applicationUrl && <a className="link" href={job.applicationUrl} target="_blank" rel="noreferrer">Apply <ExternalLink size={13}/></a>}</div></article>)}</section>}</div></section></main>;
}
