type LiveSource = {
  id: string;
  organization: string;
  category: string;
  url: string;
  title: string;
  link: string;
  publishedAt: string | null;
  source: "OFFICIAL";
};

type SourceConfig = { organization: string; category: string; url: string };

export const LIVE_SOURCES: SourceConfig[] = [
  { organization: "UPSC", category: "Central Government", url: "https://www.upsc.gov.in/" },
  { organization: "Staff Selection Commission", category: "SSC", url: "https://ssc.gov.in/" },
  { organization: "Employment News", category: "Government Jobs", url: "https://employmentnews.gov.in/newemp/careers.aspx" },
  { organization: "IBPS", category: "Banking", url: "https://www.ibps.in/index.php/recruitment/" },
  { organization: "National Career Service", category: "Government Jobs", url: "https://ncs.gov.in/" },
  { organization: "Railway Recruitment Boards", category: "Railway", url: "https://www.rrbapply.gov.in/" },
];

const absoluteUrl = (base: string, href: string) => {
  try { return new URL(href, base).toString(); } catch { return null; }
};
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

const extractLinks = (html: string, source: SourceConfig): LiveSource[] => {
  const results: LiveSource[] = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && results.length < 40) {
    const link = absoluteUrl(source.url, match[1]);
    const title = clean(match[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&"));
    if (!link || title.length < 8) continue;
    if (!/(recruit|vacanc|career|notification|advertisement|exam|admit|result|apply|selection|post|job|employment)/i.test(title + " " + link)) continue;
    if (results.some(item => item.link === link && item.title === title)) continue;
    results.push({
      id: Buffer.from(source.organization + "|" + title + "|" + link).toString("base64url").slice(0, 40),
      organization: source.organization,
      category: source.category,
      url: source.url,
      title,
      link,
      publishedAt: null,
      source: "OFFICIAL",
    });
  }
  return results;
};

export async function fetchLiveSourceNotices() {
  const settled = await Promise.allSettled(LIVE_SOURCES.map(async source => {
    const response = await fetch(source.url, {
      headers: { "user-agent": "NaukriMitra/1.0 (+https://rojgaarmitra.vercel.app)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${source.organization}: HTTP ${response.status}`);
    const html = await response.text();
    return { source, notices: extractLinks(html, source) };
  }));
  const notices = settled.flatMap(item => item.status === "fulfilled" ? item.value.notices : []);
  const failedSources = settled.flatMap(item => item.status === "rejected" ? [String(item.reason)] : []);
  return {
    data: notices,
    sources: LIVE_SOURCES.map(source => ({
      organization: source.organization,
      category: source.category,
      url: source.url,
      connected: !failedSources.some(error => error.includes(source.organization)),
    })),
    fetchedAt: new Date().toISOString(),
    note: "Live notices are read from official source pages. Verify the original notification before applying.",
  };
}
