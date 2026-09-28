import { ArrowLeft, ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";

const API = process.env.API_URL ?? "http://localhost:4000";
type UpdateType = "results" | "admit-cards" | "answer-keys";
type UpdateRecord = { id: string; type: string; title: string; details: string | null; officialUrl: string | null; sourceOrganization: string | null; sourceKind: string; publishedAt: string | null; job: { slug: string; postName: string; organization: string; sourceUrl: string | null; sourceOrganization: string | null; verificationStatus: string; lastVerifiedAt: string | null } };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(value)) : "Date not recorded";
const typeLabels: Record<string, string> = { RESULT: "Result", CUTOFF: "Cutoff", MERIT_LIST: "Merit list", ADMIT_CARD: "Admit card", ANSWER_KEY: "Answer key" };
export async function updateFeedMetadata(type: UpdateType, title: string, description: string) {
  try { const response = await fetch(`${API}/api/v1/${type}`, { next: { revalidate: 60 } }); if (response.ok && (await response.json()).data.length > 0) return { title, description, alternates: { canonical: `/${type}` }, openGraph: { title, description } }; }
  catch { }
  return { title, description, alternates: { canonical: `/${type}` }, openGraph: { title, description }, robots: { index: false, follow: true } };
}

export async function UpdateFeed({ type, title, description }: { type: UpdateType; title: string; description: string }) {
  let records: UpdateRecord[] = [];
  let unavailable = false;
  try {
    const response = await fetch(`${API}/api/v1/${type}`, { next: { revalidate: 60 } });
    if (!response.ok) unavailable = true;
    else records = (await response.json()).data;
  } catch { unavailable = true; }
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-primary" href="/dashboard">My dashboard <ArrowRight size={15}/></a></div></header><section className="listing-page"><div className="container"><a className="link" href="/"><ArrowLeft size={14}/> Home</a><h1>{title}</h1><p>{description}</p>{unavailable && <div className="empty-state">The updates service is unavailable. Check back after the API is connected.</div>}{!unavailable && records.length === 0 && <div className="empty-state">No published updates are available yet. Official updates will appear here after review.</div>}<div className="update-feed">{records.map(record => {
    const sourceUrl = record.officialUrl ?? record.job.sourceUrl;
    const sourceName = record.sourceOrganization ?? record.job.sourceOrganization ?? record.job.organization;
    const verified = record.sourceKind === "OFFICIAL" && record.job.verificationStatus === "VERIFIED" && Boolean(record.job.lastVerifiedAt);
    const detailPath = record.type === "ADMIT_CARD" ? "admit-card" : record.type === "ANSWER_KEY" ? "answer-key" : "results";
    return <article className="update-card update-entry" key={record.id}><div className="update-entry-top"><span className="tag">{typeLabels[record.type] ?? record.type}</span><span className={verified ? "pill" : "status"}>{verified ? <><ShieldCheck size={12}/> Official source verified</> : "Official source not yet verified"}</span></div><h2>{record.title}</h2><p>{record.details ?? record.job.postName} · {record.job.organization}</p><small>{sourceName} · {date(record.publishedAt)}</small><div className="update-actions"><a className="link" href={`/${detailPath}/${record.job.slug}`}>Open update <ArrowRight size={14}/></a><a className="link" href={`/jobs/${record.job.slug}`}>Recruitment details <ArrowRight size={14}/></a>{sourceUrl && <a className="link" href={sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={13}/></a>}</div></article>;
  })}</div></div></section></main>;
}
