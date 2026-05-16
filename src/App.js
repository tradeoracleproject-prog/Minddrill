import { useState, useEffect, useRef, useCallback } from "react";
import { UNIVERSITIES, PROGRAMMES } from "./data";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SB  = "https://lezdidskdvykmumajedj.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlemRpZHNrZHZ5a211bWFqZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTI0MDMsImV4cCI6MjA5NDA2ODQwM30.R-dzOu1WmfV7mqBg35bd1m4NgMUVxEoNQtwuNFkSnVE";
const ADMIN_EMAIL = "amjoshuadavid@gmail.com";
const WHATSAPP    = "2349117405218";

const SEEDS = [
  { code:"AFIT-GST108", title:"Use Of Library, Study Skills And ICT" },
  { code:"PHY104",      title:"General Physics IV (Vibration, Waves And Optics)" },
  { code:"STA112",      title:"Probability I" },
  { code:"TEE102",      title:"Introduction To Telecommunications Engineering" },
  { code:"GET102",      title:"Engineering Graphics And Solid Modelling I" },
  { code:"PHY108",      title:"General Practical Physics II" },
  { code:"PHY102",      title:"General Physics II" },
  { code:"MTH102",      title:"Elementary Mathematics II" },
  { code:"CHM108",      title:"General Chemistry Practical II" },
  { code:"CHM102",      title:"General Chemistry II" },
  { code:"GST112",      title:"Nigerian Peoples And Culture" },
];

const QUOTES = [
  "Success is the sum of small efforts repeated day in and day out.",
  "The secret of getting ahead is getting started.",
  "Don't watch the clock; do what it does — keep going.",
  "Believe you can and you're halfway there.",
  "Push yourself because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Study hard in silence; let success make the noise.",
  "Every expert was once a beginner.",
  "Discipline is the bridge between goals and accomplishment.",
  "A little progress each day adds up to big results.",
  "Education is the most powerful weapon you can use to change the world.",
  "Don't stop when you're tired. Stop when you're done.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "You are capable of more than you know.",
  "Dream it. Believe it. Achieve it.",
];

// ─── API ──────────────────────────────────────────────────────────────────────
const db = async (path, opts = {}, tok = null) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${tok || KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || e.hint || r.statusText); }
  const t = await r.text(); return t ? JSON.parse(t) : null;
};

const authCall = async (path, body) => {
  const r = await fetch(`${SB}/auth/v1/${path}`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error_description || d.msg || d.error || "Auth failed");
  return d;
};

const verifyTok = async (t) => {
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error("expired");
  return r.json();
};

const aiCall = async (prompt) => {
  try { const r = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }); const d = await r.json(); return d.text || ""; } catch { return ""; }
};

const parseQs = (raw) => {
  const out = [];
  const blocks = raw.trim().split(/\n(?=\s*\d+[\.\)]\s)/);
  for (const blk of blocks) {
    const lines = blk.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;
    const q = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
    const opts = {}; let ans = "";
    for (const l of lines) {
      const om = l.match(/^([A-Da-d])[\.\)]\s*(.+)/); if (om) opts[om[1].toUpperCase()] = om[2].trim();
      const am = l.match(/^[Aa]nswer\s*[:\-]\s*([A-Da-d])/); if (am) ans = am[1].toUpperCase();
    }
    if (!q || Object.keys(opts).length < 4 || !ans) continue;
    out.push({ question: q, A: opts.A || "", B: opts.B || "", C: opts.C || "", D: opts.D || "", answer: ans });
  }
  return out;
};

const gradeOf = (p) => {
  if (p >= 90) return { g: "A+", c: "#15803d" };
  if (p >= 80) return { g: "A",  c: "#16a34a" };
  if (p >= 70) return { g: "B",  c: "#2563eb" };
  if (p >= 60) return { g: "C",  c: "#ca8a04" };
  if (p >= 50) return { g: "D",  c: "#ea580c" };
  return { g: "F", c: "#dc2626" };
};

// ─── COLOURS ──────────────────────────────────────────────────────────────────
const BL = "#1d4ed8", BL2 = "#2563eb", BLT = "#eff6ff", BLB = "#bfdbfe";
const LT = { bg:"#fff", s2:"#f8fafc", fg:"#0f172a", mu:"#64748b", br:"#e2e8f0", sf:"#f1f5f9", cd:"#fff", correct:"#16a34a", wrong:"#dc2626", warn:"#d97706" };
const DK = { bg:"#0f172a", s2:"#1e293b", fg:"#f1f5f9", mu:"#94a3b8", br:"#1e293b", sf:"#1e293b", cd:"#1e293b", correct:"#22c55e", wrong:"#ef4444", warn:"#f59e0b" };

const DOT = (dark) => ({ backgroundImage: dark ? "radial-gradient(circle,rgba(59,130,246,.12) 1px,transparent 1px)" : "radial-gradient(circle,rgba(30,58,138,.055) 1px,transparent 1px)", backgroundSize: "24px 24px" });

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const CSS = (T) => `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{background:${T.bg};color:${T.fg};font-family:'Inter',sans-serif;min-height:100vh;overflow-x:hidden;transition:background .25s,color .25s}
input,textarea,select,button{font-family:inherit}button{cursor:pointer;border:none;background:none}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${T.br};border-radius:2px}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes sq{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:translateX(0)}}
@keyframes pop{0%{transform:scale(.82);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fall{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.au{animation:up .3s ease both}.sq{animation:sq .22s ease both}.pop{animation:pop .38s cubic-bezier(.34,1.56,.64,1) both}
input:focus,textarea:focus{outline:2px solid ${BL};outline-offset:0}
.sk{background:linear-gradient(90deg,${T.br} 25%,${T.sf} 50%,${T.br} 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:10px}
`;

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Sp = ({ sz = 22, c = BL }) => <div style={{ width: sz, height: sz, border: "2.5px solid #e2e8f0", borderTopColor: c, borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />;

const Pg = ({ children, style = {} }) => <div className="au" style={{ minHeight: "100vh", padding: "24px 18px 96px", maxWidth: 520, margin: "0 auto", ...style }}>{children}</div>;

const BkBtn = ({ onClick, T }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 5, color: T.mu, fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
    ← Back
  </button>
);

const Lbl = ({ children }) => <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: ".07em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>{children}</label>;

const Inp = ({ label, value, onChange, type = "text", placeholder = "", style = {}, prefix }) => (
  <div>
    {label && <Lbl>{label}</Lbl>}
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontWeight: 700, userSelect: "none" }}>{prefix}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: prefix ? "13px 14px 13px 30px" : "13px 14px", fontSize: 15, background: "#fff", color: "#0f172a", ...style }} />
    </div>
  </div>
);

