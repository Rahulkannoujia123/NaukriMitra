import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink } from "lucide-react";

const pageMetadata: Metadata = { title: "Government Exam Calendar", description: "Browse recorded application, admit-card, examination, answer-key, and result dates." };
const API = process.env.API_URL ?? "http://localhost:4000";
type Event = { id: string; type: string; date: string | null; endDate: string | null; title: string | null; officialUrl: string | null; sourceKind: string; exam: { slug: string; name: string; organization: string; officialUrl: string | null; sourceKind: string } };
export async function generateMetadata(): Promise<Metadata> {
  try { const response = await fetch(`${API}/api/v1/calendar`, { next: { revalidate: 60 } }); if (response.ok && (await response.json()).data.length > 0) return pageMetadata; } catch { }
  return { ...pageMetadata, robots: { index: false, follow: true } };
}
const labels: Record<string, string> = { APPLICATION_START: "Application opens", APPLICATION_END: "Application deadline", ADMIT_CARD: "Admit card", EXAM: "Exam", ANSWER_KEY: "Answer key", RESULT: "Result" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(value)) : "Date not announced";
export default async function CalendarPage() {
  let events: Event[] = [];
  let unavailable = false;
  try { const response = await fetch(`${API}/api/v1/calendar`, { next: { revalidate: 60 } }); if (!response.ok) unavailable = true; else events = (await response.json()).data; } catch { unavailable = true; }
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-primary" href="/exams">Browse exams <ArrowRight size={15}/></a></div></header><section className="listing-page"><div className="container"><a className="link" href="/"><ArrowLeft size={14}/> Home</a><h1>Government exam calendar</h1><p>Recorded exam milestones from the available exam database. Missing dates are not inferred.</p>{unavailable && <div className="empty-state">The calendar service is unavailable. Check back after the API is connected.</div>}{!unavailable && events.length === 0 && <div className="empty-state">No upcoming exam dates are recorded yet.</div>}<div className="calendar-list">{events.map(event => <article className="update-card calendar-event" key={event.id}><div className="calendar-date"><CalendarDays size={17}/><b>{date(event.date)}</b></div><div><span className="tag">{labels[event.type] ?? event.type}</span><h2>{event.title ?? event.exam.name}</h2><p>{event.exam.organization} · <a className="link" href={`/exams/${event.exam.slug}`}>{event.exam.name}</a></p></div>{(event.officialUrl ?? event.exam.officialUrl) && <a className="link" href={event.officialUrl ?? event.exam.officialUrl!} target="_blank" rel="noreferrer">Official source <ExternalLink size={13}/></a>}</article>)}</div></div></section></main>;
}
