import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

const API = process.env.API_URL ?? "http://localhost:4000";
type UpdateKind = "results" | "admitCard" | "answerKey";
type JobUpdate = { id: string; type: string; title: string; details: string | null; officialUrl: string | null; sourceOrganization: string | null; sourceKind: string; publishedAt: string | null };
type Data = { job: { slug: string; postName: string; organization: string; sourceUrl: string | null; sourceOrganization: string | null; verificationStatus: string; sourceKind: string; lastVerifiedAt: string | null }; updates: JobUpdate[] };
export async function getUpdateData(slug: string, kind: UpdateKind): Promise<Data | null> {
  try { const response = await fetch(`${API}/api/v1/jobs/${encodeURIComponent(slug)}/updates?type=${kind}`, { next: { revalidate: 60 } }); return response.ok ? (await response.json()).data : null; }
  catch { return null; }
}
export async function updateMetadata(slug: string, kind: UpdateKind, title: string): Promise<Metadata> {
  const data = await getUpdateData(slug, kind);
  if (!data) return { title: "Update not found", robots: { index: false, follow: true } };
  const description = `${title} for ${data.job.postName} from ${data.job.organization}. Review the listed recruitment sources.`;
  return { title: `${title} — ${data.job.postName}`, description, alternates: { canonical: `/${kind === "results" ? "results" : kind === "admitCard" ? "admit-card" : "answer-key"}/${slug}` }, openGraph: { title: `${title} — ${data.job.postName}`, description, type: "article" }, ...(data.updates.length ? {} : { robots: { index: false, follow: true } }) };
}
export async function UpdateDetail({ slug, kind, title }: { slug: string; kind: UpdateKind; title: string }) {
  const data = await getUpdateData(slug, kind);
  if (!data) return <main className="listing-page"><div className="container"><p className="empty-state">This published recruitment listing could not be found.</p></div></main>;
  const verified = data.job.verificationStatus === "VERIFIED" && data.job.sourceKind === "OFFICIAL" && Boolean(data.job.lastVerifiedAt);
  return <main><header className="header"><div className="container header-in"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{ color: "#087b69" }}>Setu</span></span></a><a className="btn btn-light" href={`/jobs/${data.job.slug}`}>Recruitment details</a></div></header><section className="listing-page"><div className="container published-detail"><a className="link" href={`/${kind === "results" ? "results" : kind === "admitCard" ? "admit-cards" : "answer-keys"}`}><ArrowLeft size={14}/> All {title.toLowerCase()} updates</a><span className={verified ? "pill" : "status"}>{verified ? <><ShieldCheck size={13}/> Official source verified</> : "Official source not yet verified"}</span><h1>{data.job.postName}</h1><p>{data.job.organization} · {title}</p>{data.updates.length === 0 ? <div className="empty-state">No published {title.toLowerCase()} update is recorded for this recruitment.</div> : data.updates.map(update=>{const updateVerified=verified&&update.sourceKind==="OFFICIAL";return <article className="update-card update-entry" key={update.id}><div className="update-entry-top"><span className="tag">{update.type.replaceAll("_", " ")}</span><span className={updateVerified?"pill":"status"}>{updateVerified?"Official update source":"Source review required"}</span><span>{update.publishedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(update.publishedAt)) : "Date not recorded"}</span></div><h2>{update.title}</h2>{update.details && <p>{update.details}</p>}<small>{update.sourceOrganization ?? data.job.sourceOrganization ?? data.job.organization}</small>{(update.officialUrl ?? data.job.sourceUrl) && <div className="update-actions"><a className="link" href={update.officialUrl ?? data.job.sourceUrl!} target="_blank" rel="noreferrer">Open listed source <ExternalLink size={13}/></a></div>}</article>})}</div></section></main>;
}