const Tog = ({ on, set }) => (
  <button onClick={() => set(!on)} style={{ width: 50, height: 27, borderRadius: 14, background: on ? BL : "#e2e8f0", border: "none", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
    <div style={{ width: 21, height: 21, background: "#fff", borderRadius: "50%", position: "absolute", top: 3, left: on ? 26 : 3, transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
  </button>
);

const Chip = ({ children, active, onClick }) => (
  <button onClick={onClick} style={{ padding: "8px 15px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: `1.5px solid ${active ? BL : "#e2e8f0"}`, background: active ? BL : "#f1f5f9", color: active ? "#fff" : "#0f172a", flexShrink: 0 }}>
    {children}
  </button>
);

const Badge = ({ children, bg = BL }) => <span style={{ background: bg, color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{children}</span>;

const Sk = ({ h = 60, mb = 10 }) => <div className="sk" style={{ height: h, marginBottom: mb }} />;

const SecLbl = ({ children, T }) => <p style={{ fontSize: 11, fontWeight: 800, color: T.mu, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{children}</p>;

// Searchable dropdown
const SDrop = ({ items, value, onChange, placeholder, T }) => {
  const [q, setQ] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const filtered = q.length > 1 ? items.filter(i => i.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder}
        style={{ width: "100%", border: `1.5px solid ${T.br}`, borderRadius: 12, padding: "13px 14px", fontSize: 14, background: T.bg, color: T.fg }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.bg, border: `1.5px solid ${T.br}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.14)", zIndex: 999, maxHeight: 230, overflowY: "auto", marginTop: 4 }}>
          {filtered.map(item => (
            <button key={item} onClick={() => { onChange(item); setQ(item); setOpen(false); }}
              style={{ width: "100%", padding: "12px 16px", textAlign: "left", fontSize: 14, color: T.fg, background: "none", border: "none", borderBottom: `1px solid ${T.br}`, cursor: "pointer" }}>
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [user,   setUser]   = useState(null);
  const [tok,    setTok]    = useState(null);
  const [dark,   setDark]   = useState(() => localStorage.getItem("md_dk") === "1");
  const [toast,  setToast]  = useState(null);
  const [ctx,    setCtx]    = useState({});
  const T = dark ? DK : LT;

  const msg = useCallback((m, type = "info") => { setToast({ m, type }); setTimeout(() => setToast(null), 3600); }, []);
  const go  = useCallback((s, d = {}) => { setCtx(d); setScreen(s); window.scrollTo(0, 0); }, []);
  const tdk = () => setDark(v => { localStorage.setItem("md_dk", !v ? "1" : "0"); return !v; });

  useEffect(() => {
    (async () => {
      try {
        const t = localStorage.getItem("md_t"), u = localStorage.getItem("md_u");
        if (!t || !u || t.split(".").length !== 3) { localStorage.clear(); setTimeout(() => setScreen("auth"), 1900); return; }
        const fresh = await verifyTok(t);
        setTok(t); setUser(fresh);
        setScreen(!fresh.user_metadata?.onboarded ? "onboard" : "home");
      } catch { localStorage.removeItem("md_t"); localStorage.removeItem("md_u"); setTimeout(() => setScreen("auth"), 100); }
    })();
  }, []);

  const store = (data) => {
    const t = data.access_token;
    if (!t || t.split(".").length !== 3) throw new Error("Invalid session. Try again.");
    localStorage.setItem("md_t", t); localStorage.setItem("md_u", JSON.stringify(data.user));
    setTok(t); setUser(data.user);
  };

  const logout = () => { localStorage.removeItem("md_t"); localStorage.removeItem("md_u"); setUser(null); setTok(null); setScreen("auth"); };

  const isAdmin = user?.email === ADMIN_EMAIL;
  const p = { user, tok, go, msg, T, dark, tdk, ctx, logout, store, isAdmin };
  const NAV = ["home", "courses", "performance", "profile"];

  return (
    <>
      <style>{CSS(T)}</style>
      {toast && (
        <div className="pop" style={{ position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? "#dc2626" : toast.type === "success" ? "#16a34a" : BL, color: "#fff", borderRadius: 16, padding: "12px 22px", fontSize: 14, fontWeight: 700, zIndex: 9999, maxWidth: "90vw", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,.22)", lineHeight: 1.5 }}>
          {toast.m}
        </div>
      )}
      {screen === "splash"   && <SplashSc />}
      {screen === "auth"     && <AuthSc {...p} />}
      {screen === "forgot"   && <ForgotSc {...p} />}
      {screen === "onboard"  && <OnboardSc {...p} />}
      {screen === "home"     && <HomeSc {...p} />}
      {screen === "courses"  && <CoursesSc {...p} />}
      {screen === "cdetail"  && <CDetailSc {...p} />}
      {screen === "upload"   && <UploadSc {...p} />}
      {screen === "submit-q" && <SubmitQSc {...p} />}
      {screen === "mode"     && <ModeSc {...p} />}
      {screen === "setup"    && <SetupSc {...p} />}
      {screen === "session"  && <SessionSc {...p} />}
      {screen === "timesup"  && <TimesUpSc {...p} />}
      {screen === "results"  && <ResultsSc {...p} />}
      {screen === "review"   && <ReviewSc {...p} />}
      {screen === "perf"     && <PerfSc {...p} />}
      {screen === "profile"  && <ProfileSc {...p} />}
      {screen === "help"     && <HelpSc {...p} />}
      {screen === "admin"    && <AdminSc {...p} />}
      {NAV.includes(screen) && <NavBar cur={screen} go={go} T={T} isAdmin={isAdmin} />}
    </>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function NavBar({ cur, go, T, isAdmin }) {
  const items = [{ id: "home", lb: "Home" }, { id: "courses", lb: "Courses" }, { id: "perf", lb: "Stats" }, { id: "profile", lb: "Profile" }];
  const icons = { home: "⚡", courses: "📚", perf: "📊", profile: "👤" };
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, background: T.bg, borderTop: `1px solid ${T.br}`, display: "flex", justifyContent: "space-around", padding: "9px 0 20px", zIndex: 200, boxShadow: "0 -4px 20px rgba(0,0,0,.06)" }}>
      {items.map(it => {
        const act = cur === it.id || (it.id === "perf" && cur === "performance");
        return (
          <button key={it.id} onClick={() => go(it.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 14px", color: act ? BL : T.mu, position: "relative" }}>
            {act && <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", width: 24, height: 3, background: BL, borderRadius: "0 0 4px 4px" }} />}
            <span style={{ fontSize: 22 }}>{icons[it.id]}</span>
            <span style={{ fontSize: 11, fontWeight: act ? 800 : 500 }}>{it.lb}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function SplashSc() {
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, ...DOT(true) }}>
      <div className="pop" style={{ width: 88, height: 88, background: BL, borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${BL}66` }}>
        <span style={{ fontSize: 44 }}>⚡</span>
      </div>
      <h1 style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-.05em" }}>MindDrill</h1>
      <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase" }}>Sharpen Your Mind</p>
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthSc({ go, msg, T, store }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState(""); const [uname, setUname] = useState(""); const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !pw) return msg("Fill in all fields", "error");
    if (mode === "signup") {
      if (!name.trim()) return msg("Enter your full name", "error");
      if (!uname.trim()) return msg("Choose a username", "error");
      if (uname.includes(" ") || uname.length < 3) return msg("Username: min 3 chars, no spaces", "error");
    }
    if (pw.length < 6) return msg("Password needs at least 6 characters", "error");
    setBusy(true);
    try {
      let data;
      if (mode === "signup") {
        data = await authCall("signup", { email: email.trim(), password: pw, data: { full_name: name.trim(), username: uname.trim().toLowerCase() } });
        if (!data.access_token) { msg("Account created! Check your email to confirm, then sign in.", "success"); setMode("signin"); setBusy(false); return; }
      } else {
        data = await authCall("token?grant_type=password", { email: email.trim(), password: pw });
      }
      store(data);
      const meta = data.user?.user_metadata || {};
      go(!meta.onboarded ? "onboard" : "home");
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", ...DOT(false) }}>
      <div style={{ background: "#0f172a", padding: "52px 26px 48px", position: "relative", overflow: "hidden", ...DOT(true) }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: `${BL}22` }} />
        <div style={{ width: 54, height: 54, background: BL, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative" }}>
          <span style={{ fontSize: 26 }}>⚡</span>
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-.04em", marginBottom: 6, position: "relative" }}>MindDrill</h1>
        <p style={{ color: "rgba(255,255,255,.45)", fontSize: 14, position: "relative" }}>
          {mode === "signin" ? "Welcome back. Let's drill." : "The smart study platform for university students."}
        </p>
      </div>
      <div className="au" style={{ flex: 1, padding: "26px 24px 40px" }}>
        <div style={{ display: "flex", background: T.sf, borderRadius: 14, padding: 4, marginBottom: 24 }}>
          {["signin", "signup"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "11px", borderRadius: 11, fontWeight: 700, fontSize: 14, background: mode === m ? T.bg : "transparent", color: mode === m ? T.fg : T.mu, boxShadow: mode === m ? "0 1px 6px rgba(0,0,0,.08)" : "none", transition: "all .2s" }}>
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 15, marginBottom: 18 }}>
          {mode === "signup" && (
            <>
              <Inp label="Full Name" value={name} onChange={setName} placeholder="Your full name" />
              <Inp label="Username" value={uname} onChange={v => setUname(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="yourname" prefix="@" />
            </>
          )}
          <Inp label="Email Address" value={email} onChange={setEmail} type="email" placeholder="you@email.com" />
          <div>
            <Lbl>Password</Lbl>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} placeholder="Min. 6 characters"
                style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "13px 44px 13px 14px", fontSize: 15, background: "#fff", color: "#0f172a" }} />
              <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: .5 }}>
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
        </div>
        <button onClick={submit} disabled={busy} style={{ width: "100%", background: BL, color: "#fff", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12, opacity: busy ? .65 : 1 }}>
          {busy ? <Sp c="#fff" /> : mode === "signin" ? "Sign In →" : "Create Account →"}
        </button>
        {mode === "signin" && (
          <button onClick={() => go("forgot")} style={{ width: "100%", textAlign: "center", color: BL, fontSize: 14, fontWeight: 600, padding: "8px" }}>Forgot password?</button>
        )}
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
function ForgotSc({ go, msg, T }) {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const send = async () => {
    if (!email.trim()) return msg("Enter your email", "error");
    setBusy(true);
    try {
      const r = await fetch(`${SB}/auth/v1/recover`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      if (!r.ok) throw new Error("Failed to send reset email");
      setSent(true);
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };
  return (
    <Pg style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <BkBtn onClick={() => go("auth")} T={T} />
      {!sent ? (
        <>
          <div style={{ width: 60, height: 60, background: BLT, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 28 }}>🔒</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: T.fg, marginBottom: 8 }}>Reset Password</h1>
          <p style={{ color: T.mu, fontSize: 15, marginBottom: 26, lineHeight: 1.6 }}>Enter your email and we'll send a reset link.</p>
          <Inp label="Email Address" value={email} onChange={setEmail} type="email" placeholder="you@email.com" />
          <button onClick={send} disabled={busy} style={{ width: "100%", background: BL, color: "#fff", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 800, marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? .65 : 1 }}>
            {busy ? <Sp c="#fff" /> : "Send Reset Link"}
          </button>
        </>
      ) : (
        <div className="pop" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: T.fg, marginBottom: 10 }}>Check your email</h2>
          <p style={{ color: T.mu, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>Reset link sent to <strong>{email}</strong></p>
          <button onClick={() => go("auth")} style={{ background: BL, color: "#fff", borderRadius: 14, padding: "15px 28px", fontWeight: 800, fontSize: 15 }}>Back to Sign In</button>
        </div>
      )}
    </Pg>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function OnboardSc({ user, tok, go, msg, T }) {
  const [step, setStep] = useState(0);
  const [uni, setUni] = useState(""); const [prog, setProg] = useState(""); const [busy, setBusy] = useState(false);
  const meta = user?.user_metadata || {};
  const fname = meta.full_name?.split(" ")[0] || meta.username || "there";

  const features = [
    { icon: "🧪", title: "Test Mode", desc: "Answer questions under real exam conditions. Grade and full review at the end." },
    { icon: "📖", title: "Study Mode", desc: "See the correct answer immediately after each pick. AI explains every wrong answer." },
    { icon: "🏋️", title: "Practice Mode", desc: "Wrong answers repeat until you get them right. Build true mastery." },
    { icon: "🤖", title: "AI-Powered", desc: "Gemini AI picks your questions intelligently and explains wrong answers in detail." },
    { icon: "📊", title: "Performance Tracking", desc: "Track every session, score trend, streaks, and improvement over time." },
    { icon: "📤", title: "Community Question Bank", desc: "Anyone can upload questions. The more people contribute, the bigger the bank gets." },
  ];

  const finish = async () => {
    if (!uni) return msg("Select your institution", "error");
    if (!prog) return msg("Select your programme", "error");
    setBusy(true);
    try {
      await fetch(`${SB}/auth/v1/user`, { method: "PUT", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { ...meta, university: uni, programme: prog, onboarded: true } }) });
      const updated = { ...user, user_metadata: { ...meta, university: uni, programme: prog, onboarded: true } };
      localStorage.setItem("md_u", JSON.stringify(updated));
      go("home");
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };

  const steps = ["welcome", "institution", "programme"];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, ...DOT(false) }}>
      <div style={{ background: "#0f172a", padding: "36px 22px 28px", ...DOT(true) }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? BL : "rgba(255,255,255,.15)" }} />)}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-.03em" }}>
          {step === 0 ? `Welcome, ${fname}! 👋` : step === 1 ? "Your Institution" : "Your Programme"}
        </h2>
        <p style={{ color: "rgba(255,255,255,.45)", fontSize: 13, marginTop: 5 }}>
          {step === 0 ? "Discover what MindDrill can do for you." : step === 1 ? "Which institution are you in?" : "What are you studying?"}
        </p>
      </div>

      <div className="au" style={{ padding: "24px 20px 40px" }}>
        {step === 0 && (
          <>
            <div style={{ background: BLT, borderRadius: 16, padding: "18px", marginBottom: 22, border: `1.5px solid ${BLB}` }}>
              <p style={{ fontWeight: 800, color: BL, fontSize: 15, marginBottom: 8 }}>🎯 What is MindDrill?</p>
              <p style={{ color: "#1e40af", fontSize: 14, lineHeight: 1.7 }}>
                MindDrill is the smart, free study platform built to help Nigerian university students master their courses through repeated practice, intelligent AI explanations, and complete exam readiness.
              </p>
            </div>
            <SecLbl T={T}>Features</SecLbl>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {features.map(f => (
                <div key={f.title} style={{ background: T.sf, borderRadius: 14, padding: "14px", border: `1.5px solid ${T.br}` }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: T.fg, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: T.mu, lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 14, padding: "14px 16px", marginBottom: 20, border: "1.5px solid #bbf7d0" }}>
              <p style={{ fontWeight: 800, color: "#15803d", fontSize: 13, marginBottom: 4 }}>✅ Quick Guide</p>
              <p style={{ color: "#166534", fontSize: 13, lineHeight: 1.7 }}>1. Browse Courses → 2. Pick a mode → 3. Set up your drill → 4. Start answering → 5. Review with AI explanations → 6. Track your progress</p>
            </div>
            <button onClick={() => setStep(1)} style={{ width: "100%", background: BL, color: "#fff", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              Get Started →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <Lbl>Search Your Institution</Lbl>
            <SDrop items={UNIVERSITIES} value={uni} onChange={setUni} placeholder="Type institution name..." T={T} />
            {uni && <div style={{ marginTop: 10, padding: "11px 15px", background: BLT, borderRadius: 11, display: "flex", gap: 8, alignItems: "center" }}><span>✅</span><span style={{ fontSize: 14, color: BL, fontWeight: 700 }}>{uni}</span></div>}
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, background: T.sf, color: T.fg, borderRadius: 13, padding: "14px", fontWeight: 700, fontSize: 15, border: `1.5px solid ${T.br}` }}>Back</button>
              <button onClick={() => uni ? setStep(2) : msg("Select your institution first", "error")} style={{ flex: 2, background: BL, color: "#fff", borderRadius: 13, padding: "14px", fontSize: 15, fontWeight: 800 }}>Continue →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Lbl>Search Your Programme / Course of Study</Lbl>
            <SDrop items={PROGRAMMES} value={prog} onChange={setProg} placeholder="Type programme name..." T={T} />
            {prog && <div style={{ marginTop: 10, padding: "11px 15px", background: BLT, borderRadius: 11, display: "flex", gap: 8, alignItems: "center" }}><span>✅</span><span style={{ fontSize: 14, color: BL, fontWeight: 700 }}>{prog}</span></div>}
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: T.sf, color: T.fg, borderRadius: 13, padding: "14px", fontWeight: 700, fontSize: 15, border: `1.5px solid ${T.br}` }}>Back</button>
              <button onClick={finish} disabled={busy} style={{ flex: 2, background: BL, color: "#fff", borderRadius: 13, padding: "14px", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? .65 : 1 }}>
                {busy ? <Sp c="#fff" /> : "Start Drilling ⚡"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeSc({ user, tok, go, T, dark, tdk, isAdmin }) {
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);
  const meta   = user?.user_metadata || {};
  const uname  = meta.username || meta.full_name?.split(" ")[0] || "Student";
  const fname  = meta.full_name?.split(" ")[0] || uname;
  const avatar = meta.avatar_url;
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  useEffect(() => {
    (async () => {
      try {
        const sess = await db(`sessions?user_id=eq.${user.id}&order=created_at.desc&limit=50`, {}, tok) || [];
        if (sess.length) {
          const avg = Math.round(sess.reduce((a, s) => a + (s.percentage || 0), 0) / sess.length);
          const best = Math.max(...sess.map(s => s.percentage || 0));
          const total = sess.reduce((a, s) => a + (s.total || 0), 0);
          let streak = 0;
          const today = new Date(); today.setHours(0,0,0,0);
          const days = new Set(sess.map(s => new Date(s.created_at).toDateString()));
          for (let i = 0; i < 365; i++) { const d = new Date(today); d.setDate(d.getDate()-i); if(days.has(d.toDateString()))streak++; else if(i>0)break; }
          setStats({ sessions: sess.length, avg, best, streak, total });
          const seen = new Set(); const rc = [];
          for (const s of sess) { if (!seen.has(s.course_code) && s.course_code) { seen.add(s.course_code); rc.push(s); if(rc.length===3)break; } }
          setRecent(rc);
        } else { setStats({ sessions:0, avg:0, best:0, streak:0, total:0 }); }
      } catch { setStats({ sessions:0, avg:0, best:0, streak:0, total:0 }); }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:T.bg, maxWidth:520, margin:"0 auto", ...DOT(dark) }}>
      {/* Hero */}
      <div style={{ background:"#0f172a", padding:"30px 20px 26px", position:"relative", overflow:"hidden", ...DOT(true) }}>
        <div style={{ position:"absolute", top:-50, right:-50, width:200, height:200, borderRadius:"50%", background:`${BL}18` }}/>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div onClick={()=>go("profile")} style={{ width:46, height:46, borderRadius:"50%", background:"#1e293b", border:`2px solid ${BL}66`, overflow:"hidden", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {avatar ? <img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/> : <span style={{color:"#fff",fontSize:18,fontWeight:900}}>{uname[0]?.toUpperCase()}</span>}
            </div>
            <div>
              <p style={{fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600}}>{greet}</p>
              <p style={{fontSize:16,color:"#fff",fontWeight:800}}>@{uname}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {isAdmin && <button onClick={()=>go("admin")} style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.1)",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🛡️</button>}
            <button onClick={tdk} style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.1)",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {dark?"☀️":"🌙"}
            </button>
          </div>
        </div>
        <p style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:3,fontWeight:600,position:"relative"}}>Hello, {fname}!</p>
        <h2 style={{fontSize:30,fontWeight:900,color:"#fff",letterSpacing:"-.04em",lineHeight:1.1,marginBottom:stats?.streak>0?14:0,position:"relative"}}>Ready to drill today?</h2>
        {stats?.streak > 0 && <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.1)",borderRadius:22,padding:"8px 16px",marginBottom:16}}>
          <span>🔥</span><span style={{color:"#fff",fontWeight:800,fontSize:14}}>{stats.streak} Day Streak</span>
        </div>}
        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden",position:"relative"}}>
          {loading ? [0,1,2].map(i=><div key={i} style={{height:62,background:"rgba(255,255,255,.04)"}}/>) :
            [{l:"Sessions",v:stats.sessions},{l:"Avg Score",v:`${stats.avg}%`},{l:"Best",v:`${stats.best}%`}].map((s,i)=>(
              <div key={s.l} style={{padding:"13px 10px",textAlign:"center",background:i===1?"rgba(255,255,255,.06)":"transparent"}}>
                <div style={{fontSize:21,fontWeight:900,color:"#fff"}}>{s.v}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:3,fontWeight:700}}>{s.l}</div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Body */}
      <div style={{padding:"20px 18px 96px"}}>
        <button onClick={()=>go("courses")} style={{width:"100%",background:BL,color:"#fff",borderRadius:16,padding:"17px",fontSize:17,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:20,boxShadow:`0 4px 16px ${BL}44`}}>
          ⚡ Start Drilling
        </button>

        {/* Quick stats */}
        {stats && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            <div style={{background:"#dcfce7",borderRadius:16,padding:"16px"}}>
              <div style={{fontSize:26,marginBottom:4}}>✅</div>
              <div style={{fontSize:24,fontWeight:900,color:"#15803d"}}>{stats.total}</div>
              <div style={{fontSize:12,color:"#166534",fontWeight:700,marginTop:2}}>Questions Answered</div>
            </div>
            <div style={{background:"#dbeafe",borderRadius:16,padding:"16px"}}>
              <div style={{fontSize:26,marginBottom:4}}>🏆</div>
              <div style={{fontSize:24,fontWeight:900,color:BL}}>{stats.sessions}</div>
              <div style={{fontSize:12,color:"#1e40af",fontWeight:700,marginTop:2}}>Drills Completed</div>
            </div>
          </div>
        )}

        {/* Quote */}
        <div style={{background:T.sf,borderRadius:14,padding:"14px 16px",marginBottom:20,border:`1.5px solid ${T.br}`,display:"flex",gap:12}}>
          <span style={{fontSize:20,flexShrink:0}}>💬</span>
          <p style={{fontSize:13,color:T.mu,lineHeight:1.7,fontStyle:"italic"}}>{quote}</p>
        </div>

        {/* Recent courses */}
        {recent.length > 0 && (
          <>
            <SecLbl T={T}>Continue Where You Left Off</SecLbl>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {recent.map(s=>{const{g,c}=gradeOf(s.percentage||0);return(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",background:T.sf,borderRadius:14,border:`1.5px solid ${T.br}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:T.fg}}>{s.course_code}</div>
                    <div style={{fontSize:12,color:T.mu,marginTop:2}}>Last: {s.score}/{s.total} · <Badge bg={c}>{g}</Badge></div>
                  </div>
                  <button onClick={()=>go("courses")} style={{display:"flex",alignItems:"center",gap:5,background:BLT,color:BL,borderRadius:10,padding:"7px 13px",fontSize:13,fontWeight:700,flexShrink:0}}>
                    ▶ Resume
                  </button>
                </div>
              );})}
            </div>
          </>
        )}

        {/* Actions */}
        <SecLbl T={T}>Quick Actions</SecLbl>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {e:"📤",lb:"Upload Questions",sub:"Add questions to any course",action:()=>go("courses")},
            {e:"📩",lb:"Submit Questions",sub:"Send questions to be reviewed & uploaded",action:()=>go("submit-q")},
            {e:"❓",lb:"Help & Support",sub:"Guides and contact support",action:()=>go("help")},
          ].map(a=>(
            <button key={a.lb} onClick={a.action} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",border:`1.5px solid ${T.br}`,borderRadius:14,background:T.bg,cursor:"pointer",textAlign:"left",width:"100%"}}>
              <div style={{width:44,height:44,background:T.sf,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{a.e}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:T.fg}}>{a.lb}</div>
                <div style={{fontSize:12,color:T.mu,marginTop:2}}>{a.sub}</div>
              </div>
              <span style={{color:T.mu,fontSize:20}}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COURSES ──────────────────────────────────────────────────────────────────
function CoursesSc({ user, tok, go, msg, T, isAdmin }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [nc, setNc] = useState(""); const [nt, setNt] = useState("");
  const [adding, setAdding] = useState(false); const [search, setSearch] = useState("");

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    setLoading(true);
    try {
      const ex = await db("courses?select=code",{},tok)||[];
      const exSet = new Set(ex.map(c=>c.code));
      for (const c of SEEDS) { if(!exSet.has(c.code)) await db("courses",{method:"POST",body:JSON.stringify({code:c.code,title:c.title,created_by:user.id})},tok).catch(()=>{}); }
      const all = await db("courses?select=*&order=title.asc",{},tok)||[];
      const qs  = await db("questions?select=course_id",{},tok)||[];
      const cm  = {}; qs.forEach(q=>{cm[q.course_id]=(cm[q.course_id]||0)+1;});
      setCourses(all.map(c=>({...c,qc:cm[c.id]||0})));
    } catch(e){ msg("Failed to load: "+e.message,"error"); }
    setLoading(false);
  };

  const addCourse = async () => {
    if(!nc.trim()||!nt.trim()) return msg("Fill in both fields","error");
    const cd=nc.trim().toUpperCase();
    if(courses.find(c=>c.code===cd)) return msg("Course code already exists","error");
    setAdding(true);
    try { await db("courses",{method:"POST",body:JSON.stringify({code:cd,title:nt.trim(),created_by:user.id})},tok); msg("Course created!","success"); setNc(""); setNt(""); setShowAdd(false); load(); }
    catch(e){ msg(e.message,"error"); }
    setAdding(false);
  };

  const deleteCourse = async (c) => {
    if(!window.confirm(`Delete "${c.title}"? All questions will be lost.`)) return;
    try { await db(`courses?id=eq.${c.id}`,{method:"DELETE"},tok); msg("Course deleted","success"); load(); }
    catch(e){ msg(e.message,"error"); }
  };

  const filt = courses.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())||c.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <Pg>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <h1 style={{fontSize:28,fontWeight:900,letterSpacing:"-.04em",color:T.fg}}>Courses</h1>
        <button onClick={()=>setShowAdd(!showAdd)} style={{background:showAdd?T.sf:BL,color:showAdd?T.fg:"#fff",borderRadius:11,padding:"8px 16px",fontSize:13,fontWeight:700,border:`1.5px solid ${showAdd?T.br:BL}`}}>
          {showAdd?"Cancel":"+ New"}
        </button>
      </div>
      <p style={{color:T.mu,fontSize:13,marginBottom:20}}>{courses.length} courses · {courses.reduce((a,c)=>a+c.qc,0)} questions total</p>

      {showAdd && (
        <div style={{background:T.sf,borderRadius:16,padding:18,marginBottom:20,display:"flex",flexDirection:"column",gap:14,border:`1.5px solid ${T.br}`}}>
          <Inp label="Course Code" value={nc} onChange={setNc} placeholder="e.g. BIO201"/>
          <Inp label="Course Title" value={nt} onChange={setNt} placeholder="e.g. Cell Biology"/>
          <button onClick={addCourse} disabled={adding} style={{background:BL,color:"#fff",borderRadius:12,padding:"13px",fontWeight:700,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:adding?.65:1}}>
            {adding?<><Sp c="#fff"/>Creating...</>:"Create Course"}
          </button>
        </div>
      )}

      <div style={{position:"relative",marginBottom:20}}>
        <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:16,opacity:.4}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search courses..." style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:13,padding:"12px 14px 12px 38px",fontSize:14,background:T.bg,color:T.fg}}/>
      </div>

      {loading ? <div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3,4].map(i=><Sk key={i} h={76}/>)}</div> : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filt.map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,padding:"15px 16px",border:`1.5px solid ${T.br}`,borderRadius:16,background:T.bg}}>
              <div onClick={()=>go("cdetail",{course:c})} style={{flex:1,display:"flex",alignItems:"center",gap:14,cursor:"pointer",minWidth:0}}>
                <div style={{width:46,height:46,background:BLT,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:900,color:BL,textAlign:"center",lineHeight:1.3,padding:"0 3px"}}>{c.code.slice(0,8)}</span>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:T.fg,lineHeight:1.4}}>{c.title}</div>
                  <div style={{fontSize:12,color:T.mu,marginTop:3}}>{c.code} · {c.qc} questions</div>
                </div>
              </div>
              {isAdmin && (
                <button onClick={()=>deleteCourse(c)} style={{width:34,height:34,background:"#fee2e2",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:15}}>
                  🗑️
                </button>
              )}
            </div>
          ))}
          {!filt.length && <p style={{textAlign:"center",color:T.mu,padding:"48px 0",fontSize:15}}>No courses found.</p>}
        </div>
      )}
    </Pg>
  );
}

