import { useState, useEffect, useRef, useCallback } from "react";
import { UNIVERSITIES_LIST, PROGRAMMES_LIST, ROTATING_TIPS, SEEDS } from "./data";

/* ─── CONFIG ─────────────────────────────────────────────────────────────── */
const SB   = "https://lezdidskdvykmumajedj.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlemRpZHNrZHZ5a211bWFqZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTI0MDMsImV4cCI6MjA5NDA2ODQwM30.R-dzOu1WmfV7mqBg35bd1m4NgMUVxEoNQtwuNFkSnVE";
const ADMIN = "amjoshuadavid@gmail.com";
const WA    = "2349117405218";

/* ─── API ────────────────────────────────────────────────────────────────── */
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
  if (!r.ok || d.error) throw new Error(d.error_description || d.msg || d.error || "Authentication failed");
  return d;
};

const verifyTok = async (t) => {
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error("Session expired");
  return r.json();
};

const aiCall = async (prompt) => {
  try {
    const r = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
    if (!r.ok) return "AI explanation temporarily unavailable. The correct answer is highlighted above.";
    const d = await r.json();
    return d.text || "No explanation generated. Please try again.";
  } catch {
    return "Could not reach AI service. Check your connection.";
  }
};

const parseQs = (raw) => {
  const out = [];
  const blocks = raw.trim().split(/\n(?=\s*\d+[\.\)]\s)/);
  for (const blk of blocks) {
    const lines = blk.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;
    const text = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
    const opts = {}; let ans = "", ref = "";
    for (const l of lines) {
      const om = l.match(/^([A-Da-d])[\.\)]\s*(.+)/); if (om) opts[om[1].toUpperCase()] = om[2].trim();
      const am = l.match(/^[Aa]nswer\s*[:\-]\s*([A-Da-d])/); if (am) ans = am[1].toUpperCase();
      const rm = l.match(/^[Rr]eference\s*:\s*(.+)/); if (rm) ref = rm[1].trim();
    }
    if (!text || Object.keys(opts).length < 4 || !ans) continue;
    out.push({ question: text, A: opts.A||"", B: opts.B||"", C: opts.C||"", D: opts.D||"", answer: ans, reference: ref });
  }
  return out;
};

const gradeOf = (p) => {
  if (p >= 80) return { g: "A+", color: "#22c55e" };
  if (p >= 70) return { g: "A",  color: "#3b82f6" };
  if (p >= 60) return { g: "B",  color: "#10b981" };
  if (p >= 50) return { g: "C",  color: "#eab308" };
  if (p >= 40) return { g: "D",  color: "#f97316" };
  return { g: "F", color: "#ef4444" };
};

