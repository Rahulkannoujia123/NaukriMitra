import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";

const pageMetadata: Metadata = { title: "Government Exams", description: "Browse recorded government recruitment exams, organizations, and official exam pages." };
const API = process.env.API_URL ?? "http://localhost:4000";
type Exam = { id: string; slug: string; name: string; organization: string; overview: string | null; officialUrl: string | null; sourceKind: string; events: { id: string; type: string; date: string | null }[] };
export async function generateMetadata(): Promise<Metadata> {
  try { const response = await fetch(`${API}/api/v1/exams`, { next: { revalidate: 60 } }); if (response.ok && (await response.json()).data.length > 0) return pageMetadata; } catch { }
  return { ...pageMetadata, robots: { index: false, follow: true } };
}
export default async function ExamsPage() {
  let exams: Exam[] = [];
  let unavailable = false;
  try { const response = await fetch(`${API}/api/v1/exams`, { next: { revalidate: 60 } }); if (!response.ok) unavailable = true; else exams = (await response.json()).data; } catch { unavailable = true; }
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-primary" href="/calendar">Exam calendar <ArrowRight size={15}/></a></div></header><section className="listing-page"><div className="container"><a className="link" href="/"><ArrowLeft size={14}/> Home</a><h1>Government exams</h1><p>Browse exams recorded in the NaukriSetu database and review their source information.</p>{unavailable && <div className="empty-state">The exam service is unavailable. Check back after the API is connected.</div>}{!unavailable && exams.length === 0 && <div className="empty-state">No exam records have been entered yet.</div>}<div className="job-grid">{exams.map(exam=><article className="job-card" key={exam.id}><span className="tag">{exam.sourceKind === "OFFICIAL" ? <><ShieldCheck size={12}/> Official source</> : `${exam.sourceKind} information`}</span><h2>{exam.name}</h2><p>{exam.organization}</p>{exam.overview && <p>{exam.overview}</p>}<div className="job-foot"><a className="link" href={`/exams/${exam.slug}`}>Exam details <ArrowRight size={14}/></a>{exam.officialUrl && <a className="link" href={exam.officialUrl} target="_blank" rel="noreferrer">Official page <ExternalLink size={13}/></a>}</div></article>)}</div></div></section></main>;
}
