import type { MetadataRoute } from "next";
const API = process.env.API_URL ?? "http://localhost:4000";
type PublicJob = { slug: string; updatedAt?: string };
type PublicExam = { slug: string };
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const fixedPages = ["", "/eligibility", "/assistant", "/about", "/disclaimer"];
  let jobs: PublicJob[] = [];
  let exams: PublicExam[] = [];
  const contentPages: string[] = [];
  const updatePages: MetadataRoute.Sitemap = [];
  try {
    for (let page = 1; page <= 100; page++) {
      const response = await fetch(`${API}/api/v1/jobs?page=${page}&pageSize=50`, { next: { revalidate: 3600 } });
      if (!response.ok) break;
      const batch: PublicJob[] = (await response.json()).data;
      jobs = jobs.concat(batch);
      if (batch.length < 50) break;
    }
  } catch { }
  if (jobs.length) contentPages.push("/jobs");
  try {
    const response = await fetch(`${API}/api/v1/exams`, { next: { revalidate: 3600 } });
    if (response.ok) exams = (await response.json()).data;
  } catch { }
  if (exams.length) contentPages.push("/exams");
  for (const [path, endpoint, detailPath] of [["/results", "/results", "results"], ["/admit-cards", "/admit-cards", "admit-card"], ["/answer-keys", "/answer-keys", "answer-key"]]) {
    try {
      const response = await fetch(`${API}/api/v1${endpoint}`, { next: { revalidate: 3600 } });
      if (response.ok) {
        const updates: { job: { slug: string } }[] = (await response.json()).data;
        if (updates.length) {
          contentPages.push(path);
          for (const update of updates) updatePages.push({ url: `${base}/${detailPath}/${update.job.slug}`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 });
        }
      }
    } catch { }
  }
  try { const response = await fetch(`${API}/api/v1/calendar`, { next: { revalidate: 3600 } }); if (response.ok && (await response.json()).data.length) contentPages.push("/calendar"); } catch { }
  return [
    ...[...fixedPages, ...contentPages].map(path => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: path ? 0.7 : 1 })),
    ...jobs.map(job => ({ url: `${base}/jobs/${job.slug}`, lastModified: job.updatedAt ? new Date(job.updatedAt) : new Date(), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...exams.map(exam => ({ url: `${base}/exams/${exam.slug}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...updatePages,
  ];
}