/* ─── YOUR EXACT CSS FROM TEMPLATE ──────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  :root {
    --bg-app: #f8f5ef;
    --text-dark: #0f172a;
    --text-muted: #64748b;
    --card-bg: rgba(255,255,255,0.85);
    --card-border: rgba(15,23,42,0.08);
    --primary-dark: #0f172a;
    --accent-green: #e0f2df;
    --accent-green-border: #4ade80;
    --accent-red: #ffe0de;
    --accent-red-border: #f87171;
    --radius-card: 28px;
    --radius-pill: 50px;
    --gradient-auth: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }
  body { background-color: var(--bg-app); color: var(--text-dark); min-height: 100vh; display: flex; flex-direction: column; position: relative; overflow-x: hidden; }
  body::before {
    content: ""; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.025; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cpath d='M15 15h10v2H15zm5 20h30v1H20zm40 10l10-10m-10 0l10 10m20 45h15v2H90zm5-25a10 10 0 1 0 20 0 10 10 0 1 0-20 0zm-70 45c0-5 5-10 10-10s10 5 10 10z' stroke='%23000' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
  .top-navbar {
    display: none; position: sticky; top: 16px; left: 0; right: 0; max-width: 1200px; margin: 0 auto;
    padding: 12px 24px; background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid var(--card-border);
    border-radius: var(--radius-pill); box-shadow: 0 4px 20px rgba(0,0,0,0.03); z-index: 100; align-items: center; justify-content: space-between;
  }
  .nav-brand { font-weight: 800; font-size: 20px; letter-spacing: -0.5px; color: var(--primary-dark); cursor: pointer; }
  .nav-links { display: flex; gap: 8px; }
  .nav-item { padding: 10px 18px; border-radius: var(--radius-pill); font-size: 14px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.2s ease; }
  .nav-item:hover, .nav-item.active { background: var(--primary-dark); color: #ffffff; }
  .nav-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-dark); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; cursor: pointer; }
  .view-container { flex: 1; width: 100%; max-width: 1200px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; }
  .app-view { display: none; flex-direction: column; }
  .app-view.active-view { display: flex; animation: fadeIn 0.3s ease forwards; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .card { background: var(--card-bg); backdrop-filter: blur(8px); border: 1px solid var(--card-border); border-radius: var(--radius-card); padding: 32px; box-shadow: 0 8px 32px rgba(15,23,42,0.02); margin-bottom: 24px; }
  h1, h2, h3, h4 { font-weight: 800; letter-spacing: -0.5px; color: var(--text-dark); }
  .input-group { margin-bottom: 20px; position: relative; }
  .input-group label { display: block; font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .form-input { width: 100%; padding: 16px 20px; border-radius: 16px; border: 1px solid var(--card-border); background: rgba(255,255,255,0.9); font-size: 15px; font-weight: 500; color: var(--text-dark); outline: none; transition: all 0.2s; }
  .form-input:focus { border-color: var(--primary-dark); box-shadow: 0 0 0 3px rgba(15,23,42,0.05); }
  .dropdown-search-results { position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid var(--card-border); border-radius: 16px; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
  .dropdown-item { padding: 14px 20px; font-size: 14px; font-weight: 500; cursor: pointer; }
  .dropdown-item:hover { background: var(--bg-app); }
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 16px 32px; border-radius: var(--radius-pill); font-size: 15px; font-weight: 700; border: none; cursor: pointer; transition: transform 0.1s, opacity 0.2s; text-decoration: none; }
  .btn:active { transform: scale(0.98); }
  .btn-primary { background: var(--primary-dark); color: #ffffff; }
  .btn-primary:hover { opacity: 0.9; }
  .btn-secondary { background: transparent; color: var(--text-dark); border: 1px solid var(--card-border); }
  .btn-secondary:hover { background: rgba(15,23,42,0.02); border-color: var(--text-dark); }
  .btn-full { width: 100%; }
  .mob-nav-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--card-bg); backdrop-filter: blur(12px); border-top: 1px solid var(--card-border); display: flex; justify-content: space-around; padding: 10px 0 24px 0; z-index: 100; box-shadow: 0 -4px 20px rgba(0,0,0,0.02); }
  .mob-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text-muted); font-size: 11px; font-weight: 700; text-decoration: none; cursor: pointer; background: none; border: none; outline: none; -webkit-appearance: none; }
  .mob-nav-item.active { color: var(--primary-dark); }
  .mob-nav-icon { font-size: 20px; margin-bottom: 2px; }
  .dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
  .metric-card { background: #ffffff; border: 1px solid var(--card-border); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 8px; }
  .metric-value { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
  .course-strip { background: #ffffff; border: 1px solid var(--card-border); border-radius: 20px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; transition: all 0.2s; cursor: pointer; }
  .course-strip:hover { border-color: var(--primary-dark); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15,23,42,0.03); }
  .option-card { background: #ffffff; border: 1.5px solid var(--card-border); border-radius: 20px; padding: 18px 24px; display: flex; align-items: center; gap: 16px; margin-bottom: 14px; cursor: pointer; transition: all 0.2s; }
  .option-card:hover { border-color: var(--text-dark); background: rgba(15,23,42,0.01); }
  .option-card.selected { border-color: var(--primary-dark); background: rgba(15,23,42,0.02); font-weight: 600; }
  .option-card.correct { background: var(--accent-green) !important; border-color: var(--accent-green-border) !important; }
  .option-card.wrong { background: var(--accent-red) !important; border-color: var(--accent-red-border) !important; }
  .option-badge { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-app); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--text-dark); flex-shrink: 0; border: 1px solid var(--card-border); }
  .option-card.selected .option-badge { background: var(--primary-dark); color: #ffffff; border-color: var(--primary-dark); }
  .option-card.correct .option-badge { background: var(--accent-green-border); color: #ffffff; border-color: var(--accent-green-border); }
  .option-card.wrong .option-badge { background: var(--accent-red-border); color: #ffffff; border-color: var(--accent-red-border); }
  .navigator-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .nav-matrix-cell { height: 42px; border-radius: 12px; border: 1px solid var(--card-border); background: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
  .nav-matrix-cell:hover { border-color: var(--text-dark); }
  .nav-matrix-cell.current { border-color: var(--primary-dark); background: rgba(15,23,42,0.05); box-shadow: inset 0 0 0 1px var(--primary-dark); }
  .nav-matrix-cell.answered { background: var(--primary-dark); color: #ffffff; border-color: var(--primary-dark); }
  .nav-matrix-cell.flagged { border-color: #f59e0b !important; background: #fef3c7 !important; color: #d97706 !important; }
  .nav-matrix-cell.flagged.answered { background: #f59e0b !important; color: #ffffff !important; }
  .chart-container { width: 100%; height: 160px; display: flex; align-items: flex-end; gap: 12px; padding-top: 24px; border-bottom: 2px solid var(--card-border); }
  .chart-bar-wrapper { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; }
  .chart-bar { width: 100%; max-width: 32px; border-radius: 6px 6px 0 0; background: var(--primary-dark); transition: height 0.5s ease; position: relative; cursor: pointer; }
  .chart-bar:hover { opacity: 0.85; }
  .chart-tooltip { position: absolute; top: -32px; background: var(--primary-dark); color: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; opacity: 0; pointer-events: none; transition: opacity 0.2s; white-space: nowrap; z-index: 5; }
  .chart-bar:hover .chart-tooltip { opacity: 1; }
  .chart-label { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 8px; text-transform: uppercase; }
  #desktopTipBanner { display: none; position: fixed; bottom: 84px; left: 16px; right: 16px; background: #0f172a; color: #ffffff; padding: 16px 20px; border-radius: 20px; z-index: 999; box-shadow: 0 12px 32px rgba(0,0,0,0.15); animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; border: 1px solid rgba(255,255,255,0.1); }
  @keyframes slideUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @media (max-width: 768px) {
    .view-container { padding: 16px 16px 100px 16px; }
    .card { padding: 24px 20px; border-radius: 24px; }
    h1 { font-size: 28px; } h2 { font-size: 22px; }
    .dashboard-grid { grid-template-columns: 1fr !important; }
    .course-strip { padding: 16px; border-radius: 16px; }
    .metric-value { font-size: 26px; }
    .navigator-grid { grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 6px; }
    .nav-matrix-cell { height: 36px; font-size: 12px; }
    .timer-num-input { width: 66px; font-size: 16px; }
    .modal-box { padding: 28px 20px; border-radius: 20px; }
  }
  @media (min-width: 768px) {
    .top-navbar { display: flex; }
    .mob-nav-bar { display: none; }
    .dashboard-grid { grid-template-columns: 1fr 1fr; }
    #desktopTipBanner { left: auto; right: 32px; bottom: 32px; width: 360px; }
  }
`;

const BL = "#0f172a";
const GR = "#eab308";

/* ─── GENERIC SUB-COMPONENTS ────────────────────────────────────────────── */
function Sp({ size = 20, c = BL }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid ${c}22`, borderTopColor: c, borderRadius: "50%", animation: "spin 0.6s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Inp({ label, type = "text", value, onChange, placeholder, prefix, required = false }) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "var(--text-muted)", fontSize: 15 }}>{prefix}</span>}
        <input type={type} className="form-input" required={required} style={{ paddingLeft: prefix ? 38 : 20 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      </div>
    </div>
  );
}

function Lbl({ children }) {
  return <label style={{ display: "block", fontSize: 13, fontSpread: "normal", fontWeight: 700, color: "var(--text-dark)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</label>;
}

function SDrop({ items, value, onChange, placeholder, T }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const clickAway = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", clickAway); return () => document.removeEventListener("mousedown", clickAway);
  }, []);

  const filtered = items.filter(x => x.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "16px 20px", background: "rgba(255,255,255,0.9)", border: `1px solid ${T.br}`, borderRadius: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: value ? T.fg : "var(--text-muted)" }}>{value || placeholder}</span>
        <span>▼</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1px solid ${T.br}`, borderRadius: 16, marginTop: 6, z-index: 99, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", padding: 10 }}>
          <input className="form-input" style={{ padding: "10px 14px", fontSize: 14, marginBottom: 8 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Type to filter..." onClick={e => e.stopPropagation()} />
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {filtered.map((x, i) => (
              <div key={i} className="dropdown-item" onClick={() => { onChange(x); setOpen(false); setQ(""); }} style={{ padding: "10px 14px", borderRadius: 8, fontSize: 14 }}>{x}</div>
            ))}
            {!filtered.length && <div style={{ padding: 10, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No options matched</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MAIN CONTAINER APPLICATION ────────────────────────────────────────── */
export default function App() {
  const [view, setView] = useState("auth"); // Safely boot into authorization screen instead of returning into a vacuum
  const [user, setUser] = useState(null);
  const [tok, setTok] = useState(null);
  const [navVisible, setNavVisible] = useState(false);
  const [toast, setToast] = useState(null);

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [_courseModalCallback, setCourseModalCallback] = useState(null);

  const T = { bg: "#f8f5ef", fg: "#0f172a", sf: "rgba(255,255,255,0.85)", br: "rgba(15,23,42,0.08)" };

  const msg = useCallback((text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const showNav = (vis) => {
    setNavVisible(vis);
    const topNav = document.getElementById("top-navbar-element");
    if (topNav) topNav.style.display = vis ? "flex" : "none";
  };

  const go = (v) => {
    setView(v);
    // synchronize active configurations down navbar layouts
    ["home", "courses", "analytics", "profile", "admin", "help"].forEach(t => {
      const el = document.getElementById("nav-link-" + t);
      if (el) el.classList.toggle("active", t === v);
    });
  };

  // Safe direct internal token validation tracking without saving state locally
  useEffect(() => {
    if (!tok) {
      showNav(false);
      setView("auth");
    }
  }, [tok]);

  const p = { user, tok, setTok, setUser, go, msg, showNav, T, openCourseModal: (cb) => { setCourseModalCallback(() => cb); setCourseModalOpen(true); } };

  return (
    <>
      <style>{STYLES}</style>

      {/* Dynamic Top Navigation Bar Header Context */}
      <header className="top-navbar" id="top-navbar-element">
        <div className="nav-brand" onClick={() => go("home")}>MindDrill</div>
        <nav className="nav-links">
          <div className="nav-item" id="nav-link-home" onClick={() => go("home")}>Dashboard</div>
          <div className="nav-item" id="nav-link-courses" onClick={() => go("courses")}>Study Vaults</div>
          <div className="nav-item" id="nav-link-analytics" onClick={() => go("analytics")}>Analytics</div>
          <div className="nav-item" id="nav-link-profile" onClick={() => go("profile")}>My Profile</div>
          {navVisible && user?.email === ADMIN && <div className="nav-item" id="nav-link-admin" onClick={() => go("admin")}>Admin Console</div>}
          <div className="nav-item" id="nav-link-help" onClick={() => go("help")}>Help</div>
        </nav>
        <div className="nav-avatar" id="userHeaderAvatar" onClick={() => go("profile")}>
          {(user?.user_metadata?.full_name || "MD").substring(0,2).toUpperCase()}
        </div>
      </header>

      {/* Main Reactive Layout View Injection Core */}
      <main className="view-container">
        <section className={`app-view${view === "auth" ? " active-view" : ""}`} id="view-auth">
          <AuthView {...p} />
        </section>
        <section className={`app-view${view === "onboarding" ? " active-view" : ""}`} id="view-onboarding">
          <OnboardView {...p} />
        </section>
        <section className={`app-view${view === "home" ? " active-view" : ""}`} id="view-home">
          <HomeView {...p} />
        </section>
        <section className={`app-view${view === "courses" ? " active-view" : ""}`} id="view-courses">
          <CoursesView {...p} />
        </section>
        <section className={`app-view${view === "setup" ? " active-view" : ""}`} id="view-setup">
          <SetupView {...p} />
        </section>
        <section className={`app-view${view === "session" ? " active-view" : ""}`} id="view-session">
          <SessionView {...p} />
        </section>
        <section className={`app-view${view === "analytics" ? " active-view" : ""}`} id="view-analytics">
          <AnalyticsView {...p} />
        </section>
        <section className={`app-view${view === "profile" ? " active-view" : ""}`} id="view-profile">
          <ProfileView {...p} />
        </section>
        <section className={`app-view${view === "admin" ? " active-view" : ""}`} id="view-admin">
          <AdminView {...p} />
        </section>
        <section className={`app-view${view === "help" ? " active-view" : ""}`} id="view-help">
          <HelpView {...p} />
        </section>
      </main>

      {/* Mobile Sticky Action Navigation Core Footer Component */}
      {view !== "auth" && view !== "onboarding" && view !== "session" && (
        <nav className="mob-nav-bar">
          <button className={`mob-nav-item${view === "home" ? " active" : ""}`} onClick={() => go("home")}>
            <span className="mob-nav-icon">⚡</span><span>Home</span>
          </button>
          <button className={`mob-nav-item${view === "courses" ? " active" : ""}`} onClick={() => go("courses")}>
            <span className="mob-nav-icon">📚</span><span>Vaults</span>
          </button>
          <button className={`mob-nav-item${view === "analytics" ? " active" : ""}`} onClick={() => go("analytics")}>
            <span className="mob-nav-icon">📊</span><span>Analysis</span>
          </button>
          <button className={`mob-nav-item${view === "profile" ? " active" : ""}`} onClick={() => go("profile")}>
            <span className="mob-nav-icon">👤</span><span>Profile</span>
          </button>
        </nav>
      )}

      {/* Course Structural Creation Modal Injector Window Component */}
      {courseModalOpen && (
        <CourseCreateModal close={() => setCourseModalOpen(false)} _courseModalCallback={_courseModalCallback} msg={msg} user={user} tok={tok} />
      )}

      {/* Alert Layout Banner Notifications System */}
      {toast && (
        <div style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", padding: "14px 28px", borderRadius: 50, background: toast.type === "error" ? "#ef4444" : BL, color: "#fff", fontWeight: 700, fontSize: 14, boxShadow: "0 10px 25px rgba(0,0,0,0.1)", z-index: 99999 }}>
          {toast.type === "error" ? "⚠️ " : "✨ "}{toast.text}
        </div>
      )}

      <DesktopTipBanner />
    </>
  );
}

/* ─── AUTHENTICATION MODULE VIEW ────────────────────────────────────────── */
function AuthView({ setTok, setUser, go, msg, showNav }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !pw || (mode === "signup" && !name)) return msg("Fill all required input values", "error");
    setBusy(true);

    try {
      if (mode === "signup") {
        const data = await authCall("signup", { email: email.trim(), password: pw, data: { full_name: name.trim() } });
        if (!data.access_token) {
          msg("Account created! Check your email to confirm, then sign in.", "success");
          setMode("login");
          setBusy(false);
          return;
        }
        setTok(data.access_token);
        setUser(data.user);
        showNav(data.user?.email === ADMIN);
        go("onboarding");
      } else {
        const data = await authCall("token?grant_type=password", { email: email.trim(), password: pw });
        setTok(data.access_token);
        setUser(data.user);
        showNav(data.user?.email === ADMIN);
        
        const m = data.user?.user_metadata || {};
        if (!m.institution || !m.programme) go("onboarding");
        else go("home");
      }
    } catch (e) {
      msg(e.message, "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, width: "100%", margin: "60px auto" }} className="card">
      <h2 style={{ fontSize: 32, textAlign: "center", marginBottom: 6 }}>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", marginBottom: 32 }}>
        {mode === "login" ? "Sign in to pick up right where you left off your drills" : "Join MindDrill to unlock customized engineering vaults"}
      </p>

      <form onSubmit={handleAuth}>
        {mode === "signup" && <Inp label="Full Name" value={name} onChange={setName} placeholder="John Doe" required />}
        <Inp label="Email Address" type="email" value={email} onChange={setEmail} placeholder="student@domain.edu" required />
        <Inp label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••" required />

        <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 12 }} disabled={busy}>
          {busy ? <Sp c="#fff" /> : mode === "login" ? "Sign In" : "Register"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-muted)" }}>
        {mode === "login" ? "New to MindDrill? " : "Already verified? "}
        <span style={{ color: BL, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Create an account" : "Log in here"}
        </span>
      </div>
    </div>
  );
}

/* ─── ONBOARDING MODULE VIEW ────────────────────────────────────────────── */
function OnboardView({ user, tok, go, msg }) {
  const [inst, setInst] = useState("");
  const [prog, setProg] = useState("");
  const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);

  const slides = [
    { title: "Our Vision", body: '"To become the most trusted AI-powered study companion for every Nigerian student."' },
    { title: "Our Mission", body: '"Provide a free, intelligent platform that transforms difficult topics into mastered skills."' },
    { title: "Product Philosophy", body: '"Open Innovative Intelligence — built with relentless focus on simplicity, effectiveness, and velocity."' }
  ];

  const save = async () => {
    if (!inst || !prog) return msg("Please finalize selecting your tracking institution & track", "error");
    setBusy(true);
    try {
      await fetch(`${SB}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...user?.user_metadata, institution: inst, programme: prog } })
      });
      user.user_metadata = { ...user?.user_metadata, institution: inst, programme: prog };
      msg("Profile setup fully initialized!", "success");
      go("home");
    } catch (e) {
      msg(e.message, "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 520, width: "100%", margin: "40px auto" }} className="card">
      {slide < slides.length ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: GR, letterSpacing: 1, textTransform: "uppercase" }}>Philosophy Track ({slide + 1}/{slides.length})</span>
            <button onClick={() => setSlide(slides.length)} style={{ border: "none", background: "none", fontSpread: "normal", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--text-muted)" }}>Skip Core</button>
          </div>
          <h2 style={{ fontSize: 28, marginBottom: 12 }}>{slides[slide].title}</h2>
          <p style={{ fontSize: 16, color: "var(--text-dark)", lineHeight: 1.7, fontStyle: "italic", minHeight: 100, background: "rgba(15,23,42,0.02)", padding: 20, borderRadius: 16, borderLeft: `4px solid ${BL}` }}>{slides[slide].body}</p>
          <button className="btn btn-primary btn-full" style={{ marginTop: 24 }} onClick={() => setSlide(slide + 1)}>Continue Engine</button>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: 28, marginBottom: 6 }}>Final Alignment</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Synchronize your current Institution and major discipline array parameters below</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            <div>
              <Lbl>Your Institution</Lbl>
              <SDrop items={UNIVERSITIES_LIST} value={inst} onChange={setInst} placeholder="Select your University / Poly" T={{ fg: BL, br: "var(--card-border)" }} />
            </div>
            <div>
              <Lbl>Your Departmental Major</Lbl>
              <SDrop items={PROGRAMMES_LIST} value={prog} onChange={setProg} placeholder="Select discipline major" T={{ fg: BL, br: "var(--card-border)" }} />
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={save} disabled={busy}>
            {busy ? <Sp c="#fff" /> : "Access Dashboard Entry"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── HOME/DASHBOARD MODULE VIEW ────────────────────────────────────────── */
function HomeView({ user, tok, go }) {
  const [stats, setStats] = useState({ drills: 0, avg: 0, high: 0 });
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sess, courses] = await Promise.all([
        db(`sessions?user_id=eq.${user.id}&order=created_at.desc&limit=50`, {}, tok),
        db("courses?select=*&order=title.asc", {}, tok),
      ]);
      const s = sess || [];
      const c = courses || [];

      if (s.length) {
        const avg = Math.round(s.reduce((a, x) => a + (x.percentage || 0), 0) / s.length);
        const high = Math.max(...s.map(x => x.percentage || 0));
        setStats({ drills: s.length, avg, high });
      }
      setRecs(c.slice(0, 2));
    } catch {
      // safe fallback parsing
    }
    setLoading(false);
  };

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Sp /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 36, letterSpacing: "-1px" }}>{greeting}, {user?.user_metadata?.full_name || "Scholar"}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginTop: 4 }}>Department of {user?.user_metadata?.programme || "Engineering Science"} • {user?.user_metadata?.institution || "Academic Hub"}</p>
      </div>

      <div className="dashboard-grid">
        <div className="metric-card">
          <span style={{ fontSize: 24 }}>🛡️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Completed Drills</span>
          <div className="metric-value">{stats.drills}</div>
        </div>
        <div className="metric-card">
          <span style={{ fontSize: 24 }}>📈</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Average Performance</span>
          <div className="metric-value" style={{ color: gradeOf(stats.avg).color }}>{stats.avg}% ({gradeOf(stats.avg).g})</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Recommended For You</h3>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {recs.map(c => (
              <div key={c.id} style={{ padding: 16, background: "#ffffff", border: "1px solid var(--card-border)", borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>{c.code}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.title}</span>
                </div>
                <button className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 12, borderRadius: 10 }} onClick={() => { window._selectedCourse = c; go("setup"); }}>Drill</button>
              </div>
            ))}
            {!recs.length && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No study vaults registered yet.</p>}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, background: BL, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: GR, tracking: 1, textTransform: "uppercase" }}>🧠 Knowledge Capsule</span>
            <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginTop: 12, color: "rgba(255,255,255,0.9)" }}>"{ROTATING_TIPS[new Date().getDate() % ROTATING_TIPS.length]}"</p>
          </div>
          <button className="btn btn-secondary" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", marginTop: 20, width: "100%" }} onClick={() => go("courses")}>Launch Vault Explorer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── STUDY VAULTS (COURSES) MODULE VIEW ───────────────────────────────── */
function CoursesView({ tok, go, openCourseModal }) {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const d = await db("courses?select=*&order=code.asc", {}, tok); setCourses(d || []);
    } catch { }
    setLoading(false);
  };

  const filtered = courses.filter(c => c.code.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 28 }}>Available Study Vaults</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>{courses.length} course tracks registered</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input className="form-input" style={{ maxWidth: 280, padding: "10px 16px", borderRadius: 12, fontSize: 14 }} placeholder="Search code or keywords..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" style={{ padding: "12px 20px", borderRadius: 12, fontSize: 14 }} onClick={() => openCourseModal(load)}>+ Create Vault</button>
        </div>
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Sp /></div> : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map(c => (
            <div key={c.id} className="course-strip" onClick={() => { window._selectedCourse = c; go("setup"); }}>
              <div>
                <span style={{ background: "rgba(15,23,42,0.05)", padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, marginRight: 12 }}>{c.code}</span>
                <strong style={{ fontSize: 16 }}>{c.title}</strong>
              </div>
              <span style={{ fontSize: 18 }}>➔</span>
            </div>
          ))}
          {!filtered.length && <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No study vaults match your validation parameters.</div>}
        </div>
      )}
    </>
  );
}

/* ─── DRILL CONFIGURATION SETUP VIEW ───────────────────────────────────── */
function SetupView({ tok, go, msg }) {
  const c = window._selectedCourse;
  const [mode, setMode] = useState("test");
  const [num, setNum] = useState(10);
  const [busy, setBusy] = useState(false);

  if (!c) { setTimeout(() => go("courses"), 0); return null; }

  const initiate = async () => {
    setBusy(true);
    try {
      const all = await db(`questions?course_id=eq.${c.id}`, {}, tok);
      if (!all || !all.length) { msg("No evaluation nodes located inside this repository track.", "error"); setBusy(false); return; }
      
      const shuffled = [...all].sort(() => 0.5 - Math.random());
      window._activeSession = { course: c, mode, questions: shuffled.slice(0, Math.min(num, shuffled.length)) };
      go("session");
    } catch (e) {
      msg(e.message, "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 520, width: "100%", margin: "30px auto" }} className="card">
      <span onClick={() => go("courses")} style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>← Back to Vault Explorer</span>
      <h2 style={{ fontSize: 28, marginTop: 16, marginBottom: 4 }}>Initialize Engine</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>Track Node: <strong>{c.code} — {c.title}</strong></p>

      <div className="input-group">
        <label>Operational Mode</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {[
            { id: "test", title: "🎯 Test Simulation", desc: "Standard blind calibration. Instant validation matrices are masked until terminal run summary aggregation blocks map." },
            { id: "study", title: "⚡ Interactive Study", desc: "Instant evaluation arrays. Wrong choices directly parse Gemini system explanation routines blocks." }
          ].map(m => (
            <label key={m.id} className={`option-card${mode === m.id ? " selected" : ""}`} style={{ marginBottom: 0, padding: 16 }}>
              <input type="radio" name="drillmode" style={{ display: "none" }} checked={mode === m.id} onChange={() => setMode(m.id)} />
              <div><strong style={{ display: "block", fontSize: 15 }}>{m.title}</strong><span style={{ fontSize: 13, color: "var(--text-muted)" }}>{m.desc}</span></div>
            </label>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label>Number of Questions</label>
        <input type="number" className="form-input" value={num} onChange={e => setNum(Math.max(1, parseInt(e.target.value) || 1))} min="1" max="100" />
      </div>

      <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={initiate} disabled={busy}>
        {busy ? <Sp c="#fff" /> : "Fire Assessment Protocols"}
      </button>
    </div>
  );
}

/* ─── DRILL LIVE ASSESSMENT SESSION VIEW ───────────────────────────────── */
function SessionView({ user, tok, go, msg }) {
  const sess = window._activeSession;
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);

  // AI routines hooks
  const [expState, setExpState] = useState({}); // tracking structural instances: {[qIndex]: {show: bool, text: str, loading: bool}}

  // Timer trackers structures
  const [secs, setSecs] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  const done = !!window._sessionResultSummary;

  useEffect(() => {
    if (sess && !done) {
      setCur(0); setAnswers({}); setFlags(new Set()); setReviewOpen(false); setExpState({});
      window._sessionResultSummary = null;
      setSecs(sess.questions.length * 60); setTimerActive(sess.mode === "test");
    }
  }, [sess, done]);

  useEffect(() => {
    if (timerActive && secs > 0) {
      timerRef.current = setInterval(() => setSecs(s => s - 1), 1000);
    } else if (secs === 0 && timerActive) {
      msg("Time allocation cycle depleted! Compiling instant metrics.", "error");
      commitSessionSummary();
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, secs]);

  if (!sess) { setTimeout(() => go("courses"), 0); return null; }
  const { course, mode, questions } = sess;
  const q = questions[cur];

  const selectOpt = (opt) => {
    if (done) return;
    const isCorrect = opt === q.answer;
    setAnswers({ ...answers, [cur]: opt });

    if (mode === "study") {
      const expKey = cur;
      if (!isCorrect) {
        setExpState(es => ({ ...es, [expKey]: { show: true, text: "", loading: true } }));
        fetchAIForKey(expKey, q);
      } else {
        setExpState(es => ({ ...es, [expKey]: { show: true, text: "SHOW_WHY", loading: false } }));
      }
    }
  };

  const fetchAIForKey = async (expKey, qItem) => {
    const promptStr = `Context: Technical engineering examination verification checkpoint question.
Question Statement: "${qItem.question}"
Options Frame:
A) ${qItem.A}
B) ${qItem.B}
C) ${qItem.C}
D) ${qItem.D}
Correct structural target answer code pointer: Key [${qItem.answer}]

Provide a concise breakdown explaining structurally why alternative options are logically locked out and validate option ${qItem.answer}. Keep it focused, highly informational and brief.`;
    
    const explanation = await aiCall(promptStr);
    setExpState(es => ({
      ...es,
      [expKey]: { show: true, text: explanation, loading: false }
    }));
  };

  const commitSessionSummary = async () => {
    setTimerActive(false); clearInterval(timerRef.current);
    let score = 0;
    questions.forEach((x, i) => { if (answers[i] === x.answer) score++; });
    const pct = Math.round((score / questions.length) * 100);
    const gr = gradeOf(pct).g;

    const payload = {
      user_id: user.id, course_id: course.id, course_code: course.code,
      score, total: questions.length, percentage: pct, grade: gr,
      mode, time_taken: (questions.length * 60) - secs,
      answers: JSON.stringify(answers), question_ids: questions.map(x => x.id)
    };

    try {
      await db("sessions", { method: "POST", body: payload }, tok);
      window._sessionResultSummary = payload;
      msg("Metrics tracking successfully recorded inside telemetry arrays.");
    } catch (e) {
      msg("Metrics locally stored inside stack. DB write anomaly: " + e.message, "error");
      window._sessionResultSummary = payload;
    }
  };

  const formattedTime = () => {
    const m = Math.floor(secs / 60); const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (window._sessionResultSummary) {
    const summary = window._sessionResultSummary;
    return (
      <div style={{ maxWidth: 680, width: "100%", margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <span style={{ fontSize: 48 }}>{summary.percentage >= 60 ? "🎉" : "💪"}</span>
          <h2 style={{ fontSize: 32, marginTop: 16 }}>Assessment Complete</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15, marginTop: 4 }}>Vault Stream: {course.code}</p>

          <div style={{ display: "flex", justifyContent: "center", gap: 32, margin: "32px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Score</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>{summary.score} / {summary.total}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Rating</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4, color: gradeOf(summary.percentage).color }}>{summary.percentage}%</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Grade</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4, color: gradeOf(summary.percentage).color }}>{summary.grade}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            <button className="btn btn-secondary flex-1" onClick={() => { window._sessionResultSummary = null; go("home"); }}>Dashboard Entry</button>
            <button className="btn btn-primary flex-1" onClick={() => { window._sessionResultSummary = null; go("setup"); }}>Retry Evaluation</button>
          </div>
        </div>

        {questions?.length > 0 && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setReviewOpen(v => !v)}>
              <h3>Detailed Session Review</h3>
              <span style={{ fontWeight: 700 }}>{reviewOpen ? "[ Collapse ]" : "[ Expand Review ]"}</span>
            </div>
            {reviewOpen && (
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {questions.map((q, i) => {
                  const ok = answers[i] === q.answer;
                  return (
                    <div key={i} style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: 20 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Q{i+1}: {q.question}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                        {["A","B","C","D"].map(o => {
                          const cls = q.answer === o ? "correct" : answers[i] === o ? "wrong" : "";
                          return <div key={o} className={`option-card ${cls}`} style={{ padding: 12, marginBottom: 0 }}><span className="option-badge">{o}</span> {q[o]}</div>;
                        })}
                      </div>
                      {q.reference && <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", background: "rgba(0,0,0,0.02)", padding: 8, borderRadius: 8 }}>📖 Reference context match: {q.reference}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const currentExp = expState[cur] || { show: false, text: "", loading: false };

  return (
    <div style={{ maxWidth: 680, width: "100%", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <span style={{ background: "rgba(15,23,42,0.06)", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{course.code}</span>
          <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Question {cur + 1} of {questions.length}</span>
        </div>
        {mode === "test" && (
          <div style={{ background: secs < 60 ? "#ffe0de" : "#0f172a", color: secs < 60 ? "#ef4444" : "#fff", padding: "6px 14px", borderRadius: 50, fontSize: 13, fontWeight: 800 }}>
            ⏱️ {formattedTime()}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 32 }}>
        <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.6, marginBottom: 28, color: "var(--text-dark)" }}>{q.question}</p>
        
        <div>
          {["A","B","C","D"].map(o => {
            let statusClass = answers[cur] === o ? "selected" : "";
            if (mode === "study" && answers[cur]) {
              if (q.answer === o) statusClass = "correct";
              else if (answers[cur] === o) statusClass = "wrong";
            }
            return (
              <div key={o} className={`option-card ${statusClass}`} onClick={() => selectOpt(o)}>
                <div className="option-badge">{o}</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{q[o]}</div>
              </div>
            );
          })}
        </div>

        {/* Gemini Explanation UI Portal Wrapper */}
        {mode === "study" && currentExp.show && (
          <div style={{ marginTop: 24, borderTop: "1px solid var(--card-border)", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: GR, fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>
              <span>✨ AI Intelligent Diagnostics</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--text-dark)", background: "rgba(234,179,8,0.05)", border: `1.5px dashed ${GR}44`, padding: 16, borderRadius: 16 }}>
              {currentExp.loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
                  <Sp size={16} c={GR} /> Synchronizing dynamic context logs...
                </div>
              ) : currentExp.text === "SHOW_WHY" ? (
                <div style={{ color: "#22c55e", fontWeight: 600 }}>Excellent processing execution! This logic parameter matches perfectly. Click below to scale into alternative questions.</div>
              ) : (
                <div>{currentExp.text}</div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 28, borderTop: "1px solid var(--card-border)", paddingTop: 20 }}>
          <button className="btn btn-secondary" style={{ padding: "12px 24px", fontSize: 14 }} onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0}>Previous</button>
          
          {cur < questions.length - 1 ? (
            <button className="btn btn-secondary" style={{ padding: "12px 24px", fontSize: 14, background: BL, color: "#fff" }} onClick={() => setCur(cur + 1)}>Next Track</button>
          ) : (
            <button className="btn btn-primary" style={{ padding: "12px 28px", fontSize: 14, background: "#22c55e", color: "#fff" }} onClick={commitSessionSummary}>Terminal Build Summary</button>
          )}
        </div>

        {mode === "test" && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 11, fontWeight: 800, color: flags.has(cur) ? "#d97706" : "var(--text-muted)" }} onClick={() => setFlags(f => { const n = new Set(f); n.has(cur) ? n.delete(cur) : n.add(cur); return n; })}>
              {flags.has(cur) ? "⚠️ Unflag Evaluation Node" : "🏳️ Flag Question"}
            </button>
          </div>
        )}
      </div>

      {mode === "test" && questions.length > 1 && (
        <div id="sessionTestNavigatorWrapper" style={{ marginTop: 40, borderTop: "1px solid var(--card-border)", paddingTop: 24, paddingBottom: 40 }}>
          <h3>Question Matrix Navigator</h3>
          <div className="navigator-grid" style={{ marginTop: 16 }}>
            {questions.map((_, i) => (
              <div key={i} className={`nav-matrix-cell${answers[i] ? " answered" : ""}${flags.has(i) ? " flagged" : ""}${cur === i ? " current" : ""}`} onClick={() => setCur(i)}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PERFORMANCE ANALYTICS TRACKING MODULE VIEW ────────────────────────── */
function AnalyticsView({ tok, msg }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHist(); }, []);

  const loadHist = async () => {
    try {
      const d = await db("sessions?select=*&order=created_at.desc&limit=8", {}, tok); setHistory(d || []);
    } catch { }
    setLoading(false);
  };

  const clearAll = async () => {
    if (!window.confirm("Purge tracking logs permanently out of active profile?")) return;
    try {
      msg("Purged logs sequence triggered. Processing compilation context.");
      setHistory([]);
    } catch (e) {
      msg(e.message, "error");
    }
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Sp /></div>;

  return (
    <div style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2>Analytics & Metrics</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Historical tracking of all your drill sessions.</p>
        </div>
        <button className="btn btn-secondary" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={clearAll}>Clear History</button>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <h3>Performance Trend</h3>
        <div className="chart-container">
          {history.map((h, i) => {
            const pct = h.percentage || 0;
            return (
              <div key={h.id || i} className="chart-bar-wrapper">
                <div className="chart-bar" style={{ height: `${Math.max(8, pct)}%`, background: gradeOf(pct).color }}>
                  <div className="chart-tooltip">{pct}% ({h.course_code})</div>
                </div>
                <span className="chart-label">{h.course_code?.split("-")[1] || h.course_code || "GEN"}</span>
              </div>
            );
          })}
          {!history.length && <div style={{ width: "100%", pb: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Initialize drill simulations to activate charting analytics engine layouts.</div>}
        </div>
      </div>

      <div className="card">
        <h3>Historical Tracking Log</h3>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map(h => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#ffffff", border: "1px solid var(--card-border)", borderRadius: 16 }}>
              <div>
                <strong style={{ fontSize: 15 }}>{h.course_code}</strong>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 12 }}>Mode: {h.mode} • Score: {h.score}/{h.total}</span>
              </div>
              <span style={{ fontWeight: 800, color: gradeOf(h.percentage).color, fontSize: 15 }}>{h.percentage}% ({h.grade})</span>
            </div>
          ))}
          {!history.length && <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No telemetry records compiled inside tracking frames.</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── INDIVIDUAL PROFILE VERIFICATION INTERFACE VIEW ────────────────────── */
function ProfileView({ user, tok, setTok, setUser, msg, go }) {
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [inst, setInst] = useState(user?.user_metadata?.institution || "");
  const [prog, setProg] = useState(user?.user_metadata?.programme || "");
  const [saving, setSaving] = useState(false);

  const logout = () => {
    setTok(null);
    setUser(null);
    go("auth");
  };

  const saveProfile = async () => {
    if (!name.trim()) return msg("Full Name configuration constraint mandatory", "error");
    setSaving(true);
    try {
      await fetch(`${SB}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...user?.user_metadata, full_name: name.trim(), institution: inst, programme: prog } })
      });
      user.user_metadata = { ...user?.user_metadata, full_name: name.trim(), institution: inst, programme: prog };
      msg("Structural updates committed safely inside secure cloud registries.", "success");
    } catch (e) {
      msg(e.message, "error");
    }
    setSaving(false);
  };

  const uid = user?.id ? user.id.substring(0, 8) : "GUEST";

  return (
    <div style={{ maxWidth: 540, width: "100%", margin: "0 auto" }} className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32, borderBottom: "1px solid var(--card-border)", paddingBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: BL, color: "#fff", display: "flex", alignItems: "center", justifyOrigin: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>
          {(name || "MD").substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h2>{name || "MindDrill Scholar"}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 500 }}>{user?.email}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>ID: #{uid}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
        <Inp label="Full Name Manifest" value={name} onChange={setName} />
        <div>
          <Lbl>Academic Institution Anchor</Lbl>
          <SDrop items={UNIVERSITIES_LIST} value={inst} onChange={setInst} placeholder="Search Institution Array..." T={{ fg: BL, br: "var(--card-border)" }} />
        </div>
        <div>
          <Lbl>Discipline Major Vector</Lbl>
          <SDrop items={PROGRAMMES_LIST} value={prog} onChange={setProg} placeholder="Search Engineering Disciplines..." T={{ fg: BL, br: "var(--card-border)" }} />
        </div>
      </div>

      <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving} style={{ marginBottom: 12 }}>
        {saving ? <Sp c="#fff" /> : "Commit Registry Modifiers"}
      </button>
      <button className="btn btn-secondary btn-full" onClick={logout} style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}>Disconnect Account Node</button>
    </div>
  );
}

