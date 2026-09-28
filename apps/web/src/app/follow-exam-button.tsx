"use client";

import { useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export function FollowExamButton({ examId }: { examId: string }) {
  const [token, setToken] = useState("");
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void (async () => {
    let accessToken = sessionStorage.getItem("ns_access");
    if (!accessToken) { const response = await fetch(`${API}/api/v1/auth/refresh`, { method: "POST", credentials: "include" }); if (response.ok) { const data = await response.json(); accessToken = data.accessToken; sessionStorage.setItem("ns_access", accessToken!); } }
    if (!accessToken) return;
    setToken(accessToken);
    const response = await fetch(`${API}/api/v1/me/followed-exams`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.ok) { const data = await response.json(); setFollowing(data.data.some((item: { exam: { id: string } }) => item.exam.id === examId)); }
  })(); }, [examId]);
  async function toggle() {
    if (!token) { window.location.assign("/login"); return; }
    setBusy(true);
    const response = await fetch(`${API}/api/v1/me/followed-exams${following ? `/${encodeURIComponent(examId)}` : ""}`, { method: following ? "DELETE" : "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, ...(!following ? { body: JSON.stringify({ examId }) } : {}) });
    if (response.ok) setFollowing(!following);
    setBusy(false);
  }
  return <button className="btn btn-primary" type="button" onClick={()=>void toggle()} disabled={busy}>{busy ? "Saving…" : following ? "Following exam" : "Follow exam"}</button>;
}
