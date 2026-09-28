"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export default function LoginPage() {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API}/api/v1/auth/${register ? "register" : "login"}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "INVALID_CREDENTIALS" ? "Email or password is incorrect." : result.error === "INVALID_INPUT" ? "Enter a valid email and a password of at least 12 characters." : "Could not connect. Please try again.");
      sessionStorage.setItem("ns_access", result.accessToken);
      window.location.assign("/dashboard");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><div className="auth-top"><a href="/" className="link"><ArrowLeft size={15} style={{display:"inline",verticalAlign:"middle"}}/> Back to home</a></div><section className="auth-card"><a className="brand" href="/"><span className="brand-mark">N</span><span>Naukri<span style={{color:"#087b69"}}>Setu</span></span></a><h1>{register ? "Create your account" : "Welcome back"}</h1><p className="auth-sub">{register ? "Start building a profile for more relevant job matches." : "Sign in to continue to your personal dashboard."}</p><form onSubmit={submit} className="auth-form"><label>Email address<span className="field"><Mail size={17}/><input name="email" type="email" required autoComplete="email" placeholder="you@example.com"/></span></label><label>Password<span className="field"><LockKeyhole size={17}/><input name="password" type="password" required minLength={12} maxLength={128} autoComplete={register ? "new-password" : "current-password"} placeholder="At least 12 characters"/></span></label>{message && <div className="form-error" role="alert">{message}</div>}<button className="btn btn-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}<ArrowRight size={16}/></button></form><div className="auth-switch">{register ? "Already have an account?" : "New to NaukriSetu?"} <button onClick={()=>{setRegister(!register);setMessage("")}}>{register ? "Sign in" : "Create account"}</button></div><div className="auth-note"><ShieldCheck size={16}/> Your password is protected. Your session uses a secure, HttpOnly refresh cookie.</div></section><p className="auth-legal">By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p></main>;
}