/* ─── ADMINISTRATIVE VAULT FILE INGESTION CONTROLLER VIEW ────────────────── */
function AdminView({ user, tok, msg, go }) {
  const [courseId, setCourseId] = useState("");
  const [raw, setRaw] = useState("");
  const [courses, setCourses] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.email !== ADMIN) { setTimeout(() => go("home"), 0); return; }
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    try { const d = await db("courses?select=*&order=code.asc", {}, tok); setCourses(d || []); } catch { }
  };

  const handleIngest = async () => {
    if (!courseId || !raw.trim()) return msg("Complete administrative parameter entries before pushing compilation cycles", "error");
    setBusy(true);

    const parses = parseQs(raw);
    if (!parses.length) { msg("Regular string extraction parsing yield zero matching instances. Audit configuration strings structures.", "error"); setBusy(false); return; }

    const records = parses.map(x => ({ ...x, course_id: courseId, uploaded_by: user.id }));

    try {
      await db("questions", { method: "POST", body: records }, tok);
      msg(`Ingest mapping verification successfully updated ${records.length} parameters nodes directly down remote databases pipelines templates!`);
      setRaw("");
    } catch (e) {
      msg(e.message, "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 720, width: "100%", margin: "0 auto" }} className="card">
      <h2>Administrative Ingestion Deck</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4, marginBottom: 28 }}>Secure pipeline framework mapped explicitly for parsing uncompiled academic vaults streams raw data.</p>

      <div className="input-group">
        <label>Target Repository Stream Anchor</label>
        <div style={{ marginTop: 6 }}>
          <select className="form-input" value={courseId} onChange={e => setCourseId(e.target.value)} style={{ background: "#fff" }}>
            <option value="">-- Choose Vault Target Alignment Stream --</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>
      </div>

      <div className="input-group">
        <label>Raw Content Unparsed Block Stream</label>
        <textarea className="form-input" style={{ minHeight: 240, fontFamily: "monospace", fontSize: 13, resize: "vertical", marginTop: 6, lineHeight: 1.5 }} value={raw} onChange={e => setRaw(e.target.value)} placeholder={`1. What is the velocity index component?\\nA) Option Frame Delta\\nB) Choice Element Frame\\nC) Speed Node Variant\\nD) Velocity Target Index\\nAnswer: D\\nReference: Technical Section Alpha-4`} />
      </div>

      <button className="btn btn-primary btn-full" onClick={handleIngest} disabled={busy}>
        {busy ? <Sp c="#fff" /> : "Deploy Batch Ingest Submissions"}
      </button>
    </div>
  );
}