// ─── COURSE DETAIL ────────────────────────────────────────────────────────────
function CDetailSc({ user, tok, go, T, ctx }) {
  const { course } = ctx;
  const [topics, setTopics] = useState([]); const [qc, setQc] = useState(0); const [loading, setLoading] = useState(true);
  useEffect(()=>{
    db(`questions?course_id=eq.${course.id}&select=topic`,{},tok).then(qs=>{
      if(!qs)return; setQc(qs.length);
      const m={}; qs.forEach(q=>{const t=q.topic||"General";m[t]=(m[t]||0)+1;});
      setTopics(Object.entries(m).map(([n,c])=>({n,c})).sort((a,b)=>b.c-a.c));
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);
  return (
    <Pg>
      <BkBtn onClick={()=>go("courses")} T={T}/>
      <div style={{background:"#0f172a",borderRadius:20,padding:"22px 20px",marginBottom:22,color:"#fff",...DOT(true)}}>
        <div style={{fontSize:11,fontWeight:800,opacity:.4,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>{course.code}</div>
        <h2 style={{fontSize:20,fontWeight:900,letterSpacing:"-.03em",lineHeight:1.35,marginBottom:10}}>{course.title}</h2>
        <div style={{fontSize:13,opacity:.5,fontWeight:700}}>{loading?"Loading...":`${qc} questions in the bank`}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
        <button onClick={()=>go("mode",{course})} style={{background:BL,color:"#fff",borderRadius:14,padding:"16px",fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:12,boxShadow:`0 4px 14px ${BL}44`}}>
          ⚡ Start Session
        </button>
        <button onClick={()=>go("upload",{course})} style={{background:T.sf,color:T.fg,borderRadius:14,padding:"14px",fontSize:15,fontWeight:700,border:`1.5px solid ${T.br}`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          📤 Upload Questions
        </button>
      </div>
      {topics.length > 0 && (
        <>
          <SecLbl T={T}>Topics</SecLbl>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {topics.map(t=>(
              <div key={t.n} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:T.sf,borderRadius:13,border:`1.5px solid ${T.br}`}}>
                <span style={{fontSize:14,fontWeight:600,color:T.fg}}>{t.n}</span>
                <Badge bg={BL}>{t.c}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </Pg>
  );
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function UploadSc({ user, tok, go, msg, T, ctx }) {
  const { course } = ctx;
  const [raw, setRaw] = useState(""); const [topic, setTopic] = useState("");
  const [parsed, setParsed] = useState([]); const [prev, setPrev] = useState(false);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(null);

  const preview = () => {
    if(!raw.trim()) return msg("Paste questions first","error");
    const qs=parseQs(raw); if(!qs.length) return msg("No valid questions found — check the format","error");
    setParsed(qs); setPrev(true);
  };

  const upload = async () => {
    setBusy(true);
    try {
      const ex = await db(`questions?course_id=eq.${course.id}&select=question`,{},tok)||[];
      const exSet = new Set(ex.map(q=>q.question.toLowerCase().trim()));
      const ins = parsed.filter(q=>!exSet.has(q.question.toLowerCase().trim())).map(q=>({...q,course_id:course.id,topic:topic.trim()||"General",uploaded_by:user.id}));
      const dupes = parsed.length - ins.length;
      if(!ins.length){ msg(`All ${dupes} questions already exist in this course`,"error"); setBusy(false); return; }
      for(let i=0;i<ins.length;i+=50) await db("questions",{method:"POST",body:JSON.stringify(ins.slice(i,i+50))},tok);
      setDone({inserted:ins.length,dupes});
      setPrev(false); setRaw(""); setParsed([]);
    } catch(e){ msg(e.message,"error"); }
    setBusy(false);
  };

  if(done) return (
    <Pg style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <div className="pop" style={{textAlign:"center"}}>
        <div style={{width:76,height:76,background:"#dcfce7",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:36}}>✅</div>
        <h2 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:8}}>Upload Complete!</h2>
        <p style={{color:T.mu,fontSize:15,marginBottom:6}}>{done.inserted} questions added to {course.code}</p>
        {done.dupes>0&&<p style={{color:"#d97706",fontSize:13}}>{done.dupes} duplicates skipped</p>}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:24}}>
          <button onClick={()=>setDone(null)} style={{background:BL,color:"#fff",borderRadius:14,padding:"14px",fontWeight:800,fontSize:15}}>Upload More</button>
          <button onClick={()=>go("cdetail",{course})} style={{background:T.sf,color:T.fg,borderRadius:14,padding:"13px",fontWeight:700,fontSize:14,border:`1.5px solid ${T.br}`}}>Back to Course</button>
        </div>
      </div>
    </Pg>
  );

  return (
    <Pg>
      <BkBtn onClick={()=>go("cdetail",{course})} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:4}}>Upload Questions</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:20}}>{course.code} — {course.title}</p>
      <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:14,padding:16,marginBottom:20}}>
        <p style={{fontSize:13,fontWeight:800,color:"#92400e",marginBottom:8}}>Required Format</p>
        <pre style={{fontSize:12,color:"#78350f",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"JetBrains Mono,monospace"}}>
{`1. Question text here?
A. Option one
B. Option two
C. Option three
D. Option four
Answer: B

2. Next question...`}
        </pre>
        <p style={{fontSize:11,color:"#92400e",marginTop:8,fontWeight:600}}>Duplicate questions are automatically detected and skipped.</p>
      </div>
      {!prev ? (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Inp label="Topic / Chapter (optional)" value={topic} onChange={setTopic} placeholder="e.g. Wave Motion"/>
          <div>
            <Lbl>Paste Questions</Lbl>
            <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste your questions here..."
              style={{width:"100%",minHeight:220,border:`1.5px solid ${T.br}`,borderRadius:13,padding:"14px",fontSize:13,resize:"vertical",background:T.bg,color:T.fg,fontFamily:"JetBrains Mono,monospace",lineHeight:1.8}}/>
          </div>
          <button onClick={preview} style={{background:BL,color:"#fff",borderRadius:14,padding:"15px",fontWeight:800,fontSize:15}}>Preview Questions</button>
        </div>
      ) : (
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{fontSize:20,fontWeight:900,color:T.fg}}>{parsed.length} questions ready</h3>
            <button onClick={()=>setPrev(false)} style={{color:T.mu,fontSize:13,fontWeight:700}}>Edit</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:360,overflowY:"auto",marginBottom:16}}>
            {parsed.slice(0,5).map((q,i)=>(
              <div key={i} style={{background:T.sf,borderRadius:12,padding:14,border:`1.5px solid ${T.br}`}}>
                <p style={{fontSize:13,fontWeight:700,color:T.fg,marginBottom:8}}>Q{i+1}. {q.question}</p>
                {["A","B","C","D"].map(l=><div key={l} style={{fontSize:12,color:l===q.answer?"#16a34a":T.mu,marginBottom:2,fontWeight:l===q.answer?700:400}}>{l===q.answer?"✓ ":"  "}{l}. {q[l]}</div>)}
              </div>
            ))}
            {parsed.length>5&&<p style={{textAlign:"center",color:T.mu,fontSize:13}}>+{parsed.length-5} more</p>}
          </div>
          <button onClick={upload} disabled={busy} style={{background:BL,color:"#fff",borderRadius:14,padding:"15px",fontWeight:800,fontSize:15,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:busy?.65:1}}>
            {busy?<><Sp c="#fff"/>Uploading...</>:`Upload All ${parsed.length} Questions`}
          </button>
        </div>
      )}
    </Pg>
  );
}

