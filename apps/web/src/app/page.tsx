import { ArrowRight, Bell, BookOpen, BriefcaseBusiness, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, FileCheck2, MapPin, Search, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";

const API = process.env.API_URL ?? (process.env.NODE_ENV === "production" ? "https://rojgaarmitra.vercel.app" : "http://localhost:4000");
type HomeJob = { id: string; title: string; organization: string; category: string; link: string; url: string; source: "OFFICIAL"; publishedAt: string | null };
type HomeUpdate = { id: string; title: string; type: string; sourceOrganization: string | null; job: { slug: string; organization: string } };
type HomeExam = { id: string; slug: string; name: string; organization: string; events: { type: string; date: string | null; title: string | null }[] };
async function getHomeContent() {
  try {
    const response = await fetch(`${API}/api/v1/live-jobs`, { next: { revalidate: 300 } });
    if (!response.ok) return { jobs: [] as HomeJob[], updates: [] as HomeUpdate[], exams: [] as HomeExam[], sources: [] as { organization: string; category: string; url: string; connected: boolean }[] };
    const payload = await response.json();
    return {
      jobs: payload.data as HomeJob[],
      updates: [] as HomeUpdate[],
      exams: [] as HomeExam[],
      sources: payload.sources ?? [],
    };
  } catch {
    return { jobs: [] as HomeJob[], updates: [] as HomeUpdate[], exams: [] as HomeExam[], sources: [] as { organization: string; category: string; url: string; connected: boolean }[] };
  }
}function JobCard({job}:{job:HomeJob}){return <article className="job-card"><div className="job-card-top"><div className="org"><div className="org-icon">{job.organization.slice(0,3).toUpperCase()}</div><div><b style={{fontSize:12}}>{job.organization}</b><small>{job.category}</small></div></div><span className="pill">LIVE OFFICIAL</span></div><h3>{job.title}</h3><div className="job-meta"><span className="tag">Official source</span><span className="tag">{job.category}</span></div><div className="job-foot"><span><ShieldCheck size={13} style={{display:"inline",verticalAlign:"middle"}}/> Live source</span><a className="link" href={job.link} target="_blank" rel="noreferrer">Open notice <ChevronRight size={14} style={{display:"inline",verticalAlign:"middle"}}/></a></div></article>}
