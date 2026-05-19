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
  .btn-secondary { background: transparent; border: 1.5px solid var(--card-border); color: var(--text-dark); }
  .btn-secondary:hover { background: rgba(15,23,42,0.03); }
  .auth-wrapper { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; min-height: 100vh; background: var(--gradient-auth); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; overflow-y: auto; }
  .auth-card { background: #ffffff; width: 100%; max-width: 460px; border-radius: var(--radius-card); padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); }
  .auth-header { text-align: center; margin-bottom: 32px; }
  .auth-header h2 { font-size: 28px; }
  .auth-header p { color: var(--text-muted); margin-top: 8px; font-size: 14px; }
  .onboarding-container { max-width: 600px; margin: 40px auto; width: 100%; }
  .carousel-track { position: relative; height: 240px; overflow: hidden; margin-bottom: 32px; }
  .carousel-slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.6s ease; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .carousel-slide.slide-active { opacity: 1; }
  .carousel-slide h3 { font-size: 14px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .carousel-slide p { font-size: 20px; font-weight: 700; color: var(--text-dark); line-height: 1.5; }
  .carousel-dots { display: flex; justify-content: center; gap: 8px; margin-bottom: 32px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--card-border); transition: all 0.3s; }
  .dot.dot-active { width: 24px; border-radius: 4px; background: var(--primary-dark); }
  .dashboard-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 24px; }
  .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; }
  .stat-card .label { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
  .stat-card .value { font-size: 32px; font-weight: 800; margin-top: 8px; color: var(--text-dark); }
  .streak-fire { display: inline-block; animation: flicker 1s ease-in-out infinite alternate; }
  @keyframes flicker { 0% { transform: scale(1) rotate(-2deg); filter: drop-shadow(0 0 2px rgba(239,68,68,0.2)); } 100% { transform: scale(1.1) rotate(3deg); filter: drop-shadow(0 0 8px rgba(239,68,68,0.6)); } }
  .chart-container { height: 200px; display: flex; align-items: flex-end; gap: 16px; padding-top: 24px; border-bottom: 2px solid var(--card-border); }
  .chart-bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
  .chart-bar { width: 100%; max-width: 40px; background: var(--primary-dark); border-radius: 8px 8px 0 0; transition: height 0.6s ease; height: 0; }
  .chart-label { font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 8px; }
  .courses-header-meta { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; }
  .course-list-container { display: flex; flex-direction: column; gap: 16px; }
  .course-horizontal-card { display: flex; align-items: center; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; overflow: hidden; padding: 12px 24px 12px 12px; transition: box-shadow 0.2s; }
  .course-horizontal-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
  .course-code-badge { background: #0f172a; color: #ffffff; font-weight: 800; font-size: 16px; padding: 20px 24px; border-radius: 14px; min-width: 120px; text-align: center; }
  .course-details-mid { flex: 1; padding-left: 24px; }
  .course-title-text { font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
  .course-count-text { font-size: 13px; color: var(--text-muted); font-weight: 500; }
  .course-pill-dashed { border: 2px dashed var(--text-muted); border-radius: var(--radius-pill); padding: 16px; text-align: center; font-weight: 700; color: var(--text-muted); cursor: pointer; }
  .timer-inputs-wrapper { display: flex; gap: 12px; margin-top: 12px; }
  .timer-field-box { display: flex; flex-direction: column; align-items: center; }
  .timer-field-box label { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; }
  .timer-num-input { width: 80px; padding: 12px; text-align: center; font-size: 18px; font-weight: 700; border-radius: 12px; border: 1px solid var(--card-border); }
  .session-top-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .question-dark-card { background: var(--card-bg); color: var(--text-dark); border: 1.5px solid var(--card-border); border-radius: var(--radius-card); padding: 40px; font-size: 20px; font-weight: 600; line-height: 1.6; margin-bottom: 32px; box-shadow: 0 4px 20px rgba(15,23,42,0.04); }
  .options-vertical-stack { display: flex; flex-direction: column; gap: 14px; margin-bottom: 32px; }
  .option-pill-btn { width: 100%; padding: 20px 28px; border-radius: var(--radius-pill); border: 1px solid var(--card-border); background: #ffffff; text-align: left; font-size: 16px; font-weight: 600; color: var(--text-dark); cursor: pointer; transition: all 0.2s; }
  .option-pill-btn:hover:not(:disabled) { background: rgba(15,23,42,0.02); }
  .option-pill-btn:disabled { cursor: default; }
  .option-pill-btn.selected-test { border-color: var(--primary-dark); background: rgba(15,23,42,0.05); }
  .option-pill-btn.correct-highlight { background-color: var(--accent-green) !important; border-color: var(--accent-green-border) !important; }
  .option-pill-btn.wrong-highlight { background-color: var(--accent-red) !important; border-color: var(--accent-red-border) !important; }
  .ai-explanation-box { background: var(--accent-green); border-left: 4px solid var(--accent-green-border); padding: 24px; border-radius: 16px; margin-bottom: 32px; }
  .ai-explanation-box h4 { font-size: 14px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ai-explanation-box p { font-size: 15px; color: var(--text-dark); line-height: 1.5; }
  .navigator-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 8px; margin-top: 24px; }
  .nav-matrix-cell { height: 40px; border-radius: 8px; background: #ffffff; border: 1px solid var(--card-border); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer; }
  .nav-matrix-cell.answered { background: var(--primary-dark); color: #ffffff; }
  .nav-matrix-cell.flagged { border: 2px solid #ef4444; color: #ef4444; }
  .results-hero-panel { text-align: center; padding: 48px 24px; }
  .score-big-text { font-size: 72px; font-weight: 900; line-height: 1; }
  .grade-badge-letter { font-size: 28px; font-weight: 800; margin-top: 8px; }
  .accordion-item { border-bottom: 1px solid var(--card-border); padding: 16px 0; }
  .accordion-trigger { display: flex; justify-content: space-between; align-items: center; font-weight: 700; cursor: pointer; }
  .accordion-content { padding-top: 12px; color: var(--text-muted); font-size: 14px; line-height: 1.6; }
  .global-footer-badge { text-align: center; padding: 24px; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-top: auto; text-transform: uppercase; letter-spacing: 0.5px; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 900; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  .modal-box { background: #ffffff; border-radius: 28px; padding: 40px 36px; width: 100%; max-width: 460px; box-shadow: 0 24px 64px rgba(15,23,42,0.18); position: relative; animation: modalUp 0.25s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes modalUp { from { opacity:0; transform:translateY(24px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
  .modal-close-x { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: var(--bg-app); border: 1px solid var(--card-border); cursor: pointer; font-size: 15px; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
  .modal-close-x:hover { background: var(--primary-dark); color: #fff; }
  .g-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.3); transition: all 0.3s; }
  .g-dot.g-dot-active { width: 22px; border-radius: 4px; background: #fff; }
  .mob-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--card-bg); backdrop-filter: blur(16px); border-top: 1px solid var(--card-border); z-index: 800; padding: 10px 0 env(safe-area-inset-bottom, 10px); }
  .mob-nav-row { display: flex; justify-content: space-around; align-items: center; }
  .mob-nav-item { display: flex; flex-direction: column; align-items: center; padding: 6px 12px; cursor: pointer; border: none; background: none; -webkit-tap-highlight-color: transparent; border-radius: 10px; transition: background 0.15s; }
  .mob-nav-item:active { background: rgba(15,23,42,0.05); }
  .mob-nav-label { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.3px; text-transform: uppercase; transition: color 0.15s; }
  .mob-nav-item.mn-active .mob-nav-label { color: var(--primary-dark); }
  @media (max-width: 767px) {
    .mob-nav { display: block; }
    body { padding-bottom: 70px; }
    .top-navbar { display: none !important; }
    .view-container { padding: 16px 14px 20px; }
    .card { padding: 20px 16px; border-radius: 20px; margin-bottom: 14px; }
    h1 { font-size: 21px; } h2 { font-size: 18px; } h3 { font-size: 16px; }
    .auth-card { padding: 28px 20px; border-radius: 20px; }
    .auth-header h2 { font-size: 22px; }
    .onboarding-container { margin: 12px auto; }
    .carousel-track { height: 180px; margin-bottom: 20px; }
    .carousel-slide p { font-size: 16px; }
    .dashboard-grid { grid-template-columns: 1fr 1fr !important; gap: 10px; margin-top: 14px; }
    .stat-card { padding: 16px 14px; border-radius: 14px; }
    .stat-card .value { font-size: 26px; }
    .courses-header-meta { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
    .course-horizontal-card { padding: 10px 14px 10px 10px; border-radius: 14px; }
    .course-code-badge { padding: 14px 16px; min-width: 72px; font-size: 13px; border-radius: 10px; }
    .course-details-mid { padding-left: 12px; }
    .course-title-text { font-size: 14px; }
    .question-dark-card { padding: 22px 18px; font-size: 16px; border-radius: 20px; margin-bottom: 20px; }
    .option-pill-btn { padding: 15px 18px; font-size: 14px; }
    .options-vertical-stack { gap: 10px; margin-bottom: 20px; }
    .session-top-meta { margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
    .results-hero-panel { padding: 32px 16px; }
    .score-big-text { font-size: 56px; }
    .navigator-grid { grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 6px; }
    .nav-matrix-cell { height: 36px; font-size: 12px; }
    .timer-num-input { width: 66px; font-size: 16px; }
    .modal-box { padding: 28px 20px; border-radius: 20px; }
  }
  @media (min-width: 768px) {
    .top-navbar { display: flex; }
    .mob-nav { display: none !important; }
    body { padding-bottom: 0; }
  }
  @media (max-width: 400px) {
    .dashboard-grid { grid-template-columns: 1fr !important; }
    h1 { font-size: 19px; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 20px; height: 20px; border: 2.5px solid #e2e8f0; border-top-color: #0f172a; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  #desktopTipBanner { display: none; position: fixed; bottom: 82px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 480px; background: #0f172a; color: #fff; border-radius: 20px; padding: 18px 20px; z-index: 700; box-shadow: 0 8px 32px rgba(15,23,42,0.28); animation: modalUp 0.3s ease; }
`;

/* ─── SEARCHABLE DROPDOWN COMPONENT ─────────────────────────────────────── */
function SearchDropdown({ id, dropId, items, value, onChange, placeholder }) {
  const [q, setQ] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const filtered = q.length > 1 ? items.filter(i => i.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input id={id} className="form-input" value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder} />
      {open && filtered.length > 0 && (
        <div id={dropId} className="dropdown-search-results" style={{ display: "block" }}>
          {filtered.map(item => (
            <div key={item} className="dropdown-item" onMouseDown={() => { onChange(item); setQ(item); setOpen(false); }}>{item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ROOT APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const [view,  setView]  = useState("auth");
  const [user,  setUser]  = useState(null);
  const [tok,   setTok]   = useState(null);
  const [ctx,   setCtx]   = useState({});
  const [toast, setToast] = useState(null);

  const msg = useCallback((m, type = "info") => { setToast({ m, type }); setTimeout(() => setToast(null), 3500); }, []);

  const go = useCallback((v, data = {}) => {
    setCtx(data); setView(v); window.scrollTo(0, 0);
    // sync mob nav
    ["home","courses","analytics","profile","help"].forEach(t => {
      const el = document.getElementById("mn-" + t);
      if (el) el.classList.toggle("mn-active", t === v || (t === "analytics" && v === "analytics"));
    });
    // sync top navbar
    ["home","courses","analytics","profile","admin","help"].forEach(t => {
      const el = document.getElementById("nav-link-" + t);
      if (el) el.classList.toggle("active", t === v);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const t = localStorage.getItem("md_t"), u = localStorage.getItem("md_u");
      if (!t || !u || t.split(".").length !== 3) { localStorage.removeItem("md_t"); localStorage.removeItem("md_u"); return; }
      try {
        const fresh = await verifyTok(t);
        setTok(t); setUser(fresh);
        const meta = fresh.user_metadata || {};
        showNav(fresh.email === ADMIN);
        go(!meta.onboarded ? "onboarding" : "home");
      } catch { localStorage.removeItem("md_t"); localStorage.removeItem("md_u"); }
    })();
  }, []);

  const showNav = (isAdmin) => {
    const nb = document.getElementById("globalNavbar"); if (nb) nb.style.display = "flex";
    const mn = document.getElementById("mobBottomNav"); if (mn) mn.style.display = "block";
    const al = document.getElementById("nav-link-admin"); if (al) al.style.display = isAdmin ? "block" : "none";
  };

  const hideNav = () => {
    const nb = document.getElementById("globalNavbar"); if (nb) nb.style.display = "none";
    const mn = document.getElementById("mobBottomNav"); if (mn) mn.style.display = "none";
  };

  const storeAuth = (data) => {
    const t = data.access_token;
    if (!t || t.split(".").length !== 3) throw new Error("Invalid session. Try again.");
    localStorage.setItem("md_t", t); localStorage.setItem("md_u", JSON.stringify(data.user));
    setTok(t); setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("md_t"); localStorage.removeItem("md_u");
    setUser(null); setTok(null); hideNav(); go("auth");
  };

  const p = { user, tok, go, msg, ctx, logout, storeAuth, showNav };

  return (
    <>
      <style>{STYLES}</style>

      {/* Top navbar */}
      <nav className="top-navbar" id="globalNavbar" style={{ display: "none" }}>
        <div className="nav-brand" onClick={() => go("home")}>MindDrill</div>
        <div className="nav-links">
          <div className="nav-item" id="nav-link-home"      onClick={() => go("home")}>Home</div>
          <div className="nav-item" id="nav-link-courses"   onClick={() => go("courses")}>Courses</div>
          <div className="nav-item" id="nav-link-analytics" onClick={() => go("analytics")}>Analytics</div>
          <div className="nav-item" id="nav-link-profile"   onClick={() => go("profile")}>Profile</div>
          <div className="nav-item" id="nav-link-admin"     onClick={() => go("admin")} style={{ display: "none" }}>Admin</div>
          <div className="nav-item" id="nav-link-help"      onClick={() => go("help")}>Help</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="nav-avatar" id="userHeaderAvatar" onClick={() => go("profile")}>MD</div>
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? "#ef4444" : toast.type === "success" ? "#22c55e" : "#0f172a", color: "#fff", borderRadius: 50, padding: "12px 24px", fontSize: 14, fontWeight: 700, zIndex: 9999, maxWidth: "90vw", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", animation: "modalUp 0.3s ease" }}>
          {toast.m}
        </div>
      )}

      {/* View container */}
      <div className="view-container">
        <section className={`app-view${view === "auth"       ? " active-view" : ""}`} id="view-auth">      <AuthView {...p} /></section>
        <section className={`app-view${view === "onboarding" ? " active-view" : ""}`} id="view-onboarding"><OnboardView {...p} /></section>
        <section className={`app-view${view === "home"       ? " active-view" : ""}`} id="view-home">      <HomeView {...p} /></section>
        <section className={`app-view${view === "courses"    ? " active-view" : ""}`} id="view-courses">   <CoursesView {...p} /></section>
        <section className={`app-view${view === "setup"      ? " active-view" : ""}`} id="view-setup">     <SetupView {...p} /></section>
        <section className={`app-view${view === "session"    ? " active-view" : ""}`} id="view-session">   <SessionView {...p} /></section>
        <section className={`app-view${view === "results"    ? " active-view" : ""}`} id="view-results">   <ResultsView {...p} /></section>
        <section className={`app-view${view === "analytics"  ? " active-view" : ""}`} id="view-analytics"> <AnalyticsView {...p} /></section>
        <section className={`app-view${view === "profile"    ? " active-view" : ""}`} id="view-profile">   <ProfileView {...p} /></section>
        <section className={`app-view${view === "admin"      ? " active-view" : ""}`} id="view-admin">     <AdminView {...p} /></section>
        <section className={`app-view${view === "help"       ? " active-view" : ""}`} id="view-help">      <HelpView {...p} /></section>
        <section className={`app-view${view === "upload"     ? " active-view" : ""}`} id="view-upload">    <UploadView {...p} /></section>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mob-nav" id="mobBottomNav" style={{ display: "none" }}>
        <div className="mob-nav-row">
          {[["home","Home"],["courses","Courses"],["analytics","Analytics"],["profile","Profile"],["help","Help"]].map(([id, lb]) => (
            <button key={id} className={`mob-nav-item${view === id ? " mn-active" : ""}`} id={`mn-${id}`} onClick={() => go(id)}>
              <span className="mob-nav-label">{lb}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Modals */}
      <CourseModal go={p.go} user={p.user} tok={p.tok} msg={p.msg} />
      <UserGuideModal />
      <TimerWarningOverlay />
      <DesktopTipBanner />

      <footer className="global-footer-badge">Product of Open Innovative Intelligence</footer>
    </>
  );
}

/* ─── AUTH ───────────────────────────────────────────────────────────────── */
function AuthView({ go, msg, storeAuth, showNav }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [pw, setPw]   = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !pw) return msg("Fill in all fields", "error");
    setBusy(true);
    try {
      const data = await authCall("token?grant_type=password", { email: email.trim(), password: pw });
      const u = storeAuth(data);
      const meta = u.user_metadata || {};
      const isAdmin = u.email === ADMIN;
      showNav(isAdmin);
      const initials = (meta.full_name || u.email.split("@")[0]).substring(0, 2).toUpperCase();
      const av = document.getElementById("userHeaderAvatar"); if (av) av.innerText = initials;
      go(!meta.onboarded ? "onboarding" : "home");
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !pw) return msg("Fill in all fields", "error");
    if (pw.length < 6) return msg("Password needs at least 6 characters", "error");
    setBusy(true);
    try {
      const data = await authCall("signup", { email: email.trim(), password: pw, data: { full_name: name.trim() } });
      if (!data.access_token) { msg("Account created! Check your email to confirm, then sign in.", "success"); setMode("login"); setBusy(false); return; }
      const u = storeAuth(data);
      showNav(u.email === ADMIN);
      const initials = name.substring(0, 2).toUpperCase();
      const av = document.getElementById("userHeaderAvatar"); if (av) av.innerText = initials;
      go("onboarding");
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };

  const handleForgot = async () => {
    if (!email.trim()) return msg("Enter your email address first", "error");
    try {
      await fetch(`${SB}/auth/v1/recover`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      msg("Password reset link sent to your email!", "success");
    } catch { msg("Failed to send reset email", "error"); }
  };

  return (
    <div className="auth-wrapper">
      {mode === "login" ? (
        <div className="auth-card">
          <div className="auth-header">
            <h2>Welcome to MindDrill</h2>
            <p>Sign in to continue your master tracks</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group"><label>Email Address</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@domain.com" /></div>
            <div className="input-group"><label>Password</label><input type="password" className="form-input" value={pw} onChange={e => setPw(e.target.value)} required placeholder="••••••••" /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24, fontSize: 14, fontWeight: 600 }}>
              <span style={{ color: "var(--text-muted)", cursor: "pointer" }} onClick={handleForgot}>Forgot password?</span>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: 18 }} disabled={busy}>
              {busy ? <span className="spinner" /> : "Sign In"}
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 14, fontWeight: 600, marginTop: 24, color: "var(--text-muted)" }}>
            New student? <span style={{ color: "var(--text-dark)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setMode("signup")}>Create an account</span>
          </p>
        </div>
      ) : (
        <div className="auth-card">
          <div className="auth-header">
            <h2>Create Account</h2>
            <p>Join thousands of Nigerian university students</p>
          </div>
          <form onSubmit={handleSignup}>
            <div className="input-group"><label>Full Name</label><input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="Chidi Obi" /></div>
            <div className="input-group"><label>Email Address</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required placeholder="student@unilag.edu.ng" /></div>
            <div className="input-group"><label>Password</label><input type="password" className="form-input" value={pw} onChange={e => setPw(e.target.value)} required minLength={6} placeholder="Min 6 characters" /></div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: 18 }} disabled={busy}>
              {busy ? <span className="spinner" /> : "Create Account"}
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 14, fontWeight: 600, marginTop: 24, color: "var(--text-muted)" }}>
            Already registered? <span style={{ color: "var(--text-dark)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setMode("login")}>Login instead</span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── ONBOARDING ─────────────────────────────────────────────────────────── */
function OnboardView({ user, tok, go, msg }) {
  const [inst, setInst] = useState(""); const [prog, setProg] = useState(""); const [busy, setBusy] = useState(false);
  const [slide, setSlide] = useState(0);
  const slides = [
    { title: "Our Vision", body: '"To become the most trusted AI-powered study companion for every Nigerian student."' },
    { title: "Our Mission", body: '"Provide a free, intelligent platform that transforms difficult topics into mastered skills."' },
    { title: "Product Philosophy", body: '"Open Innovative Intelligence — built with relentless focus on simplicity, effectiveness, and student success."' },
    { title: "Daily Motivation", body: '"Success is the sum of small efforts, repeated day in and day out."' },
  ];
  useEffect(() => { const t = setInterval(() => setSlide(s => (s + 1) % slides.length), 4000); return () => clearInterval(t); }, []);

  const complete = async () => {
    if (!inst.trim() || !prog.trim()) return msg("Please fill in your institution and programme", "error");
    setBusy(true);
    try {
      const meta = user?.user_metadata || {};
      await fetch(`${SB}/auth/v1/user`, { method: "PUT", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { ...meta, institution: inst, programme: prog, onboarded: true } }) });
      const updated = { ...user, user_metadata: { ...meta, institution: inst, programme: prog, onboarded: true } };
      localStorage.setItem("md_u", JSON.stringify(updated));
      setTimeout(() => openUserGuide(), 600);
      go("home");
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };

  return (
    <div className="card onboarding-container">
      <div className="carousel-track">
        {slides.map((s, i) => (
          <div key={i} className={`carousel-slide${slide === i ? " slide-active" : ""}`}>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
      <div className="carousel-dots">
        {slides.map((_, i) => <div key={i} className={`dot${slide === i ? " dot-active" : ""}`} />)}
      </div>
      <div className="input-group">
        <label>Your Institution</label>
        <SearchDropdown id="onboardInstInput" dropId="onboardInstDrop" items={UNIVERSITIES_LIST} value={inst} onChange={setInst} placeholder="Type to filter Nigerian Institutions..." />
      </div>
      <div className="input-group">
        <label>Your Programme / Discipline</label>
        <SearchDropdown id="onboardProgInput" dropId="onboardProgDrop" items={PROGRAMMES_LIST} value={prog} onChange={setProg} placeholder="Type to filter Programmes..." />
      </div>
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={complete} disabled={busy}>
        {busy ? <span className="spinner" /> : "Continue to Dashboard"}
      </button>
    </div>
  );
}

/* ─── HOME ───────────────────────────────────────────────────────────────── */
function HomeView({ user, tok, go, msg }) {
  const [stats,   setStats]   = useState({ sessions: 0, avg: 0, best: 0, streak: 0 });
  const [chart,   setChart]   = useState([]);
  const [recs,    setRecs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [sess, courses] = await Promise.all([
        db(`sessions?user_id=eq.${user.id}&order=created_at.desc&limit=50`, {}, tok),
        db("courses?select=*&order=title.asc", {}, tok),
      ]);
      const s = sess || []; const c = courses || [];
      if (s.length) {
        const avg = Math.round(s.reduce((a, x) => a + (x.percentage || 0), 0) / s.length);
        const best = Math.max(...s.map(x => x.percentage || 0));
        let streak = 0;
        const today = new Date(); today.setHours(0,0,0,0);
        const days = new Set(s.map(x => new Date(x.created_at).toDateString()));
        for (let i = 0; i < 365; i++) { const d = new Date(today); d.setDate(d.getDate()-i); if(days.has(d.toDateString()))streak++; else if(i>0)break; }
        setStats({ sessions: s.length, avg, best, streak });
        setChart(s.slice(-7).reverse());
      }
      setRecs(c.slice(0, 2));
    } catch {}
    setLoading(false);
  };

  const meta  = user?.user_metadata || {};
  const name  = meta.full_name || user?.email?.split("@")[0] || "Student";
  const tip   = ROTATING_TIPS[new Date().getDate() % ROTATING_TIPS.length];
  const goals = stats.sessions >= 3 ? "Weekly targets matched! Maintain your momentum." : `Completed ${stats.sessions}/3 sessions this week.`;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1>Welcome back, {name.split(" ")[0]}!</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>Let's drill down into your courses today.</p>
        </div>
        <button className="btn btn-primary" onClick={() => go("courses")}>Start a Drill</button>
      </div>

      <div className="dashboard-grid">
        {[{l:"Sessions Completed",v:stats.sessions},{l:"Average Score",v:`${stats.avg}%`},{l:"Best Score",v:`${stats.best}%`},{l:"Current Streak",v:<>{stats.streak} <span className="streak-fire">🔥</span></>}].map(s=>(
          <div key={s.l} className="stat-card"><span className="label">{s.l}</span><span className="value">{s.v}</span></div>
        ))}
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Recent Activity</h3>
          <div className="chart-container">
            {(chart.length ? chart : Array(7).fill({ percentage: 0, course_code: "-" })).map((s, i) => (
              <div key={i} className="chart-bar-wrapper">
                <div className="chart-bar" style={{ height: `${s.percentage || 0}%` }} />
                <span className="chart-label">{s.course_code || "-"}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ marginBottom: 0, padding: 24, flex: 1 }}>
            <h4 style={{ fontSize: 14, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Study Tip of the Day</h4>
            <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{tip}</p>
          </div>
          <div className="card" style={{ marginBottom: 0, padding: 24, flex: 1 }}>
            <h4 style={{ fontSize: 14, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Upcoming Goals</h4>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{goals}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Recommended For You</h3>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {recs.map(c => (
              <div key={c.id} style={{ padding: 16, background: "#ffffff", border: "1px solid var(--card-border)", borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><strong style={{ fontSize: 14, display: "block" }}>{c.code}</strong><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.title}</span></div>
                <button className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => go("setup", { course: c })}>Explore</button>
              </div>
            ))}
            {!recs.length && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload questions to courses to see recommendations.</p>}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Quick Utility Actions</h3>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button className="btn btn-secondary" style={{ padding: 14, fontSize: 13 }} onClick={() => go("upload")}>Upload Questions</button>
            <button className="btn btn-secondary" style={{ padding: 14, fontSize: 13 }} onClick={() => go("upload")}>Submit Entry</button>
            <button className="btn btn-secondary" style={{ padding: 14, fontSize: 13 }} onClick={() => go("help")}>Get Support Help</button>
            <button className="btn btn-secondary" style={{ padding: 14, fontSize: 13 }} onClick={() => openUserGuide()}>Quick User Guide</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── COURSES ────────────────────────────────────────────────────────────── */
function CoursesView({ user, tok, go, msg }) {
  const [courses, setCourses] = useState([]); const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const ex = await db("courses?select=code", {}, tok) || [];
      const exSet = new Set(ex.map(c => c.code));
      for (const c of SEEDS) {
        if (!exSet.has(c.code)) await db("courses", { method: "POST", body: JSON.stringify({ code: c.code, title: c.title, created_by: user.id }) }, tok).catch(() => {});
      }
      const all  = await db("courses?select=*&order=title.asc", {}, tok) || [];
      const qs   = await db("questions?select=course_id", {}, tok) || [];
      const cm   = {}; qs.forEach(q => { cm[q.course_id] = (cm[q.course_id] || 0) + 1; });
      setCourses(all.map(c => ({ ...c, qCount: cm[c.id] || 0 })));
    } catch (e) { msg("Failed to load: " + e.message, "error"); }
    setLoading(false);
  };

  const del = async (c) => {
    if (!window.confirm(`Delete "${c.title}"? All questions will be lost.`)) return;
    try { await db(`courses?id=eq.${c.id}`, { method: "DELETE" }, tok); msg("Course deleted", "success"); load(); }
    catch (e) { msg(e.message, "error"); }
  };

  const filtered = courses.filter(c => c.code.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="courses-header-meta">
        <div>
          <h2 style={{ fontSize: 28 }}>Available Study Vaults</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>{courses.length} course tracks registered</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input className="form-input" style={{ maxWidth: 280, padding: "10px 16px" }} placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" style={{ padding: "12px 24px", whiteSpace: "nowrap" }} onClick={() => openCourseModal(load)}>+ New Course</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
      ) : (
        <div className="course-list-container">
          {filtered.map(c => (
            <div key={c.id} className="course-horizontal-card">
              <div className="course-code-badge">{c.code}</div>
              <div className="course-details-mid">
                <div className="course-title-text">{c.title}</div>
                <div className="course-count-text">{c.qCount} questions in vault</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 13 }} onClick={() => go("setup", { course: c })}>Start</button>
                {user?.email === ADMIN && (
                  <button className="btn btn-secondary" style={{ padding: "12px 16px", fontSize: 13, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => del(c)}>Delete</button>
                )}
              </div>
            </div>
          ))}
          <div className="course-pill-dashed" onClick={() => openCourseModal(load)}>+ Add New Course Vault</div>
          {!filtered.length && courses.length > 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>No courses match your search.</p>}
        </div>
      )}
    </>
  );
}

/* ─── SETUP ──────────────────────────────────────────────────────────────── */
function SetupView({ go, msg, ctx }) {
  const course = ctx.course;
  const [mode, setMode] = useState("test");
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(false);
  const [hh, setHh] = useState(0); const [mm, setMm] = useState(30); const [ss, setSs] = useState(0);
  if (!course) return null;
  return (
    <div className="card" style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
      <h2 style={{ marginBottom: 8 }}>{course.title}</h2>
      <p style={{ color: "var(--text-muted)", fontWeight: 600, marginBottom: 24 }}>Target Core: {course.code}</p>

      <div className="input-group">
        <label>Select Study Mode</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {[["test","Test Mode","Simulated grading environment. No intermediate clues. Evaluated on finish."],
            ["study","Study Mode","Real-time immediate feedback with on-the-spot AI explanations."],
            ["practice","Practice Mode","Mastery builder. Wrong questions reappear until cleared."]].map(([val, title, desc]) => (
            <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, border: "1px solid var(--card-border)", borderRadius: 16, cursor: "pointer" }}>
              <input type="radio" name="drillMode" value={val} checked={mode === val} onChange={() => setMode(val)} style={{ marginTop: 4 }} />
              <div><strong style={{ display: "block", fontSize: 15 }}>{title}</strong><span style={{ fontSize: 13, color: "var(--text-muted)" }}>{desc}</span></div>
            </label>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label>Number of Questions</label>
        <input type="number" className="form-input" value={count} onChange={e => setCount(parseInt(e.target.value) || 10)} style={{ marginTop: 8 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 4 }}>{course.qCount || "?"} questions available in this vault</span>
      </div>

      {mode === "test" && (
        <div className="input-group">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} /> Enable Clock Countdown Timer
          </label>
          {timed && (
            <div className="timer-inputs-wrapper">
              {[["Hours", hh, setHh], ["Minutes", mm, setMm], ["Seconds", ss, setSs]].map(([lb, val, set]) => (
                <div key={lb} className="timer-field-box"><label>{lb}</label><input type="number" className="timer-num-input" value={String(val).padStart(2,"0")} onChange={e => set(parseInt(e.target.value) || 0)} /></div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => go("courses")}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => go("session", { course, mode, count, timed, totalSecs: (hh * 3600) + (mm * 60) + ss })}>
          Launch Session Drill
        </button>
      </div>
    </div>
  );
}

/* ─── SESSION ────────────────────────────────────────────────────────────── */
function SessionView({ user, tok, go, msg, ctx }) {
  const { course, mode, count, timed, totalSecs } = ctx;
  const [questions, setQs]     = useState([]);
  const [cur,       setCur]    = useState(0);
  const [answers,   setAnswers]= useState({});
  const [flags,     setFlags]  = useState(new Set());
  const [timeLeft,  setTLeft]  = useState(null);
  const [elapsed,   setElapsed]= useState(0);
  const [loading,   setLoading]= useState(true);
  const [aiNote,    setAiNote] = useState("AI is selecting your questions...");
  const [expState,  setExpState]= useState({}); // {idx: {show, text, loading}}
  // Practice queue
  const [pQueue, setPQ] = useState([]); const [pIdx, setPI] = useState(0); const [mastered, setMastered] = useState(0);
  const tmr = useRef(null); const elTmr = useRef(null); const tmrOn = useRef(false);

  useEffect(() => { if (course) load(); return () => { clearTimeout(tmr.current); clearInterval(elTmr.current); }; }, []);

  useEffect(() => {
    if (timed && mode === "test" && timeLeft === null && questions.length && !tmrOn.current) {
      tmrOn.current = true; setTLeft(totalSecs || 1800);
    }
  }, [questions]);

  useEffect(() => {
    if (timed && mode === "test" && timeLeft !== null) {
      if (timeLeft === 300) showTimerWarning();
      if (timeLeft <= 0) { finish(answers); return; }
      tmr.current = setTimeout(() => setTLeft(v => v - 1), 1000);
      return () => clearTimeout(tmr.current);
    }
  }, [timeLeft]);

  useEffect(() => { elTmr.current = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(elTmr.current); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const all = await db(`questions?course_id=eq.${course.id}&select=*`, {}, tok) || [];
      if (!all.length) { msg("No questions in this vault yet. Upload some first!", "error"); go("courses"); return; }
      let recentIds = [];
      try { const rec = await db(`sessions?user_id=eq.${user.id}&course_id=eq.${course.id}&order=created_at.desc&limit=3&select=question_ids`, {}, tok) || []; recentIds = rec.flatMap(s => s.question_ids || []); } catch {}
      let picked = [];
      try {
        const pool = all.map((q, i) => `${i}:${q.id}`).join(",");
        const res = await aiCall(`Select ${Math.min(count, all.length)} question indices from pool of ${all.length}.\nPool: ${pool}\nRecently seen: ${recentIds.slice(-15).join(",")}\nReturn ONLY comma-separated indices.`);
        const indices = [...new Set((res.match(/\d+/g)||[]).map(Number).filter(n=>n>=0&&n<all.length))];
        picked = indices.slice(0, count).map(i => all[i]);
        if (picked.length < Math.min(count, all.length)) { const used = new Set(indices.slice(0,count)); const extra = all.filter((_,i)=>!used.has(i)).sort(()=>Math.random()-.5); picked=[...picked,...extra.slice(0,Math.min(count,all.length)-picked.length)]; }
      } catch { picked = all.sort(() => Math.random() - .5).slice(0, Math.min(count, all.length)); }
      setQs(picked);
      if (mode === "practice") setPQ([...picked]);
    } catch (e) { msg("Error: " + e.message, "error"); }
    setLoading(false);
  };

  const curQ = mode === "practice" ? pQueue[pIdx] : questions[cur];

  const handleOption = async (letter) => {
    const q = curQ;
    if (mode === "test") {
      setAnswers(a => ({ ...a, [cur]: letter }));
      setTimeout(() => navigateQ(1), 300);
    } else {
      if (answers[mode === "practice" ? pIdx : cur]) return;
      const key = mode === "practice" ? pIdx : cur;
      setAnswers(a => ({ ...a, [key]: letter }));
      const isCorrect = letter === q.answer;
      if (mode === "practice" && !isCorrect) setPQ(pq => { const n = [...pq]; n.push({ ...q }); return n; });
      // Show explanation
      const expKey = mode === "practice" ? pIdx : cur;
      if (mode === "study" || (mode === "practice" && !isCorrect)) {
        if (q.reference) {
          setExpState(es => ({ ...es, [expKey]: { show: true, text: q.reference, loading: false } }));
        } else {
          setExpState(es => ({ ...es, [expKey]: { show: true, text: "", loading: true } }));
          const exp = await aiCall(`Explain in 3-4 sentences why the correct answer is ${q.answer}.\nQ: ${q.question}\nA.${q.A} B.${q.B} C.${q.C} D.${q.D}\nCorrect: ${q.answer}. ${q[q.answer]}`);
          setExpState(es => ({ ...es, [expKey]: { show: true, text: exp, loading: false } }));
        }
      } else if (mode === "practice" && isCorrect) {
        setExpState(es => ({ ...es, [expKey]: { show: true, text: "SHOW_WHY", loading: false } }));
      }
    }
  };

  const fetchAIForKey = async (expKey, q) => {
    setExpState(es => ({ ...es, [expKey]: { ...es[expKey], loading: true, text: "" } }));
    const exp = await aiCall(`Explain clearly in 3-4 sentences why the correct answer is ${q.answer}.\nQ: ${q.question}\nA.${q.A} B.${q.B} C.${q.C} D.${q.D}\nCorrect: ${q.answer}. ${q[q.answer]}`);
    setExpState(es => ({ ...es, [expKey]: { show: true, text: exp, loading: false } }));
  };

  const navigateQ = (dir) => {
    if (mode === "practice") {
      const ok = answers[pIdx] === curQ?.answer;
      if (ok) {
        setMastered(m => m + 1);
        const nq = [...pQueue]; nq.splice(pIdx, 1);
        if (!nq.length) { clearInterval(elTmr.current); go("results", { course, mode, questions, answers, score: questions.length, total: questions.length, masteredAll: true, elapsed }); return; }
        setPQ(nq); if (pIdx >= nq.length) setPI(0);
      } else { setPI(p => p >= pQueue.length - 1 ? 0 : p + 1); }
      setExpState({});
    } else {
      const target = cur + dir;
      if (target >= questions.length) { clearInterval(elTmr.current); finish(answers); }
      else if (target >= 0) { setCur(target); setExpState({}); }
    }
  };

  const finish = (fa) => {
    clearTimeout(tmr.current); clearInterval(elTmr.current);
    const score = questions.filter((q, i) => fa[i] === q.answer).length;
    go("results", { course, mode, questions, answers: fa, score, total: questions.length, timed, totalSecs, timeLeft, elapsed, flags: [...flags] });
  };

  const fmtT = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`; };

  if (loading || !course) return <div style={{ textAlign: "center", padding: 48 }}><span className="spinner" style={{ width: 40, height: 40 }} /><p style={{ marginTop: 16, color: "var(--text-muted)", fontWeight: 600 }}>{aiNote}</p></div>;
  if (!curQ) return null;

  const progress = mode === "practice" ? (mastered / Math.max(questions.length, 1)) * 100 : ((cur + 1) / questions.length) * 100;
  const qLabel = mode === "practice" ? `${mastered}/${questions.length} mastered` : `Question ${cur + 1} of ${questions.length}`;
  const expKey = mode === "practice" ? pIdx : cur;
  const exp = expState[expKey];
  const answered = mode === "practice" ? answers[pIdx] : answers[cur];
  const isFlagged = flags.has(cur);

  return (
    <>
      <div className="session-top-meta">
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{qLabel}</span>
          <div style={{ width: 180, height: 6, background: "var(--card-border)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--primary-dark)", transition: "width 0.3s" }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {timed && mode === "test" && timeLeft !== null && (
            <div style={{ fontSize: 18, fontWeight: 800, color: timeLeft < 300 ? "#ef4444" : "var(--text-dark)", background: "rgba(15,23,42,0.05)", padding: "8px 16px", borderRadius: 12 }}>
              {fmtT(timeLeft)}
            </div>
          )}
          <button className="btn btn-secondary" style={{ padding: "10px 16px", fontSize: 13, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={() => { if (window.confirm("Quit this drill session?")) { clearTimeout(tmr.current); clearInterval(elTmr.current); go("home"); } }}>Quit Drill</button>
        </div>
      </div>

      <div className="question-dark-card">{curQ.question}</div>

      <div className="options-vertical-stack">
        {["A","B","C","D"].map(letter => {
          let cls = "option-pill-btn";
          if (mode === "test") { if (answered === letter) cls += " selected-test"; }
          else if (answered) {
            if (letter === curQ.answer) cls += " correct-highlight";
            else if (answered === letter) cls += " wrong-highlight";
          }
          return (
            <button key={letter} className={cls} disabled={mode !== "test" && !!answered} onClick={() => handleOption(letter)}>
              {letter}. {curQ[letter]}
            </button>
          );
        })}
      </div>

      {exp?.show && (
        <div className="ai-explanation-box">
          <h4>Explanation</h4>
          {exp.text === "SHOW_WHY" ? (
            <button className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: 13 }} onClick={() => fetchAIForKey(expKey, curQ)}>Show Explanation</button>
          ) : exp.loading ? (
            <p><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }} />Fetching AI explanation...</p>
          ) : (
            <div>
              <p style={{ marginBottom: curQ.reference ? 12 : 0 }}>{exp.text}</p>
              {curQ.reference && exp.text !== curQ.reference && <p>{curQ.reference}</p>}
              <button className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: 12, marginTop: 8 }} onClick={() => fetchAIForKey(expKey, curQ)}>Also ask AI</button>
            </div>
          )}
        </div>
      )}
      {!exp?.show && !answered && mode !== "test" && null}
      {!exp?.show && answered && mode !== "test" && answers[expKey] === curQ.answer && (
        <div className="ai-explanation-box"><h4>Want to know why?</h4>
          <button className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: 13, marginTop: 8 }} onClick={() => fetchAIForKey(expKey, curQ)}>Show Explanation</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" id="sessionPrevBtn" disabled={cur === 0 && mode !== "practice"} onClick={() => navigateQ(-1)}>Previous</button>
          <button className="btn btn-secondary" id="sessionNextBtn" onClick={() => navigateQ(1)}>Next</button>
        </div>
        {mode === "test" && (
          <button className="btn btn-secondary" style={{ borderColor: "#ef4444", color: isFlagged ? "#ffffff" : "#ef4444", background: isFlagged ? "#ef4444" : "transparent" }}
            onClick={() => setFlags(f => { const n = new Set(f); n.has(cur) ? n.delete(cur) : n.add(cur); return n; })}>
            {isFlagged ? "Unflag" : "Flag Question"}
          </button>
        )}
      </div>

      {mode === "test" && questions.length > 1 && (
        <div id="sessionTestNavigatorWrapper" style={{ marginTop: 40, borderTop: "1px solid var(--card-border)", paddingTop: 24 }}>
          <h3>Question Matrix Navigator</h3>
          <div className="navigator-grid">
            {questions.map((_, i) => (
              <div key={i} className={`nav-matrix-cell${answers[i] ? " answered" : ""}${flags.has(i) ? " flagged" : ""}`} onClick={() => { setCur(i); setExpState({}); }}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── RESULTS ────────────────────────────────────────────────────────────── */
function ResultsView({ user, tok, go, ctx }) {
  const { course, mode, questions, answers, score, total, timed, totalSecs, timeLeft, elapsed, flags, masteredAll } = ctx;
  const pct   = Math.round((score / total) * 100);
  const { g, color } = gradeOf(pct);
  const wrong = (questions || []).filter((q, i) => answers[i] !== q.answer).length;
  const tt    = timed ? (totalSecs - (timeLeft || 0)) : (elapsed || 0);
  const fmtT  = (s) => { if (!s) return "0s"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}h ${m}m ${sec}s`:m>0?`${m}m ${sec}s`:`${sec}s`; };
  const saved = useRef(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [exps, setExps] = useState({});

  useEffect(() => {
    if (saved.current || mode === "practice") return;
    saved.current = true;
    db("sessions", { method: "POST", body: JSON.stringify({ user_id: user.id, course_id: course.id, course_code: course.code, score, total, percentage: pct, grade: g, mode, time_taken: tt, answers: JSON.stringify(answers), question_ids: (questions||[]).map(q => q.id) }) }, tok).catch(e => console.error("Session save:", e));
  }, []);

  const explainQ = async (i) => {
    if (exps[i]) return;
    const q = questions[i];
    setExps(e => ({ ...e, [i]: { loading: true, text: "" } }));
    const t = await aiCall(`Explain why the correct answer is ${q.answer} in 4 sentences.\nQ: ${q.question}\nA.${q.A} B.${q.B} C.${q.C} D.${q.D}\nCorrect: ${q.answer}. ${q[q.answer]}\nStudent chose: ${answers[i]}. ${q[answers[i]]}`);
    setExps(e => ({ ...e, [i]: { loading: false, text: t } }));
  };

  return (
    <>
      <div className="card results-hero-panel">
        {masteredAll ? <><h2 style={{ fontSize: 28, color: "#22c55e" }}>All Mastered! 🏆</h2></> : (
          <>
            <h2 style={{ fontSize: 24, color: "var(--text-muted)", fontWeight: 700 }}>Drill Performance Cleared</h2>
            <div className="score-big-text" style={{ color }}>{pct}%</div>
            <div className="grade-badge-letter" style={{ color }}>{g}</div>
          </>
        )}
      </div>

      {!masteredAll && (
        <div className="dashboard-grid" style={{ marginBottom: 32 }}>
          {[{l:"Correct Answers",v:score,c:"#22c55e"},{l:"Incorrect",v:wrong,c:"#ef4444"},{l:"Total Duration",v:fmtT(tt),c:null},{l:"Flagged",v:(flags||[]).length,c:null}].map(s=>(
            <div key={s.l} className="stat-card"><span className="label">{s.l}</span><span className="value" style={s.c?{color:s.c}:{}}>{s.v}</span></div>
          ))}
        </div>
      )}

      {mode === "test" && questions?.length > 0 && (
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
                  <div key={i} style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: 16 }}>
                    <p style={{ fontWeight: 700, marginBottom: 10 }}>Q{i+1}. {q.question}</p>
                    {["A","B","C","D"].map(l => (
                      <div key={l} style={{ fontSize: 13, padding: "5px 10px", borderRadius: 8, marginBottom: 4, background: l===q.answer?"var(--accent-green)":l===answers[i]&&!ok?"var(--accent-red)":"transparent", color: l===q.answer?"#16a34a":l===answers[i]&&!ok?"#dc2626":"var(--text-muted)", fontWeight: l===q.answer||l===answers[i]?700:400 }}>
                        {l===q.answer?"✓ ":l===answers[i]&&!ok?"✗ ":"   "}{l}. {q[l]}
                      </div>
                    ))}
                    {!ok && (
                      <div style={{ marginTop: 10 }}>
                        {!exps[i] ? (
                          <button className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: 12 }} onClick={() => explainQ(i)}>
                            {exps[i]?.loading ? <><span className="spinner" style={{width:14,height:14}} /> Loading...</> : "🤖 Get AI Explanation"}
                          </button>
                        ) : exps[i].loading ? (
                          <p style={{ fontSize: 13, color: "var(--text-muted)" }}><span className="spinner" style={{width:14,height:14,marginRight:8}} />Getting explanation...</p>
                        ) : (
                          <div className="ai-explanation-box" style={{ margin: 0 }}><h4>AI Explanation</h4><p>{exps[i].text}</p></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
        <button className="btn btn-primary" style={{ minWidth: 160 }} onClick={() => go("home")}>Dashboard Home</button>
        <button className="btn btn-secondary" style={{ minWidth: 160 }} onClick={() => go("setup", { course })}>Retry Drill</button>
      </div>
    </>
  );
}

/* ─── ANALYTICS ──────────────────────────────────────────────────────────── */
function AnalyticsView({ user, tok, go, msg }) {
  const [sessions, setSessions] = useState([]); const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); const [courses, setCourses] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([
        db(`sessions?user_id=eq.${user.id}&order=created_at.desc`, {}, tok),
        db("courses?select=id,code,title&order=title.asc", {}, tok),
      ]);
      setSessions(s || []); setCourses(c || []);
    } catch {}
    setLoading(false);
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all session history? Cannot be undone.")) return;
    try { await db(`sessions?user_id=eq.${user.id}`, { method: "DELETE" }, tok); setSessions([]); msg("History cleared", "success"); } catch (e) { msg(e.message, "error"); }
  };

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.course_id === filter);
  const chartData = [...filtered].reverse().slice(-7);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2>Analytics & Metrics</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Historical tracking of all your drill sessions.</p>
        </div>
        <button className="btn btn-secondary" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={clearAll}>Clear History</button>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <h3>Performance Trend</h3>
        <div className="chart-container" style={{ height: 240 }}>
          {chartData.length ? chartData.map((s, i) => (
            <div key={i} className="chart-bar-wrapper">
              <div className="chart-bar" style={{ height: `${s.percentage||0}%` }} />
              <span className="chart-label">{s.course_code || "-"}</span>
            </div>
          )) : Array(7).fill(null).map((_,i)=><div key={i} className="chart-bar-wrapper"><div className="chart-bar" style={{height:"0%"}}/><span className="chart-label">-</span></div>)}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h3>Session History</h3>
          <select className="form-input" style={{ maxWidth: 200, padding: "10px 14px" }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </div>
        {loading ? <div style={{textAlign:"center",padding:24}}><span className="spinner"/></div> : !filtered.length ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>No sessions yet. Complete a drill to see your history here.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead><tr style={{ borderBottom: "2px solid var(--card-border)", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}>
                <th style={{ padding: 12 }}>Date</th>
                <th style={{ padding: 12 }}>Course</th>
                <th style={{ padding: 12 }}>Mode</th>
                <th style={{ padding: 12, textAlign: "right" }}>Score</th>
              </tr></thead>
              <tbody>
                {filtered.map(s => {
                  const { g, color } = gradeOf(s.percentage || 0);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <td style={{ padding: 12 }}>{new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td style={{ padding: 12 }}>{s.course_code}</td>
                      <td style={{ padding: 12, textTransform: "capitalize" }}>{s.mode}</td>
                      <td style={{ padding: 12, textAlign: "right", fontWeight: 800, color }}>{s.score}/{s.total} — {g}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── PROFILE ────────────────────────────────────────────────────────────── */
function ProfileView({ user, tok, go, msg, logout }) {
  const meta = user?.user_metadata || {};
  const [name,  setName]  = useState(meta.full_name || "");
  const [inst,  setInst]  = useState(meta.institution || "");
  const [prog,  setProg]  = useState(meta.programme || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const uid     = (user?.id || "--------").slice(0, 8).toUpperCase();
  const initials= (meta.full_name || user?.email || "ST").substring(0, 2).toUpperCase();
  const avatar  = meta.avatar_url;

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${SB}/auth/v1/user`, { method: "PUT", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { ...meta, full_name: name.trim(), institution: inst, programme: prog } }) });
      const updated = { ...user, user_metadata: { ...meta, full_name: name.trim(), institution: inst, programme: prog } };
      localStorage.setItem("md_u", JSON.stringify(updated));
      const av = document.getElementById("userHeaderAvatar"); if (av) av.innerText = name.substring(0, 2).toUpperCase();
      msg("Profile updated!", "success");
    } catch (e) { msg(e.message, "error"); }
    setSaving(false);
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) return msg("Image must be under 3MB", "error");
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `avatars/${user.id}.${ext}`;
          const upRes = await fetch(`${SB}/storage/v1/object/${path}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": file.type, "x-upsert": "true" }, body: file });
          const url = upRes.ok ? `${SB}/storage/v1/object/public/${path}?v=${Date.now()}` : ev.target.result;
          await fetch(`${SB}/auth/v1/user`, { method: "PUT", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { ...meta, avatar_url: url } }) });
          const updated = { ...user, user_metadata: { ...meta, avatar_url: url } };
          localStorage.setItem("md_u", JSON.stringify(updated));
          msg("Photo updated! Refreshing...", "success");
          setTimeout(() => window.location.reload(), 800);
        } catch (err) { msg("Upload failed: " + err.message, "error"); }
        setUploading(false);
      };
      reader.onerror = () => { msg("Could not read image", "error"); setUploading(false); };
      reader.readAsDataURL(file);
    } catch (e) { msg(e.message, "error"); setUploading(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 650, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32, borderBottom: "1px solid var(--card-border)", paddingBottom: 24 }}>
        <div onClick={() => !uploading && fileRef.current?.click()} style={{ width: 72, height: 72, background: "var(--primary-dark)", color: "#ffffff", fontSize: 24, fontWeight: 800, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative", flexShrink: 0 }}>
          {avatar ? <img src={avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : initials}
          {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="spinner" style={{ borderTopColor: "#fff" }} /></div>}
        </div>
        <div>
          <h2>{meta.full_name || "Student"}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 500 }}>{user?.email}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>ID: #{uid}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginTop: 4 }} onClick={() => fileRef.current?.click()}>📷 Change photo</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{ display: "none" }} />
      </div>

      <div className="input-group"><label>Full Name</label><input type="text" id="profileEditName" className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="input-group">
        <label>Academic Institution</label>
        <SearchDropdown id="profileEditInst" dropId="profileEditInstDrop" items={UNIVERSITIES_LIST} value={inst} onChange={setInst} placeholder="Search your Nigerian institution..." />
      </div>
      <div className="input-group">
        <label>Degree Programme</label>
        <SearchDropdown id="profileEditProg" dropId="profileEditProgDrop" items={PROGRAMMES_LIST} value={prog} onChange={setProg} placeholder="Search your programme..." />
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 32, borderTop: "1px solid var(--card-border)", paddingTop: 24 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
          {saving ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Save Profile"}
        </button>
        <button className="btn btn-secondary" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }} onClick={logout}>Sign Out</button>
      </div>
    </div>
  );
}

/* ─── ADMIN ──────────────────────────────────────────────────────────────── */
function AdminView({ user, tok, go, msg }) {
  const [subs, setSubs] = useState([]); const [loading, setLoading] = useState(true);
  if (user?.email !== ADMIN) { go("home"); return null; }
  useEffect(() => { db("question_submissions?select=*&order=created_at.desc", {}, tok).then(s => setSubs(s||[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  const approve = async (sub) => {
    try {
      const courses = await db(`courses?code=eq.${sub.course_code}&select=*`, {}, tok) || [];
      let cId = courses[0]?.id;
      if (!cId) { const nc = await db("courses", { method: "POST", body: JSON.stringify({ code: sub.course_code, title: sub.course_title || sub.course_code, created_by: user.id }) }, tok); cId = nc[0]?.id; }
      const qs = parseQs(sub.questions_text);
      if (qs.length) {
        const ex = await db(`questions?course_id=eq.${cId}&select=question`, {}, tok) || [];
        const exSet = new Set(ex.map(q => q.question.toLowerCase().trim()));
        const ins = qs.filter(q => !exSet.has(q.question.toLowerCase().trim())).map(q => ({ ...q, course_id: cId, topic: sub.topic || "General", uploaded_by: user.id }));
        if (ins.length) for (let i = 0; i < ins.length; i += 50) await db("questions", { method: "POST", body: JSON.stringify(ins.slice(i, i+50)) }, tok);
      }
      await db(`question_submissions?id=eq.${sub.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }, tok);
      msg("Approved and uploaded!", "success"); setSubs(s => s.map(x => x.id === sub.id ? { ...x, status: "approved" } : x));
    } catch (e) { msg(e.message, "error"); }
  };

  const reject = async (id) => {
    try { await db(`question_submissions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }, tok); setSubs(s => s.map(x => x.id === id ? { ...x, status: "rejected" } : x)); } catch (e) { msg(e.message, "error"); }
  };

  return (
    <div className="card">
      <h2>Administrative Submissions Queue</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4, marginBottom: 24 }}>Review question submissions from users pending upload.</p>
      {loading ? <div style={{textAlign:"center",padding:32}}><span className="spinner"/></div> : !subs.length ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>No submissions yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
            <thead><tr style={{ borderBottom: "2px solid var(--card-border)", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}>
              <th style={{ padding: 12 }}>Course</th>
              <th style={{ padding: 12 }}>Preview</th>
              <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
            </tr></thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>{s.course_code}<br /><span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(s.created_at).toLocaleDateString()}</span></td>
                  <td style={{ padding: 12, maxWidth: 320, fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{s.questions_text?.slice(0, 120)}...</td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    {(!s.status || s.status === "pending") ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 12, background: "#22c55e" }} onClick={() => approve(s)}>Approve</button>
                        <button className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: 12, color: "#ef4444" }} onClick={() => reject(s.id)}>Reject</button>
                      </div>
                    ) : <span style={{ fontWeight: 700, color: s.status === "approved" ? "#22c55e" : "#ef4444", textTransform: "capitalize" }}>{s.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── HELP ───────────────────────────────────────────────────────────────── */
function HelpView({ go }) {
  const waLink = `https://wa.me/${WA}?text=${encodeURIComponent("Hi! I need help with MindDrill.")}`;
  const faqs = [
    { q: "How to upload questions into the course vault?", a: "Go to the Upload tab using quick links on your home dashboard. Select your course, paste questions in the required format, and upload. Duplicates are automatically detected and skipped." },
    { q: "What is the required question format?", a: "Each question follows this structure: 1. Question text?\nA. Option one\nB. Option two\nC. Option three\nD. Option four\nAnswer: B\nReference: Optional explanation text here." },
    { q: "How does the AI select my drill questions?", a: "Before each session, Gemini AI picks questions from the vault intelligently, varying the selection so you don't always get the same set. It takes your recent session history into account." },
    { q: "Explanation of the three study modes?", a: "Test Mode runs blind — no feedback until the end. Study Mode gives immediate answer feedback with AI explanation on every wrong answer. Practice Mode forces wrong answers to repeat in the queue until you get them right." },
    { q: "How do streaks calculate?", a: "Streaks increment each calendar day you complete at least one session. Missing a day resets the streak to zero." },
    { q: "How do I reset my password?", a: "On the sign in page, tap 'Forgot password?' and enter your email. A reset link will be sent to your inbox." },
  ];
  const [open, setOpen] = useState(null);
  return (
    <div className="card" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
      <h2>Help & FAQ Support Center</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 4, marginBottom: 32 }}>Got questions about MindDrill? Find answers here or contact us directly.</p>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 40 }}>
        {faqs.map((f, i) => (
          <div key={i} className="accordion-item">
            <div className="accordion-trigger" onClick={() => setOpen(open === i ? null : i)}>
              {f.q} <span>{open === i ? "−" : "+"}</span>
            </div>
            {open === i && <div className="accordion-content" style={{ display: "block" }}>{f.a}</div>}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={() => openUserGuide()}>Open User Guide</button>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: "#25d366", color: "#ffffff" }}>💬 WhatsApp Support</a>
      </div>
    </div>
  );
}

/* ─── UPLOAD ─────────────────────────────────────────────────────────────── */
function UploadView({ user, tok, go, msg }) {
  const [courseQ, setCourseQ] = useState(""); const [selCourse, setSelCourse] = useState(null);
  const [raw, setRaw] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(null);
  const [courses, setCourses] = useState([]); const [preview, setPreview] = useState(null);

  useEffect(() => { db("courses?select=*&order=title.asc", {}, tok).then(c => setCourses(c||[])).catch(()=>{}); }, []);

  const copyFmt = () => { const t = document.getElementById("uploadFmtBlock")?.innerText || ""; navigator.clipboard?.writeText(t); msg("Format copied!","success"); };

  const previewParse = () => {
    const qs = parseQs(raw);
    setPreview(qs.length ? `✓ ${qs.length} valid questions detected.` : "✗ No valid questions found. Check the format.");
  };

  const submit = async () => {
    if (!selCourse) return msg("Select a course vault first","error");
    if (!raw.trim()) return msg("Paste questions first","error");
    const qs = parseQs(raw);
    if (!qs.length) return msg("No valid questions found","error");
    setBusy(true);
    try {
      const ex = await db(`questions?course_id=eq.${selCourse.id}&select=question`,{},tok)||[];
      const exSet = new Set(ex.map(q=>q.question.toLowerCase().trim()));
      const ins = qs.filter(q=>!exSet.has(q.question.toLowerCase().trim())).map(q=>({...q,course_id:selCourse.id,topic:"General",uploaded_by:user.id}));
      const dupes = qs.length - ins.length;
      if (!ins.length) { msg(`All ${dupes} questions already exist in this vault`,"error"); setBusy(false); return; }
      for (let i=0;i<ins.length;i+=50) await db("questions",{method:"POST",body:JSON.stringify(ins.slice(i,i+50))},tok);
      setDone({ inserted: ins.length, dupes });
      setRaw(""); setPreview(null);
    } catch(e){ msg(e.message,"error"); }
    setBusy(false);
  };

  const submitToAdmin = async () => {
    if (!selCourse) return msg("Select a course first","error");
    if (!raw.trim()) return msg("Paste questions first","error");
    const qs = parseQs(raw);
    if (!qs.length) return msg("No valid questions found","error");
    try {
      await db("question_submissions",{method:"POST",body:JSON.stringify({user_id:user.id,course_code:selCourse.code,course_title:selCourse.title,topic:"General",questions_text:raw.trim(),submitted_by_email:user.email,status:"pending"})},tok);
      msg("Submitted for admin review! Questions will be added within 24-48 hours.","success");
      setRaw("");
    } catch(e){ msg(e.message,"error"); }
  };

  const filteredCourses = courseQ.length > 0 ? courses.filter(c => c.code.toLowerCase().includes(courseQ.toLowerCase()) || c.title.toLowerCase().includes(courseQ.toLowerCase())).slice(0, 8) : [];

  return (
    <div className="card" style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}>
      <h2>Upload & Submit Questions</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4, marginBottom: 24 }}>Select a course vault, paste your questions, then upload directly or submit for review.</p>

      {done && (
        <div className="ai-explanation-box" style={{ marginBottom: 20 }}>
          <h4>Upload Complete!</h4>
          <p>{done.inserted} questions added. {done.dupes > 0 ? `${done.dupes} duplicates skipped.` : ""}</p>
          <button className="btn btn-secondary" style={{ marginTop: 12, padding: "8px 16px", fontSize: 13 }} onClick={() => setDone(null)}>Upload More</button>
        </div>
      )}

      <div className="input-group" style={{ position: "relative" }}>
        <label>Select Target Course Vault</label>
        <input type="text" id="uploadCourseCode" className="form-input" value={courseQ} onChange={e => { setCourseQ(e.target.value); setSelCourse(null); }} placeholder="Type course code or title..." autoComplete="off" />
        {selCourse && <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#16a34a", marginTop: 6 }}>✓ Selected: {selCourse.code}</span>}
        {filteredCourses.length > 0 && !selCourse && (
          <div className="dropdown-search-results" style={{ display: "block" }}>
            {filteredCourses.map(c => (
              <div key={c.id} className="dropdown-item" onMouseDown={() => { setSelCourse(c); setCourseQ(`${c.code} — ${c.title}`); }}>
                <strong>{c.code}</strong> — {c.title}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "rgba(99,102,241,0.06)", border: "1.5px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: "#6366f1" }}>Required Question Format</span>
          <button className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: 12 }} onClick={copyFmt}>Copy Format</button>
        </div>
        <pre id="uploadFmtBlock" style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-dark)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
{`1. What is the question text here?
A. First option
B. Second option
C. Third option
D. Fourth option
Answer: B
Reference: This explains why option B is correct. (optional)

2. Next question goes here?
A. Option one
B. Option two
C. Option three
D. Option four
Answer: A`}
        </pre>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.6 }}>Copy this format → open ChatGPT or Gemini → generate questions in this format → paste below.</p>
      </div>

      <div className="input-group">
        <label>Paste Questions Here</label>
        <textarea id="uploadRawTextArea" className="form-input" style={{ height: 200, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} placeholder="Paste your questions here in the format shown above..." value={raw} onChange={e => { setRaw(e.target.value); setPreview(null); }} />
        {preview && <span style={{ display: "block", fontSize: 12, fontWeight: 700, marginTop: 6, color: preview.startsWith("✓") ? "#16a34a" : "#ef4444" }}>{preview}</span>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={previewParse}>Preview Parse</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={submitToAdmin}>Submit for Review</button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={submit} disabled={busy}>
          {busy ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Upload to Course"}
        </button>
      </div>

      <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 14 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Don't want to upload yourself? Use <strong>Submit for Review</strong> above and our admin will add your questions within 24-48 hours. You can also{" "}
          <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Hi! I'd like to submit questions for MindDrill.")}`} target="_blank" rel="noreferrer" style={{ color: "#25d366", fontWeight: 700 }}>message us on WhatsApp</a>.
        </p>
      </div>
    </div>
  );
}

/* ─── COURSE CREATION MODAL ──────────────────────────────────────────────── */
let _courseModalCallback = null;
function openCourseModal(onSaved) { _courseModalCallback = onSaved; document.getElementById("courseModal").style.display = "flex"; }

function CourseModal({ user, tok, msg }) {
  const [code, setCode] = useState(""); const [title, setTitle] = useState(""); const [busy, setBusy] = useState(false);
  const close = () => { document.getElementById("courseModal").style.display = "none"; setCode(""); setTitle(""); };
  const save = async () => {
    if (!code.trim() || !title.trim()) return msg("Fill in both fields", "error");
    setBusy(true);
    try {
      await db("courses", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase(), title: title.trim(), created_by: user?.id }) }, tok);
      msg("Course created!", "success"); close(); if (_courseModalCallback) _courseModalCallback();
    } catch (e) { msg(e.message, "error"); }
    setBusy(false);
  };
  return (
    <div className="modal-overlay" id="courseModal" style={{ display: "none" }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-box">
        <button className="modal-close-x" onClick={close}>✕</button>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Create New Course</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>Add a new course vault to the question bank.</p>
        <div className="input-group"><label>Course Code</label><input id="modalCode" className="form-input" placeholder="e.g. PHY102" style={{ textTransform: "uppercase" }} value={code} onChange={e => setCode(e.target.value)} /></div>
        <div className="input-group"><label>Course Title</label><input id="modalTitle" className="form-input" placeholder="e.g. Electricity &amp; Magnetism" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={close}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={busy}>{busy ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Save Course"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── USER GUIDE MODAL ───────────────────────────────────────────────────── */
let _ugOpen = null;
function openUserGuide() { if (_ugOpen) _ugOpen(); }

function UserGuideModal() {
  const [open, setOpen] = useState(false); const [step, setStep] = useState(0);
  useEffect(() => { _ugOpen = () => { setStep(0); setOpen(true); }; }, []);
  const steps = [
    { title: "1. Create an Account", body: "Start by signing up with your name and email. Your account keeps all your progress, scores, and analytics saved securely in the cloud." },
    { title: "2. Add Your Courses", body: "Go to the <strong>Courses</strong> tab and tap the dashed card to create a new course vault. Enter the course code (e.g. PHY102) and the course title." },
    { title: "3. Upload Questions", body: "Go to <strong>Upload</strong>, select your course, then paste questions in the required format. Use ChatGPT or Gemini to generate questions — then paste and upload instantly." },
    { title: "4. Start a Study Session", body: "Open any course and tap <strong>Start</strong>. Choose your mode and number of questions. Answer questions, get instant feedback, and see your score and grade at the end." },
    { title: "5. Track Your Progress", body: "Visit the <strong>Analytics</strong> tab to see your full performance history — scores, trends, and which courses need more work. The more you drill, the sharper you get." },
  ];
  if (!open) return null;
  return (
    <div className="modal-overlay" id="userGuideModal" style={{ display: "flex" }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal-box" style={{ maxWidth: 520, padding: 0, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg,#6366f1 0%,#3b82f6 100%)", padding: "32px 32px 24px", color: "#fff", position: "relative" }}>
          <button className="modal-close-x" onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.25)", color: "#fff" }}>✕</button>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7, marginBottom: 6 }}>Quick Start</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>MindDrill User Guide</h2>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>Everything you need to know to get started.</p>
          <div style={{ display: "flex", gap: 6 }}>
            {steps.map((_, i) => <div key={i} className={`g-dot${step === i ? " g-dot-active" : ""}`} />)}
          </div>
        </div>
        <div style={{ padding: "28px 32px 8px", minHeight: 160 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-dark)", marginBottom: 12 }}>{steps[step].title}</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: steps[step].body }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px 28px" }}>
          <button className="btn btn-secondary" style={{ padding: "11px 20px", fontSize: 13, visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep(s => s - 1)}>Back</button>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{step + 1} of {steps.length}</span>
          <button className="btn btn-primary" style={{ padding: "11px 24px", fontSize: 13 }} onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : setOpen(false)}>
            {step === steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TIMER WARNING OVERLAY ──────────────────────────────────────────────── */
function showTimerWarning() { document.getElementById("timerWarnOverlay").style.display = "flex"; }

function TimerWarningOverlay() {
  const [secs, setSecs] = useState(8); const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("timerWarnOverlay");
    if (!el) return;
    const obs = new MutationObserver(() => { if (el.style.display === "flex") { setSecs(8); setVisible(true); } });
    obs.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    if (secs <= 0) { setVisible(false); document.getElementById("timerWarnOverlay").style.display = "none"; return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, secs]);
  return (
    <div id="timerWarnOverlay" style={{ display: "none", position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 950, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#ffffff", borderRadius: 24, padding: "36px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 60px rgba(15,23,42,0.2)", animation: "modalUp 0.3s ease" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#ef4444", marginBottom: 10 }}>5 Minutes Remaining!</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>Your time is almost up. Start wrapping up and review your answers before the clock runs out.</p>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>Dismissing in {secs} second{secs !== 1 ? "s" : ""}...</div>
      </div>
    </div>
  );
}

/* ─── DESKTOP TIP BANNER ─────────────────────────────────────────────────── */
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
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>Open your browser menu and select <strong style={{ color: "#fff" }}>"Request Desktop Site"</strong> to see MindDrill in its full layout.</p>
        </div>
        <button onClick={() => setShow(false)} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>
      <button onClick={() => { localStorage.setItem("md_desktop_tip_hidden", "1"); setShow(false); }} style={{ marginTop: 12, background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.55)", borderRadius: 50, padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", width: "100%" }}>Don't show this again</button>
    </div>
  );
}