// ─── SUBMIT QUESTIONS (for non-uploaders) ────────────────────────────────────
function SubmitQSc({ go, T }) {
  const waMsg = encodeURIComponent("Hi! I'd like to submit questions for MindDrill. Please add them to the question bank.");
  const waLink = `https://wa.me/${WHATSAPP}?text=${waMsg}`;
  return (
    <Pg>
      <BkBtn onClick={()=>go("home")} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:8}}>Submit Questions</h1>
      <p style={{color:T.mu,fontSize:14,marginBottom:24,lineHeight:1.6}}>Don't know how to upload questions yourself? No problem — send them to us and we'll add them to the question bank for you.</p>

      <div style={{background:BLT,borderRadius:16,padding:20,marginBottom:20,border:`1.5px solid ${BLB}`}}>
        <p style={{fontWeight:800,color:BL,fontSize:15,marginBottom:12}}>📋 What to send us</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {["The course code and title (e.g. PHY102 — General Physics II)","The topic or chapter the questions cover","Your questions in this format:"].map((t,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{color:BL,fontWeight:800,flexShrink:0}}>{i+1}.</span>
              <span style={{fontSize:14,color:"#1e40af"}}>{t}</span>
            </div>
          ))}
        </div>
        <pre style={{fontSize:12,color:"#1e3a8a",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"JetBrains Mono,monospace",marginTop:12,background:"#dbeafe",borderRadius:10,padding:12}}>
{`1. Question text?
A. Option one
B. Option two
C. Option three
D. Option four
Answer: B`}
        </pre>
      </div>

      <a href={waLink} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,background:"#16a34a",color:"#fff",borderRadius:14,padding:"17px",fontSize:16,fontWeight:800,textDecoration:"none",marginBottom:14}}>
        <span style={{fontSize:22}}>💬</span> Send via WhatsApp
      </a>

      <div style={{background:T.sf,borderRadius:14,padding:"14px 16px",border:`1.5px solid ${T.br}`,textAlign:"center"}}>
        <p style={{color:T.mu,fontSize:13}}>Your questions will be reviewed and added to the bank within 24-48 hours.</p>
      </div>
    </Pg>
  );
}

