import type { Metadata } from "next";
import { UpdateFeed, updateFeedMetadata } from "../update-feed";
const description = "Review published government exam answer-key updates with their listed sources.";
export async function generateMetadata(): Promise<Metadata> { return updateFeedMetadata("answer-keys", "Answer Keys", description); }
export default function AnswerKeysPage() { return <UpdateFeed type="answer-keys" title="Answer keys" description="Published answer-key and response-sheet updates with source information."/>; }
