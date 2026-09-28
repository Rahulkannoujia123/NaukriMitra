import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NaukriMitra — Government jobs matched to you", template: "%s | NaukriMitra" },
  description: "Find government jobs you're actually eligible for. Explore official notices, important dates, and personalized matches.",
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  openGraph: { title: "NaukriMitra", description: "Government jobs matched to your profile.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