// ─── HELP ─────────────────────────────────────────────────────────────────────
function HelpSc({ go, T }) {
  const waLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hi! I need help with MindDrill.")}`;
  const faqs = [
    { q: "How do I upload questions?", a: "Go to any course, tap 'Upload Questions', paste your questions in the required format, preview them, and tap upload. Duplicates are automatically skipped." },
    { q: "What is the question format?", a: "Each question needs a number, text, options A-D, and an Answer line. Example: 1. Question? A. Option B. Option C. Option D. Option Answer: A" },
    { q: "How does AI select my questions?", a: "Before each session, Gemini AI picks questions from the pool, varying the selection each time so you don't always get the same questions." },
    { q: "What are the three modes?", a: "Test Mode: answer blind, grade at end. Study Mode: see correct answer immediately with AI explanation. Practice Mode: wrong answers repeat until mastered." },
    { q: "Why is my streak showing 0?", a: "Streaks reset if you miss a day. Complete at least one session per day to maintain your streak." },
    { q: "Can I use MindDrill for any course?", a: "Yes. Anyone can create a course and upload questions. All courses and questions are shared across all users." },
    { q: "How do I reset my password?", a: "On the sign in screen, tap 'Forgot password?' and enter your email. You'll receive a reset link." },
  ];
  const [open, setOpen] = useState(null);
  return (
    <Pg>
      <BkBtn onClick={()=>go("home")} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:4}}>Help & Support</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:24}}>Answers to common questions and how to reach us.</p>

      <SecLbl T={T}>Frequently Asked Questions</SecLbl>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:28}}>
        {faqs.map((f,i)=>(
          <div key={i} style={{border:`1.5px solid ${T.br}`,borderRadius:14,overflow:"hidden"}}>
            <button onClick={()=>setOpen(open===i?null:i)} style={{width:"100%",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,textAlign:"left"}}>
              <span style={{fontSize:14,fontWeight:700,color:T.fg,flex:1,paddingRight:10}}>{f.q}</span>
              <span style={{color:T.mu,fontSize:18,flexShrink:0}}>{open===i?"−":"+"}</span>
            </button>
            {open===i&&<div style={{padding:"0 16px 14px",background:T.sf}}>
              <p style={{fontSize:13,color:T.mu,lineHeight:1.7}}>{f.a}</p>
            </div>}
          </div>
        ))}
      </div>

      <SecLbl T={T}>Contact Support</SecLbl>
      <div style={{background:"#f0fdf4",borderRadius:16,padding:20,border:"1.5px solid #bbf7d0",marginBottom:14}}>
        <p style={{fontWeight:700,color:"#15803d",fontSize:14,marginBottom:8}}>💬 WhatsApp Support</p>
        <p style={{color:"#166534",fontSize:13,lineHeight:1.6,marginBottom:14}}>Having trouble? Tap below to message us directly on WhatsApp. We'll help you out.</p>
        <a href={waLink} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"#16a34a",color:"#fff",borderRadius:12,padding:"14px",fontSize:15,fontWeight:800,textDecoration:"none"}}>
          <span style={{fontSize:20}}>💬</span> Chat on WhatsApp
        </a>
      </div>
    </Pg>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminSc({ user, tok, go, msg, T, isAdmin }) {
  const [subs, setSubs] = useState([]); const [loading, setLoading] = useState(true);
  if (!isAdmin) { go("home"); return null; }
  useEffect(()=>{
    db("question_submissions?select=*&order=created_at.desc",{},tok).then(s=>setSubs(s||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const approve = async (sub) => {
    try {
      const courses = await db(`courses?code=eq.${sub.course_code}&select=*`,{},tok)||[];
      let courseId = courses[0]?.id;
      if(!courseId){
        const nc = await db("courses",{method:"POST",body:JSON.stringify({code:sub.course_code,title:sub.course_title||sub.course_code,created_by:user.id})},tok);
        courseId = nc[0]?.id;
      }
      const qs = parseQs(sub.questions_text);
      if(qs.length){
        const ex = await db(`questions?course_id=eq.${courseId}&select=question`,{},tok)||[];
        const exSet = new Set(ex.map(q=>q.question.toLowerCase().trim()));
        const ins = qs.filter(q=>!exSet.has(q.question.toLowerCase().trim())).map(q=>({...q,course_id:courseId,topic:sub.topic||"General",uploaded_by:user.id}));
        if(ins.length) for(let i=0;i<ins.length;i+=50) await db("questions",{method:"POST",body:JSON.stringify(ins.slice(i,i+50))},tok);
      }
      await db(`question_submissions?id=eq.${sub.id}`,{method:"PATCH",body:JSON.stringify({status:"approved"})},tok);
      msg("Approved and uploaded!","success"); setSubs(s=>s.map(x=>x.id===sub.id?{...x,status:"approved"}:x));
    } catch(e){ msg(e.message,"error"); }
  };

  const reject = async (id) => {
    try { await db(`question_submissions?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({status:"rejected"})},tok); setSubs(s=>s.map(x=>x.id===id?{...x,status:"rejected"}:x)); }
    catch(e){ msg(e.message,"error"); }
  };

  return (
    <Pg>
      <BkBtn onClick={()=>go("home")} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:4}}>🛡️ Admin Panel</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:20}}>Question submissions from users</p>
      {loading?<Sk h={80}/>:!subs.length?(
        <p style={{textAlign:"center",color:T.mu,padding:"40px 0"}}>No submissions yet.</p>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {subs.map(s=>(
            <div key={s.id} style={{border:`1.5px solid ${T.br}`,borderRadius:14,overflow:"hidden"}}>
              <div style={{padding:"14px 16px",background:T.sf}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontWeight:800,fontSize:14,color:T.fg}}>{s.course_code}</span>
                  <span style={{fontSize:12,fontWeight:700,color:s.status==="approved"?"#16a34a":s.status==="rejected"?"#dc2626":T.mu,background:s.status==="approved"?"#dcfce7":s.status==="rejected"?"#fee2e2":T.sf,borderRadius:8,padding:"3px 10px"}}>
                    {s.status||"pending"}
                  </span>
                </div>
                <p style={{fontSize:12,color:T.mu}}>{s.topic||"General"} · {new Date(s.created_at).toLocaleDateString()}</p>
                <p style={{fontSize:12,color:T.mu,marginTop:4,fontFamily:"JetBrains Mono,monospace",maxHeight:80,overflow:"hidden"}}>{s.questions_text?.slice(0,200)}...</p>
              </div>
              {(!s.status||s.status==="pending")&&(
                <div style={{display:"flex",gap:8,padding:"10px 14px",background:T.bg}}>
                  <button onClick={()=>approve(s)} style={{flex:1,background:"#dcfce7",color:"#15803d",borderRadius:10,padding:"9px",fontWeight:700,fontSize:13}}>✓ Approve</button>
                  <button onClick={()=>reject(s.id)} style={{flex:1,background:"#fee2e2",color:"#dc2626",borderRadius:10,padding:"9px",fontWeight:700,fontSize:13}}>✗ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Pg>
  );
}

// ─── MODE SELECT ──────────────────────────────────────────────────────────────
function ModeSc({ go, T, ctx }) {
  const { course } = ctx;
  const modes = [
    { id:"test",     e:"🧪", title:"Test Mode",     desc:"Answer all questions without feedback. Full grade and review at the end.", bg:"#dbeafe" },
    { id:"study",    e:"📖", title:"Study Mode",    desc:"See correct answer immediately. AI explains every wrong answer on the spot.", bg:"#dcfce7" },
    { id:"practice", e:"🏋️", title:"Practice Mode", desc:"Wrong answers repeat until you get them right. Build real mastery.", bg:"#f3e8ff" },
  ];
  return (
    <Pg>
      <BkBtn onClick={()=>go("cdetail",{course})} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:4}}>Choose Mode</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:24}}>{course.code} — {course.title}</p>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {modes.map(m=>(
          <button key={m.id} onClick={()=>go("setup",{course,mode:m.id})} style={{background:T.bg,border:`1.5px solid ${T.br}`,borderRadius:20,padding:"20px 18px",textAlign:"left",cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
              <div style={{width:50,height:50,background:m.bg,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{m.e}</div>
              <div style={{fontSize:19,fontWeight:800,color:T.fg}}>{m.title}</div>
            </div>
            <p style={{fontSize:14,color:T.mu,lineHeight:1.6}}>{m.desc}</p>
          </button>
        ))}
      </div>
    </Pg>
  );
}

// ─── TEST SETUP ───────────────────────────────────────────────────────────────
function SetupSc({ user, tok, go, msg, T, ctx }) {
  const { course, mode } = ctx;
  const [topics, setTopics] = useState([]); const [selT, setSelT] = useState([]);
  const [numQ, setNumQ] = useState("20"); const [timed, setTimed] = useState(false);
  const [hrs, setHrs] = useState("0"); const [mins, setMins] = useState("30");
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true);

  useEffect(()=>{
    db(`questions?course_id=eq.${course.id}&select=topic`,{},tok).then(qs=>{
      if(!qs?.length){ msg("No questions uploaded for this course yet","error"); go("cdetail",{course}); return; }
      setTotal(qs.length);
      const m={}; qs.forEach(q=>{const t=q.topic||"General";m[t]=(m[t]||0)+1;});
      const t=Object.entries(m).map(([n,c])=>({n,c}));
      setTopics(t); setSelT(t.map(x=>x.n));
    }).catch(e=>msg(e.message,"error")).finally(()=>setLoading(false));
  },[]);

  const start = () => {
    if(!selT.length) return msg("Select at least one topic","error");
    const n=parseInt(numQ); if(!n||n<1) return msg("Enter a valid number","error");
    if(n>total) return msg(`Only ${total} questions available`,"error");
    const totalSecs=(parseInt(hrs)||0)*3600+(parseInt(mins)||0)*60;
    go("session",{course,mode,selT,numQ:n,timed,totalSecs});
  };

  const ml = mode==="test"?"🧪 Test":mode==="study"?"📖 Study":"🏋️ Practice";
  const dur = `${String(parseInt(hrs)||0).padStart(2,"0")}:${String(parseInt(mins)||0).padStart(2,"0")}:00`;

  return (
    <Pg>
      <BkBtn onClick={()=>go("mode",{course})} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:4}}>{ml} Setup</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:24}}>{course.code} · {total} questions available</p>
      {loading?<div style={{display:"flex",flexDirection:"column",gap:10}}><Sk h={50}/><Sk h={80}/><Sk h={50}/></div>:(
        <div style={{display:"flex",flexDirection:"column",gap:22}}>
          <div>
            <Lbl>Select Topics</Lbl>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              <Chip active={selT.length===topics.length} onClick={()=>setSelT(topics.map(t=>t.n))}>All</Chip>
              {topics.map(t=><Chip key={t.n} active={selT.includes(t.n)} onClick={()=>setSelT(p=>p.includes(t.n)?p.filter(x=>x!==t.n):[...p,t.n])}>{t.n} ({t.c})</Chip>)}
            </div>
          </div>
          <div>
            <Lbl>Number of Questions</Lbl>
            <input type="number" value={numQ} onChange={e=>setNumQ(e.target.value)} min="1" max={total}
              style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:13,padding:"14px 16px",fontSize:20,fontWeight:900,background:T.bg,color:T.fg}}/>
          </div>
          {mode==="test"&&(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:T.fg}}>Enable Timer</div>
                  <div style={{fontSize:12,color:T.mu,marginTop:2}}>Countdown during test</div>
                </div>
                <Tog on={timed} set={setTimed}/>
              </div>
              {timed&&(
                <div style={{background:T.sf,borderRadius:14,padding:16,border:`1.5px solid ${T.br}`}}>
                  <Lbl>Duration</Lbl>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <p style={{fontSize:12,color:T.mu,marginBottom:6,fontWeight:600}}>Hours (0–3)</p>
                      <input type="number" value={hrs} onChange={e=>setHrs(e.target.value)} min="0" max="3"
                        style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:11,padding:"12px",fontSize:18,fontWeight:800,background:T.bg,color:T.fg,textAlign:"center"}}/>
                    </div>
                    <div>
                      <p style={{fontSize:12,color:T.mu,marginBottom:6,fontWeight:600}}>Minutes (0–59)</p>
                      <input type="number" value={mins} onChange={e=>setMins(e.target.value)} min="0" max="59"
                        style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:11,padding:"12px",fontSize:18,fontWeight:800,background:T.bg,color:T.fg,textAlign:"center"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"center",marginTop:10,fontSize:20,fontWeight:900,color:BL,fontFamily:"JetBrains Mono,monospace"}}>{dur}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={start} style={{background:BL,color:"#fff",borderRadius:16,padding:"16px",fontWeight:900,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:`0 4px 14px ${BL}44`}}>
            {ml} — Begin Drill →
          </button>
        </div>
      )}
    </Pg>
  );
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
function SessionSc({ user, tok, go, msg, T, ctx }) {
  const { course, mode, selT, numQ, timed, totalSecs } = ctx;
  const [questions, setQs] = useState([]);
  const [cur, setCur] = useState(0); const [answers, setAnswers] = useState({});
  const [sel, setSel] = useState(null); const [revealed, setRevealed] = useState(false);
  const [aiExp, setAiExp] = useState(""); const [loadExp, setLoadExp] = useState(false);
  const [flags, setFlags] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(null); const [loading, setLoading] = useState(true);
  const [aiNote, setAiNote] = useState("Loading your questions...");
  const [pQ, setPQ] = useState([]); const [pI, setPI] = useState(0); const [mastered, setMastered] = useState(0);
  const tmr = useRef(null); const tmrOn = useRef(false);
  const elapsed = useRef(0); const elTmr = useRef(null);

  useEffect(()=>{ load(); return ()=>{ clearTimeout(tmr.current); clearInterval(elTmr.current); }; },[]);

  useEffect(()=>{
    if(timed&&mode==="test"&&timeLeft===null&&questions.length>0&&!tmrOn.current){ tmrOn.current=true; setTimeLeft(totalSecs||1800); }
  },[questions]);

  useEffect(()=>{
    if(timed&&mode==="test"&&timeLeft!==null){
      if(timeLeft<=0){ go("timesup",{course,mode,questions,answers,totalSecs}); return; }
      tmr.current=setTimeout(()=>setTimeLeft(v=>v-1),1000);
      return()=>clearTimeout(tmr.current);
    }
  },[timeLeft,timed,mode,answers]);

  useEffect(()=>{ elTmr.current=setInterval(()=>{elapsed.current+=1;},1000); return()=>clearInterval(elTmr.current); },[]);

  const load = async () => {
    setLoading(true);
    try {
      const filter=selT.map(t=>`topic.eq.${encodeURIComponent(t)}`).join(",");
      const all=await db(`questions?course_id=eq.${course.id}&or=(${filter})&select=*`,{},tok)||[];
      if(!all.length){ msg("No questions found for selected topics","error"); go("setup",{course,mode}); return; }
      setAiNote("AI is picking your questions...");
      let recentIds=[];
      try{ const rec=await db(`sessions?user_id=eq.${user.id}&course_id=eq.${course.id}&order=created_at.desc&limit=3&select=question_ids`,{},tok)||[]; recentIds=rec.flatMap(s=>s.question_ids||[]); }catch{}
      let picked=[];
      try{
        const pool=all.map((q,i)=>`${i}:${q.id}`).join(",");
        const rStr=recentIds.slice(-15).join(",");
        const prompt=`Select ${Math.min(numQ,all.length)} question indices from pool of ${all.length}.\nPool: ${pool}\nRecently seen (vary away): ${rStr}\nReturn ONLY comma-separated indices. Exactly ${Math.min(numQ,all.length)} unique indices.`;
        const res=await aiCall(prompt);
        const indices=[...new Set((res.match(/\d+/g)||[]).map(Number).filter(n=>n>=0&&n<all.length))];
        picked=indices.slice(0,numQ).map(i=>all[i]);
        if(picked.length<Math.min(numQ,all.length)){
          const used=new Set(indices.slice(0,numQ));
          const extra=all.filter((_,i)=>!used.has(i)).sort(()=>Math.random()-.5);
          picked=[...picked,...extra.slice(0,Math.min(numQ,all.length)-picked.length)];
        }
      }catch{ picked=all.sort(()=>Math.random()-.5).slice(0,Math.min(numQ,all.length)); }
      setQs(picked);
      if(mode==="practice") setPQ([...picked]);
    }catch(e){ msg("Load error: "+e.message,"error"); }
    setLoading(false);
  };

  const curQ = mode==="practice"?pQ[pI]:questions[cur];

  const pick = async (letter) => {
    if(revealed) return;
    setSel(letter);
    if(mode==="study"||mode==="practice"){
      setRevealed(true);
      if(letter!==curQ.answer){
        setLoadExp(true);
        const e=await aiCall(`Explain in 4 clear sentences why the correct answer is ${curQ.answer}.\nQ: ${curQ.question}\nA.${curQ.A} B.${curQ.B} C.${curQ.C} D.${curQ.D}\nCorrect: ${curQ.answer}. ${curQ[curQ.answer]}`);
        setAiExp(e); setLoadExp(false);
      }
    }
  };

  const advance = () => {
    if(mode==="practice"){
      const ok=sel===curQ.answer;
      if(ok){ setMastered(m=>m+1); const nq=[...pQ];nq.splice(pI,1); if(!nq.length){clearInterval(elTmr.current);go("results",{course,mode,questions,answers:{},score:questions.length,total:questions.length,masteredAll:true,elapsed:elapsed.current});return;} setPQ(nq);if(pI>=nq.length)setPI(0); }
      else{ const nq=[...pQ];const q=nq.splice(pI,1)[0];nq.push(q);setPQ(nq);if(pI>=nq.length)setPI(0); }
      setSel(null);setRevealed(false);setAiExp("");
    } else if(mode==="study"){
      const na={...answers,[cur]:sel};setAnswers(na);
      setSel(null);setRevealed(false);setAiExp("");
      if(cur+1>=questions.length){clearInterval(elTmr.current);finish(na);}else setCur(c=>c+1);
    }
  };

  const goQ=(i)=>{ if(sel&&answers[cur]===undefined)setAnswers(a=>({...a,[cur]:sel})); setCur(i);setSel(answers[i]||null);setRevealed(false);setAiExp(""); };
  const nextQ=()=>{ const ans=sel||answers[cur]; if(!ans)return msg("Select an answer first","error"); const na={...answers,[cur]:ans};setAnswers(na); if(cur+1>=questions.length){clearInterval(elTmr.current);finish(na);return;} setCur(c=>c+1);setSel(answers[cur+1]||null); };
  const prevQ=()=>{ if(cur===0)return; const ans=sel||answers[cur];if(ans)setAnswers(a=>({...a,[cur]:ans})); setCur(c=>c-1);setSel(answers[cur-1]||null); };
  const finish=(fa)=>{ clearTimeout(tmr.current);clearInterval(elTmr.current); const score=questions.filter((q,i)=>fa[i]===q.answer).length; go("results",{course,mode,questions,answers:fa,score,total:questions.length,timeLeft,timed,totalSecs,flags:[...flags],elapsed:elapsed.current}); };

  const fmtT=(s)=>{ const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`; };

  if(loading) return <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}><Sp sz={48} c={BL}/><p style={{color:T.mu,fontSize:15,fontWeight:600}}>{aiNote}</p></div>;
  if(!curQ) return null;

  const prog = mode==="practice"?(mastered/Math.max(questions.length,1))*100:(cur/Math.max(questions.length,1))*100;
  const qLbl = mode==="practice"?`${mastered}/${questions.length} mastered`:`${cur+1}/${questions.length}`;

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",maxWidth:520,margin:"0 auto"}}>
      {/* Top bar */}
      <div style={{padding:"16px 18px 0",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:800,color:T.mu}}>{qLbl}</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {timed&&mode==="test"&&timeLeft!==null&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:timeLeft<60?"#fee2e2":BLT,borderRadius:10,padding:"5px 11px"}}>
                <span style={{fontSize:13}}>⏱</span>
                <span style={{fontSize:15,fontWeight:900,fontFamily:"JetBrains Mono,monospace",color:timeLeft<60?"#dc2626":BL,animation:timeLeft<30?"pulse 1s infinite":"none"}}>{fmtT(timeLeft)}</span>
              </div>
            )}
            {mode==="test"&&(
              <button onClick={()=>setFlags(f=>{const n=new Set(f);n.has(cur)?n.delete(cur):n.add(cur);return n;})}
                style={{display:"flex",alignItems:"center",gap:5,background:flags.has(cur)?"#fee2e2":T.sf,border:`1.5px solid ${flags.has(cur)?"#dc2626":T.br}`,borderRadius:10,padding:"5px 11px",color:flags.has(cur)?"#dc2626":T.mu}}>
                <span style={{fontSize:14}}>🚩</span>
                <span style={{fontSize:12,fontWeight:700}}>{flags.has(cur)?"Flagged":"Flag"}</span>
              </button>
            )}
            <button onClick={()=>{clearTimeout(tmr.current);clearInterval(elTmr.current);go("cdetail",{course});}} style={{fontSize:13,color:T.mu,fontWeight:600}}>Quit</button>
          </div>
        </div>
        <div style={{height:5,background:T.sf,borderRadius:3}}>
          <div style={{height:"100%",background:BL,borderRadius:3,width:`${prog}%`,transition:"width .35s ease"}}/>
        </div>
      </div>

      {/* Question */}
      <div className="sq" key={`${cur}-${pI}`} style={{flex:1,padding:"14px 18px",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <span style={{background:mode==="test"?BLT:mode==="study"?"#dcfce7":"#f3e8ff",color:mode==="test"?BL:mode==="study"?"#16a34a":"#9333ea",borderRadius:8,padding:"4px 11px",fontSize:11,fontWeight:800,letterSpacing:".06em"}}>
            {mode.toUpperCase()}
          </span>
          {mode==="test"&&<span style={{fontSize:12,color:T.mu,fontWeight:600}}>{Object.keys(answers).length}/{questions.length} answered</span>}
        </div>

        <div style={{background:"#0f172a",borderRadius:18,padding:"20px 18px",marginBottom:16,...DOT(true)}}>
          <p style={{fontSize:15,lineHeight:1.75,fontWeight:600,color:"#fff"}}>{curQ.question}</p>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {["A","B","C","D"].map(l=>{
            let bg=T.bg,bdr=T.br,col=T.fg,fw=500;
            if(revealed){ if(l===curQ.answer){bg="#dcfce7";bdr="#16a34a";col="#16a34a";fw=700;} else if(l===sel){bg="#fee2e2";bdr="#dc2626";col="#dc2626";fw=700;} }
            else if(sel===l){bg=BL;bdr=BL;col="#fff";fw=700;}
            return (
              <button key={l} onClick={()=>pick(l)} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",border:`2px solid ${bdr}`,borderRadius:14,background:bg,color:col,cursor:revealed?"default":"pointer",transition:"all .12s",textAlign:"left"}}>
                <span style={{width:32,height:32,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:revealed?"rgba(0,0,0,.06)":(sel===l?"rgba(255,255,255,.2)":T.sf),fontSize:13,fontWeight:900}}>{l}</span>
                <span style={{fontSize:14,lineHeight:1.5,fontWeight:fw,flex:1}}>{curQ[l]}</span>
                {revealed&&l===curQ.answer&&<span style={{flexShrink:0,fontSize:16}}>✓</span>}
                {revealed&&l===sel&&l!==curQ.answer&&<span style={{flexShrink:0,fontSize:16}}>✗</span>}
              </button>
            );
          })}
        </div>

        {revealed&&sel!==curQ.answer&&(
          <div style={{marginTop:12,background:BLT,border:`1.5px solid ${BLB}`,borderRadius:14,padding:14}}>
            {loadExp?<div style={{display:"flex",alignItems:"center",gap:10}}><Sp sz={16} c={BL}/><span style={{fontSize:13,color:BL,fontWeight:600}}>AI is explaining...</span></div>
            :aiExp?<div style={{display:"flex",gap:10}}><span style={{flexShrink:0}}>🤖</span><p style={{fontSize:13,color:"#1e3a8a",lineHeight:1.8}}>{aiExp}</p></div>:null}
          </div>
        )}
        {revealed&&sel===curQ.answer&&<div style={{marginTop:12,background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,padding:12,display:"flex",alignItems:"center",gap:8}}><span>✅</span><p style={{fontSize:14,color:"#16a34a",fontWeight:700}}>Correct!</p></div>}

        {/* Navigator */}
        {mode==="test"&&questions.length>1&&(
          <div style={{marginTop:20}}>
            <SecLbl T={T}>Question Navigator</SecLbl>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {questions.map((_,i)=>{
                const done=answers[i]!==undefined,isCur=i===cur,fl=flags.has(i);
                return(
                  <button key={i} onClick={()=>goQ(i)} style={{width:36,height:36,borderRadius:8,fontSize:12,fontWeight:800,border:`2px solid ${isCur?BL:done?"#16a34a":T.br}`,background:isCur?BL:done?"#dcfce7":T.sf,color:isCur?"#fff":done?"#16a34a":T.mu,position:"relative"}}>
                    {i+1}
                    {fl&&<div style={{position:"absolute",top:-4,right:-4,width:9,height:9,background:"#dc2626",borderRadius:"50%",border:"2px solid #fff"}}/>}
                  </button>
                );
              })}
            </div>
            <p style={{fontSize:12,color:T.mu,marginTop:8}}>{Object.keys(answers).length} answered · {questions.length-Object.keys(answers).length} remaining · {flags.size} flagged</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{padding:"12px 18px 32px",borderTop:`1px solid ${T.br}`,flexShrink:0}}>
        {mode==="test"?(
          <div style={{display:"flex",gap:10}}>
            {cur>0&&<button onClick={prevQ} style={{flex:1,background:T.sf,color:T.fg,borderRadius:13,padding:"13px",fontWeight:700,fontSize:14,border:`1.5px solid ${T.br}`}}>← Prev</button>}
            <button onClick={nextQ} style={{flex:2,background:BL,color:"#fff",borderRadius:13,padding:"13px",fontWeight:800,fontSize:15}}>
              {cur+1===questions.length?"Finish ✓":"Next →"}
            </button>
          </div>
        ):revealed?(
          <button onClick={advance} style={{width:"100%",background:BL,color:"#fff",borderRadius:14,padding:"15px",fontWeight:800,fontSize:15}}>
            {mode==="practice"&&sel===curQ.answer?"Got it ✓ — Next":mode==="practice"?"Retry later — Next →":"Next →"}
          </button>
        ):null}
      </div>
    </div>
  );
}

// ─── TIMES UP ─────────────────────────────────────────────────────────────────
function TimesUpSc({ go, T, ctx }) {
  const { course, mode, questions, answers, totalSecs } = ctx;
  useEffect(()=>{ setTimeout(()=>{ const score=questions.filter((q,i)=>answers[i]===q.answer).length; go("results",{course,mode,questions,answers,score,total:questions.length,timed:true,totalSecs,timeLeft:0,flags:[],elapsed:totalSecs}); },2800); },[]);
  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,...DOT(true)}}>
      <div className="pop" style={{textAlign:"center"}}>
        <div style={{fontSize:80,marginBottom:12}}>⏱</div>
        <h2 style={{fontSize:36,fontWeight:900,color:"#fff",letterSpacing:"-.04em"}}>Time's Up!</h2>
        <p style={{color:"rgba(255,255,255,.45)",fontSize:15,marginTop:8}}>Calculating your results...</p>
        <div style={{marginTop:24}}><Sp sz={36} c={BL}/></div>
      </div>
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsSc({ user, tok, go, T, ctx }) {
  const { course, mode, questions, answers, score, total, timeLeft, timed, totalSecs, flags, masteredAll, elapsed } = ctx;
  const pct = Math.round((score/total)*100);
  const { g, c } = gradeOf(pct);
  const [conf, setConf] = useState([]);
  const saved = useRef(false);

  useEffect(()=>{ if(pct>=80)spawnConf(); save(); },[]);

  const spawnConf=()=>{ const p=Array.from({length:50},(_,i)=>({id:i,x:Math.random()*100,col:[BL,"#22c55e","#f59e0b","#e879f9","#38bdf8"][i%5],del:Math.random()*1.5,dur:2+Math.random()*2,sz:6+Math.random()*10})); setConf(p); setTimeout(()=>setConf([]),6000); };

  const save = async () => {
    if(saved.current||mode==="practice") return; saved.current=true;
    try {
      const tt=timed?(totalSecs-(timeLeft||0)):(elapsed||0);
      await db("sessions",{method:"POST",body:JSON.stringify({user_id:user.id,course_id:course.id,course_code:course.code,score,total,percentage:pct,grade:g,mode,time_taken:tt,answers:JSON.stringify(answers),question_ids:questions.map(q=>q.id)})},tok);
    }catch(e){ console.error("Session save failed:",e); }
  };

  const wrong=questions.filter((q,i)=>answers[i]!==q.answer).length;
  const tt=timed?(totalSecs-(timeLeft||0)):(elapsed||0);
  const fmtT=(s)=>{ if(!s)return"—";const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?`${h}h ${m}m ${sec}s`:m>0?`${m}m ${sec}s`:`${sec}s`; };

  return (
    <Pg>
      {conf.map(p=><div key={p.id} style={{position:"fixed",left:`${p.x}%`,top:-10,width:p.sz,height:p.sz,background:p.col,borderRadius:3,zIndex:9998,animation:`fall ${p.dur}s ${p.del}s linear forwards`}}/>)}
      <div className="pop" style={{textAlign:"center",paddingTop:16,marginBottom:28}}>
        <div style={{fontSize:72,marginBottom:8}}>{masteredAll?"🏆":pct>=80?"🎉":pct>=60?"💪":"📚"}</div>
        {masteredAll?(
          <h2 style={{fontSize:34,fontWeight:900,color:"#16a34a"}}>All Mastered!</h2>
        ):(
          <>
            <div style={{fontSize:80,fontWeight:900,letterSpacing:"-.05em",color:c,lineHeight:1}}>{pct}%</div>
            <div style={{fontSize:40,fontWeight:900,color:c,marginBottom:6}}>{g}</div>
            <p style={{color:T.mu,fontSize:15,fontWeight:600}}>{score} correct out of {total}</p>
          </>
        )}
      </div>
      {!masteredAll&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:24}}>
          {[{l:"Correct",v:score,col:"#16a34a"},{l:"Wrong",v:wrong,col:"#dc2626"},{l:"Time",v:fmtT(tt),col:BL},{l:"Flagged",v:(flags||[]).length,col:"#d97706"}].map(s=>(
            <div key={s.l} style={{background:T.sf,borderRadius:13,padding:"12px 8px",textAlign:"center",border:`1.5px solid ${T.br}`}}>
              <div style={{fontSize:18,fontWeight:900,color:s.col}}>{s.v}</div>
              <div style={{fontSize:10,color:T.mu,marginTop:2,fontWeight:700}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {!masteredAll&&mode==="test"&&<button onClick={()=>go("review",ctx)} style={{background:BL,color:"#fff",borderRadius:14,padding:"15px",fontWeight:800,fontSize:15}}>📋 Review Answers</button>}
        <button onClick={()=>go("mode",{course})} style={{background:T.sf,color:T.fg,borderRadius:14,padding:"14px",fontWeight:700,fontSize:14,border:`1.5px solid ${T.br}`}}>🔄 Try Again</button>
        <button onClick={()=>go("home")} style={{background:"transparent",color:T.mu,borderRadius:14,padding:"12px",fontWeight:600,fontSize:14}}>🏠 Home</button>
      </div>
    </Pg>
  );
}

// ─── REVIEW ───────────────────────────────────────────────────────────────────
function ReviewSc({ go, T, ctx }) {
  const { course, questions, answers, score, total, flags } = ctx;
  const [filter, setFilter] = useState("all"); const [exps, setExps] = useState({}); const [loadEx, setLoadEx] = useState({});
  const fSet = new Set(flags||[]);

  const explain = async (i) => {
    if(exps[i])return; setLoadEx(p=>({...p,[i]:true}));
    const q=questions[i];
    const e=await aiCall(`Explain why the correct answer is ${q.answer} in 4-5 clear sentences.\nQ: ${q.question}\nA.${q.A} B.${q.B} C.${q.C} D.${q.D}\nCorrect: ${q.answer}. ${q[q.answer]}\nStudent chose: ${answers[i]}. ${q[answers[i]]}`);
    setExps(p=>({...p,[i]:e})); setLoadEx(p=>({...p,[i]:false}));
  };

  const filt = questions.map((q,i)=>({q,i})).filter(({q,i})=>{
    if(filter==="wrong") return answers[i]!==q.answer;
    if(filter==="correct") return answers[i]===q.answer;
    if(filter==="flagged") return fSet.has(i);
    return true;
  });

  return (
    <Pg>
      <BkBtn onClick={()=>go("results",ctx)} T={T}/>
      <h1 style={{fontSize:26,fontWeight:900,color:T.fg,marginBottom:4}}>Review</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:20}}>{score}/{total} correct</p>
      <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>
        {[["all","All"],["wrong","Wrong"],["correct","Correct"],["flagged","Flagged 🚩"]].map(([v,l])=>(
          <Chip key={v} active={filter===v} onClick={()=>setFilter(v)}>{l}</Chip>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {filt.map(({q,i})=>{
          const ok=answers[i]===q.answer;
          return(
            <div key={i} style={{border:`1.5px solid ${ok?"#16a34a":"#dc2626"}44`,borderRadius:16,overflow:"hidden"}}>
              <div style={{padding:"15px",background:ok?"#f0fdf4":"#fff5f5"}}>
                <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"flex-start"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:ok?"#dcfce7":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13}}>{ok?"✓":"✗"}</div>
                  <p style={{fontSize:14,fontWeight:700,color:"#0f172a",lineHeight:1.6,flex:1}}>Q{i+1}. {q.question}</p>
                  {fSet.has(i)&&<span style={{flexShrink:0}}>🚩</span>}
                </div>
                {["A","B","C","D"].map(l=>(
                  <div key={l} style={{fontSize:13,padding:"6px 10px",borderRadius:8,marginBottom:4,background:l===q.answer?"#dcfce7":l===answers[i]&&!ok?"#fee2e2":"transparent",color:l===q.answer?"#16a34a":l===answers[i]&&!ok?"#dc2626":"#64748b",fontWeight:l===q.answer||l===answers[i]?700:400}}>
                    {l===q.answer?"✓ ":l===answers[i]&&!ok?"✗ ":"   "}{l}. {q[l]}
                  </div>
                ))}
              </div>
              {!ok&&(
                <div style={{padding:"12px 15px",borderTop:`1px solid ${T.br}`,background:T.bg}}>
                  {!exps[i]?(
                    <button onClick={()=>explain(i)} style={{display:"flex",alignItems:"center",gap:8,color:BL,fontSize:14,fontWeight:700}}>
                      {loadEx[i]?<><Sp sz={16} c={BL}/>Getting explanation...</>:<>🤖 Get AI Explanation</>}
                    </button>
                  ):(
                    <div style={{display:"flex",gap:10}}><span style={{flexShrink:0}}>🤖</span><p style={{fontSize:13,color:T.fg,lineHeight:1.8}}>{exps[i]}</p></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!filt.length&&<p style={{textAlign:"center",color:T.mu,padding:"40px 0"}}>Nothing to show.</p>}
      </div>
    </Pg>
  );
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────
function PerfSc({ user, tok, go, msg, T }) {
  const [sess, setSess] = useState([]); const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false); const [sel, setSel] = useState("all");

  useEffect(()=>{ db(`sessions?user_id=eq.${user.id}&order=created_at.desc`,{},tok).then(s=>setSess(s||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);

  const clear = async () => {
    if(!window.confirm("Clear all session history? Cannot be undone.")) return;
    setClearing(true);
    try{ await db(`sessions?user_id=eq.${user.id}`,{method:"DELETE"},tok); setSess([]); msg("Cleared","success"); }
    catch(e){ msg(e.message,"error"); }
    setClearing(false);
  };

  const codes=["all",...new Set(sess.map(s=>s.course_code).filter(Boolean))];
  const filt=sel==="all"?sess:sess.filter(s=>s.course_code===sel);
  const avg=filt.length?Math.round(filt.reduce((a,s)=>a+(s.percentage||0),0)/filt.length):0;
  const best=filt.length?Math.max(...filt.map(s=>s.percentage||0)):0;
  const chart=[...filt].reverse().slice(-12);
  const mc=(m)=>m==="study"?"#16a34a":m==="practice"?"#9333ea":BL;

  return (
    <Pg>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <h1 style={{fontSize:28,fontWeight:900,color:T.fg}}>Performance</h1>
        {sess.length>0&&<button onClick={clear} disabled={clearing} style={{fontSize:13,color:"#dc2626",fontWeight:700}}>{clearing?"...":"Clear"}</button>}
      </div>
      <p style={{color:T.mu,fontSize:13,marginBottom:20}}>{sess.length} total sessions</p>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:20}}>
        {codes.map(c=><Chip key={c} active={sel===c} onClick={()=>setSel(c)}>{c==="all"?"All":c}</Chip>)}
      </div>

      {loading?<div style={{display:"flex",flexDirection:"column",gap:10}}><Sk h={80}/><Sk h={160}/><Sk h={60}/><Sk h={60}/></div>
      :!sess.length?(
        <div style={{textAlign:"center",paddingTop:60}}>
          <div style={{fontSize:52,marginBottom:14}}>📊</div>
          <p style={{color:T.mu,fontSize:16,fontWeight:700}}>No sessions yet.</p>
          <p style={{color:T.mu,fontSize:13,marginTop:6}}>Take a drill to see your performance here.</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:22}}>
            {[{l:"Sessions",v:filt.length},{l:"Average",v:`${avg}%`},{l:"Best",v:`${best}%`}].map(s=>(
              <div key={s.l} style={{background:"#0f172a",borderRadius:16,padding:"17px 10px",textAlign:"center",...DOT(true)}}>
                <div style={{fontSize:21,fontWeight:900,color:"#fff"}}>{s.v}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:3,fontWeight:700}}>{s.l}</div>
              </div>
            ))}
          </div>

          {chart.length>1&&(
            <div style={{marginBottom:22}}>
              <SecLbl T={T}>Score Trend — last {chart.length} sessions</SecLbl>
              <div style={{background:T.sf,borderRadius:16,padding:"20px 14px 14px",border:`1.5px solid ${T.br}`}}>
                <div style={{display:"flex",gap:14,marginBottom:8}}>
                  {[{l:"Test",c:BL},{l:"Study",c:"#16a34a"},{l:"Practice",c:"#9333ea"}].map(m=>(
                    <div key={m.l} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:m.c}}/>
                      <span style={{fontSize:11,color:T.mu,fontWeight:600}}>{m.l}</span>
                    </div>
                  ))}
                </div>
                <svg width="100%" height="100" viewBox={`0 0 ${Math.max((chart.length-1)*28,28)} 100`} preserveAspectRatio="none">
                  {[0,50,100].map(y=><line key={y} x1="0" y1={100-y} x2="9999" y2={100-y} stroke={T.br} strokeWidth=".5"/>)}
                  <polyline points={chart.map((s,i)=>`${i*28},${100-(s.percentage||0)}`).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3,3"/>
                  {chart.map((s,i)=><circle key={i} cx={i*28} cy={100-(s.percentage||0)} r="5" fill={mc(s.mode)}/>)}
                </svg>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                  <span style={{fontSize:10,color:T.mu}}>Oldest</span>
                  <span style={{fontSize:10,color:T.mu}}>Latest</span>
                </div>
              </div>
            </div>
          )}

          <SecLbl T={T}>All Sessions</SecLbl>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filt.map(s=>{const{g,c}=gradeOf(s.percentage||0);return(
              <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",background:T.sf,borderRadius:14,border:`1.5px solid ${T.br}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:mc(s.mode),flexShrink:0}}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:T.fg}}>{s.course_code}</div>
                    <div style={{fontSize:12,color:T.mu,marginTop:1}}>{new Date(s.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:14,fontWeight:800,color:T.fg}}>{s.score}/{s.total}</span>
                  <Badge bg={c}>{g}</Badge>
                </div>
              </div>
            );})}
          </div>
        </>
      )}
    </Pg>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileSc({ user, tok, go, msg, T, out }) {
  const meta = user?.user_metadata||{};
  const [name,  setName]  = useState(meta.full_name||"");
  const [uname, setUname] = useState(meta.username||"");
  const [uni,   setUni]   = useState(meta.university||"");
  const [prog,  setProg]  = useState(meta.programme||"");
  const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(null);
  const fileRef = useRef();
  const uid    = (user?.id||"--------").slice(0,8).toUpperCase();
  const avatar = meta.avatar_url;

  useEffect(()=>{
    db(`sessions?user_id=eq.${user.id}&order=created_at.desc`,{},tok).then(s=>{
      if(!s?.length){setStats({sessions:0,avg:0,best:0,streak:0,total:0});return;}
      const avg=Math.round(s.reduce((a,x)=>a+(x.percentage||0),0)/s.length);
      const best=Math.max(...s.map(x=>x.percentage||0));
      const total=s.reduce((a,x)=>a+(x.total||0),0);
      let streak=0;const today=new Date();today.setHours(0,0,0,0);
      const days=new Set(s.map(x=>new Date(x.created_at).toDateString()));
      for(let i=0;i<365;i++){const d=new Date(today);d.setDate(d.getDate()-i);if(days.has(d.toDateString()))streak++;else if(i>0)break;}
      setStats({sessions:s.length,avg,best,streak,total});
    }).catch(()=>{});
  },[]);

  const saveProfile = async () => {
    if(!name.trim()) return msg("Name cannot be empty","error");
    setSaving(true);
    try {
      await fetch(`${SB}/auth/v1/user`,{method:"PUT",headers:{apikey:KEY,Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},body:JSON.stringify({data:{...meta,full_name:name.trim(),username:uname.trim().toLowerCase()||meta.username,university:uni,programme:prog}})});
      const updated={...user,user_metadata:{...meta,full_name:name.trim(),username:uname.trim().toLowerCase()||meta.username,university:uni,programme:prog}};
      localStorage.setItem("md_u",JSON.stringify(updated)); msg("Profile saved!","success");
    }catch(e){msg(e.message,"error");}
    setSaving(false);
  };

  const uploadPhoto = async (e) => {
    const file=e.target.files?.[0]; if(!file)return;
    if(file.size>3*1024*1024)return msg("Image must be under 3MB","error");
    setUploading(true);
    try{
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        try{
          const dataUrl=ev.target.result;
          const ext=file.name.split(".").pop()||"jpg";
          const path=`avatars/${user.id}.${ext}`;
          const upRes=await fetch(`${SB}/storage/v1/object/${path}`,{method:"POST",headers:{apikey:KEY,Authorization:`Bearer ${tok}`,"Content-Type":file.type,"x-upsert":"true"},body:file});
          const url=upRes.ok?`${SB}/storage/v1/object/public/${path}?v=${Date.now()}`:dataUrl;
          await fetch(`${SB}/auth/v1/user`,{method:"PUT",headers:{apikey:KEY,Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},body:JSON.stringify({data:{...meta,avatar_url:url}})});
          const updated={...user,user_metadata:{...meta,avatar_url:url}};
          localStorage.setItem("md_u",JSON.stringify(updated));
          msg("Photo updated!","success"); setTimeout(()=>window.location.reload(),800);
        }catch(err){msg("Upload failed: "+err.message,"error");}
        setUploading(false);
      };
      reader.onerror=()=>{msg("Could not read image","error");setUploading(false);};
      reader.readAsDataURL(file);
    }catch(e){msg(e.message,"error");setUploading(false);}
  };

  return (
    <Pg style={{...DOT(false)}}>
      <h1 style={{fontSize:28,fontWeight:900,color:T.fg,marginBottom:4}}>Profile</h1>
      <p style={{color:T.mu,fontSize:13,marginBottom:24}}>Your account details</p>

      {/* Avatar */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24}}>
        <div onClick={()=>!uploading&&fileRef.current?.click()} style={{width:92,height:92,borderRadius:"50%",background:"#0f172a",border:`3px solid ${BL}`,overflow:"hidden",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",marginBottom:8}}>
          {avatar?<img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<span style={{color:"#fff",fontSize:32,fontWeight:900}}>{(meta.username||meta.full_name||"?")[0]?.toUpperCase()}</span>}
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,.55)",padding:"5px 0",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            {uploading?<Sp sz={14} c="#fff"/>:<><span style={{fontSize:12}}>📷</span><span style={{fontSize:10,color:"#fff",fontWeight:700}}>Change</span></>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{display:"none"}}/>
        <p style={{color:T.mu,fontSize:12,fontWeight:600}}>Tap to change photo</p>
      </div>

      {/* ID card */}
      <div style={{background:"#0f172a",borderRadius:18,padding:"20px",marginBottom:18,...DOT(true)}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{fontSize:10,fontWeight:800,opacity:.4,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6,color:"#fff"}}>Student ID</p>
            <p style={{fontSize:24,fontWeight:900,fontFamily:"JetBrains Mono,monospace",letterSpacing:".1em",color:"#fff"}}>#{uid}</p>
            <p style={{fontSize:12,opacity:.45,marginTop:4,color:"#fff"}}>{user?.email}</p>
            {meta.username&&<p style={{fontSize:14,color:BL2,fontWeight:700,marginTop:3}}>@{meta.username}</p>}
            {meta.university&&<p style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2}}>{meta.university}</p>}
          </div>
          <div style={{width:46,height:46,background:BL,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⚡</div>
        </div>
      </div>

      {/* Stats */}
      {stats&&(
        <div style={{marginBottom:18}}>
          <SecLbl T={T}>Your Statistics</SecLbl>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{l:"Drills Completed",v:stats.sessions},{l:"Questions Answered",v:stats.total},{l:"Average Score",v:`${stats.avg}%`},{l:"Best Score",v:`${stats.best}%`}].map(s=>(
              <div key={s.l} style={{background:T.sf,borderRadius:14,padding:"13px",border:`1.5px solid ${T.br}`}}>
                <div style={{fontSize:19,fontWeight:900,color:T.fg}}>{s.v}</div>
                <div style={{fontSize:11,color:T.mu,marginTop:2,fontWeight:600}}>{s.l}</div>
              </div>
            ))}
          </div>
          {stats.streak>0&&<div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:14,padding:"13px 16px",marginTop:10,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22}}>🔥</span>
            <div>
              <div style={{fontSize:17,fontWeight:900,color:"#c2410c"}}>{stats.streak} Day Streak</div>
              <div style={{fontSize:12,color:"#9a3412"}}>Keep going — don't break it!</div>
            </div>
          </div>}
        </div>
      )}

      {/* Edit */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:16}}>
        <Inp label="Full Name" value={name} onChange={setName}/>
        <Inp label="Username" value={uname} onChange={v=>setUname(v.toLowerCase().replace(/[^a-z0-9_]/g,""))} prefix="@"/>
        <div>
          <Lbl>Institution</Lbl>
          <SDrop items={UNIVERSITIES} value={uni} onChange={setUni} placeholder="Search institution..." T={T}/>
        </div>
        <div>
          <Lbl>Programme</Lbl>
          <SDrop items={PROGRAMMES} value={prog} onChange={setProg} placeholder="Search programme..." T={T}/>
        </div>
      </div>

      <button onClick={saveProfile} disabled={saving} style={{width:"100%",background:BL,color:"#fff",borderRadius:14,padding:"14px",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10,opacity:saving?.65:1}}>
        {saving?<Sp c="#fff"/>:"Save Profile"}
      </button>
      <button onClick={()=>go("help")} style={{width:"100%",background:T.sf,color:T.fg,borderRadius:14,padding:"13px",fontWeight:700,fontSize:14,border:`1.5px solid ${T.br}`,marginBottom:10}}>
        ❓ Help & Support
      </button>
      <button onClick={out} style={{width:"100%",background:"#fff1f2",color:"#dc2626",borderRadius:14,padding:"13px",fontWeight:800,fontSize:15,border:"1.5px solid #fecdd3"}}>
        Sign Out
      </button>
    </Pg>
  );
}
