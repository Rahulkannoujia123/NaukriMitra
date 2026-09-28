import { UpdateDetail, updateMetadata } from "../../update-detail";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return updateMetadata(slug, "answerKey", "Answer key"); }
export default async function AnswerKeyDetailPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <UpdateDetail slug={slug} kind="answerKey" title="Answer key"/>; }
