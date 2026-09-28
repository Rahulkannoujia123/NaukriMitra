import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { const site = process.env.SITE_URL ?? "http://localhost:3000"; return { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/login", "/preparation", "/search"] }, sitemap: `${site}/sitemap.xml` }; }
