import type { Metadata } from "next";
import { UpdateFeed, updateFeedMetadata } from "../update-feed";
const description = "Review published recruitment results, cutoffs, and merit-list updates with their listed sources.";
export async function generateMetadata(): Promise<Metadata> { return updateFeedMetadata("results", "Latest Results", description); }
export default function ResultsPage() { return <UpdateFeed type="results" title="Latest results" description="Results, cutoffs, and merit lists published from recorded recruitment updates."/>; }