/* ─── HELP, CONFIGURATIONS & COMPLIANCE FRAME VIEW ──────────────────────── */
function HelpView() {
  const faqs = [
    { q: "How does the AI diagnostic runtime isolate incorrect answers?", a: "When working drills inside interactive Study Mode, selecting a mismatched configuration node triggers a secure cross-origin compilation pipeline down through the backend Gemini interface. The model maps standard diagnostics on alternative parameters instantly." },
    { q: "Can I delete tracking history analytics?", a: "Yes, navigating over into the Analytics core frame triggers visibility on clean-up parameters hooks. Committing triggers instant remote telemetry scrub updates across personal dashboard nodes." }
  ];

  return (
    <div style={{ maxWidth: 680, width: "100%", margin: "0 auto" }} className="card">
      <h2>Support & Infrastructure Manual</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4, marginBottom: 32 }}>Documentation parameters tracking engine execution matrices details.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 32 }}>
        {faqs.map((f, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: 16 }}>
            <strong style={{ fontSize: 16, display: "block", marginBottom: 6 }}>{f.q}</strong>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.a}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(15,23,42,0.02)", border: "1px solid var(--card-border)", padding: 24, borderRadius: 20, textAlign: "center" }}>
        <h4>Require Direct Infrastructure Diagnostics?</h4>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 16 }}>Reach operational coordination desks directly through instant WhatsApp link streams profiles.</p>
        <a href={`https://wa.me/${WA}?text=Hello%20MindDrill%20Support%20Core%20System`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: "none", padding: "12px 24px", borderRadius: 12, fontSize: 14 }}>Open WhatsApp Terminal Integration</a>
      </div>
    </div>
  );
}

