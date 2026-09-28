import { UpdateDetail, updateMetadata } from "../../update-detail";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return updateMetadata(slug, "results", "Recruitment result"); }
export default async function ResultDetailPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <UpdateDetail slug={slug} kind="results" title="Recruitment result"/>; }
