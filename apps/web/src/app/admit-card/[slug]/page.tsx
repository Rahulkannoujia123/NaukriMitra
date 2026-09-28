import { UpdateDetail, updateMetadata } from "../../update-detail";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return updateMetadata(slug, "admitCard", "Admit card"); }
export default async function AdmitCardDetailPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <UpdateDetail slug={slug} kind="admitCard" title="Admit card"/>; }