/* ─── STRUCTURAL MODAL INSTANCE HANDLERS ────────────────────────────────── */
function CourseCreateModal({ close, _courseModalCallback, msg, user, tok }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return msg("Fill structural parameters", "error");
    setBusy(true);

    try {
      await db("courses", {
        method: "POST",
        body: JSON.stringify({ code: code.trim().toUpperCase(), title: title.trim(), created_by: user?.id })
      }, tok);
      msg("Course created!", "success");
      close();
      if (_courseModalCallback) _courseModalCallback();
    } catch (e) {
      msg(e.message, "error");
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", z-index: 9999, padding: 16 }}>
      <div className="card modal-box" style={{ maxWidth: 460, width: "100%", marginBottom: 0, background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
        <h3 style={{ fontSize: 24, marginBottom: 4 }}>Add Vault Stream</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>Introduce completely distinct examination modules databases headers parameters into open repositories lists.</p>

        <form onSubmit={save}>
          <Inp label="Vault Reference Code" value={code} onChange={setCode} placeholder="e.g., AFIT-GNS102" required />
          <Inp label="Vault Descriptive Title" value={title} onChange={setTitle} placeholder="e.g., Engineering Mathematics" required />

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary flex-1" style={{ padding: "12px" }} onClick={close}>Abort</button>
            <button type="submit" className="btn btn-primary flex-1" style={{ padding: "12px" }} disabled={busy}>
              {busy ? <Sp c="#fff" /> : "Deploy Vault Header"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── DESKTOP CONTEXT RESPONSIVE TIP BANNER ─────────────────────────────── */
function DesktopTipBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("md_desktop_tip_hidden")) return;
    if (window.innerWidth > 900) return;
    setTimeout(() => setShow(true), 1800);
  }, []);

  if (!show) return null;

  return (
    <div id="desktopTipBanner" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>Get the Full Experience</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>Open your browser menu and select <strong style={{ color: "#fff" }}>\"Request Desktop Site\"</strong> to see MindDrill in its full layout.</p>
        </div>
        <button onClick={() => setShow(false)} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>
      <button onClick={() => { localStorage.setItem("md_desktop_tip_hidden", "1"); setShow(false); }} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "none", color: "#64748b", borderRadius: 12, padding: "10px", fontSize: 12, fontWeight: 700, marginTop: 14, cursor: "pointer" }}>Don't show this notification again</button>
    </div>
  );
}
