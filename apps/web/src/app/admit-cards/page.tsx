import type { Metadata } from "next";
import { UpdateFeed, updateFeedMetadata } from "../update-feed";
const description = "Find published recruitment admit-card updates and review their listed sources.";
export async function generateMetadata(): Promise<Metadata> { return updateFeedMetadata("admit-cards", "Admit Cards", description); }
export default function AdmitCardsPage() { return <UpdateFeed type="admit-cards" title="Admit cards" description="Published admit-card updates with recruitment details and source links."/>; }
