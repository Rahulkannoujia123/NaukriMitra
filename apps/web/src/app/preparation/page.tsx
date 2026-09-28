"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ExternalLink } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type FollowedExam = { exam: { id: string; slug: string; name: string; organization: string; overview: string | null; officialUrl: string | null; sourceKind: string; events: { id: string; type: string; date: string | null; title: string | null; officialUrl: string | null; sourceKind: string }[] } };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(value)) : "Date not recorded";
export default function PreparationPage() {
  const [exams, setExams] = useState<FollowedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    let token = sessionStorage.getItem("ns_access");
    if (!token) { const refreshed = await fetch(`${API}/api/v1/auth/refresh`, { method: "POST", credentials: "include" }); if (refreshed.ok) { const data = await refreshed.json(); token = data.accessToken; sessionStorage.setItem("ns_access", token!); } }
    if (!token) { window.location.assign("/login"); return; }
    try { const response = await fetch(`${API}/api/v1/me/followed-exams`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Could not load followed exams."); setExams((await response.json()).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load your preparation dashboard."); }
    finally { setLoading(false); }
  })(); }, []);
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-light" href="/exams">Browse exams <ArrowRight size={14}/></a></div></header><section className="listing-page"><div className="container preparation-page"><a className="link" href="/dashboard"><ArrowLeft size={14}/> Dashboard</a><span className="eyebrow dark"><BookOpen size={14}/> PREPARATION</span><h1>Your followed exams</h1><p>Official dates and study resources are kept separate. Study material appears only after it has been added and identified by source.</p>{error && <div className="form-error" role="alert">{error}</div>}{loading && <div className="empty-state">Loading your followed exams…</div>}{!loading && exams.length === 0 && <div className="empty-state">You are not following any exams yet. Browse the exam list to add one.</div>}{exams.map(({exam})=><section className="preparation-exam" key={exam.id}><div className="section-head"><div><h2><a href={`/exams/${exam.slug}`}>{exam.name}</a></h2><p>{exam.organization}</p></div>{exam.officialUrl && <a className="link" href={exam.officialUrl} target="_blank" rel="noreferrer">Official exam page <ExternalLink size={13}/></a>}</div><div className="preparation-columns"><div><h3><CalendarDays size={15}/> Important dates</h3>{exam.events.length ? exam.events.map(event=><p className="prep-event" key={event.id}><b>{date(event.date)}</b> · {event.title ?? event.type.replaceAll("_", " ")} <span>{event.sourceKind}</span></p>) : <p className="empty-state">No official milestones have been recorded.</p>}</div><div><h3><BookOpen size={15}/> Study resources</h3><p className="empty-state">No syllabus, previous papers, or study plan has been verified for this exam yet.</p></div></div></section>)}</div></section></main>;
}
