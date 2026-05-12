import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://lezdidskdvykmumajedj.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlemRpZHNrZHZ5a211bWFqZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTI0MDMsImV4cCI6MjA5NDA2ODQwM30.R-dzOu1WmfV7mqBg35bd1m4NgMUVxEoNQtwuNFkSnVE";

const SEED_COURSES = [
  { code: "AFIT-GST108", title: "Use Of Library, Study Skills And ICT" },
  { code: "PHY104", title: "General Physics IV (Vibration, Waves And Optics)" },
  { code: "STA112", title: "Probability I" },
  { code: "TEE102", title: "Introduction To Telecommunications Engineering" },
  { code: "GET102", title: "Engineering Graphics And Solid Modelling I" },
  { code: "PHY108", title: "General Practical Physics II" },
  { code: "PHY102", title: "General Physics II" },
  { code: "MTH102", title: "Elementary Mathematics II" },
  { code: "CHM108", title: "General Chemistry Practical II" },
  { code: "CHM102", title: "General Chemistry II" },
  { code: "GST112", title: "Nigerian Peoples And Culture" },
];

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const sbFetch = async (path, options = {}, token = null) => {
  const headers = {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${token || SUPABASE_ANON}`,
    "Content-Type": "application/json",
    Prefer: options.prefer || "return=representation",
    ...options.extraHeaders,
  };
  delete options.extraHeaders;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || res.statusText);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const sbAuth = async (path, body) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
};

// ─── GEMINI via SERVERLESS ────────────────────────────────────────────────────
const askAI = async (prompt) => {
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return data.text || "No response available.";
  } catch (e) {
    return "AI explanation unavailable right now.";
  }
};

// AI picks questions - sends question ids and history, gets back selected ids
const aiPickQuestions = async (questions, count, recentIds = []) => {
  if (!questions.length) return [];
  // Build prompt for AI to select question indices
  const pool = questions.map((q, i) => `${i}:${q.id}`).join(",");
  const recent = recentIds.slice(-20).join(",");
  const prompt = `You are a smart study assistant. From a pool of ${questions.length} questions, select ${Math.min(count, questions.length)} question indices to give a student. 
Pool (index:id): ${pool}
Recently seen IDs (avoid repeating these too much but can include if needed): ${recent}
Return ONLY a comma-separated list of indices like: 0,5,12,3,8
Select exactly ${Math.min(count, questions.length)} indices. Vary the selection intelligently.`;
  
  try {
    const result = await askAI(prompt);
    const indices = result.match(/\d+/g)?.map(Number).filter(n => n >= 0 && n < questions.length) || [];
    const unique = [...new Set(indices)].slice(0, count);
    if (unique.length < Math.min(count, questions.length)) {
      // Fill remaining randomly
      const used = new Set(unique);
      const remaining = questions.map((_, i) => i).filter(i => !used.has(i));
      const shuffled = remaining.sort(() => Math.random() - 0.5);
      unique.push(...shuffled.slice(0, Math.min(count, questions.length) - unique.length));
    }
    return unique.map(i => questions[i]);
  } catch {
    return questions.sort(() => Math.random() - 0.5).slice(0, Math.min(count, questions.length));
  }
};

// ─── QUESTION PARSER ──────────────────────────────────────────────────────────
const normalizeText = (s) => s
  .replace(/\^2/g, "²").replace(/\^3/g, "³").replace(/\^n/g, "ⁿ")
  .replace(/sqrt\(/g, "√(").replace(/>=/, "≥").replace(/<=/, "≤")
  .replace(/!=/g, "≠").replace(/\bpi\b/gi, "π").replace(/\bdelta\b/gi, "Δ")
  .replace(/\balpha\b/gi, "α").replace(/\bbeta\b/gi, "β").replace(/\btheta\b/gi, "θ")
  .replace(/\blambda\b/gi, "λ").replace(/\bsigma\b/gi, "σ").replace(/\bmu\b/gi, "μ")
  .replace(/\bomega\b/gi, "ω").replace(/\binfinity\b/gi, "∞").replace(/\bx10\^/gi, "×10^");

const parseQuestions = (raw) => {
  const questions = [];
  const blocks = raw.trim().split(/\n(?=\d+[\.\)]\s)/);
  for (const block of blocks) {
    const lines = block.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 5) continue;
    const qLine = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
    const opts = {};
    for (const l of lines) {
      const m = l.match(/^([A-D])[\.\)]\s*(.+)/i);
      if (m) opts[m[1].toUpperCase()] = m[2].trim();
    }
    const ansLine = lines.find(l => /^answer\s*:/i.test(l));
    if (!ansLine) continue;
    const ans = ansLine.replace(/^answer\s*:\s*/i, "").trim().toUpperCase()[0];
    if (!qLine || Object.keys(opts).length < 4 || !["A","B","C","D"].includes(ans)) continue;
    questions.push({
      question: normalizeText(qLine),
      A: normalizeText(opts.A || ""),
      B: normalizeText(opts.B || ""),
      C: normalizeText(opts.C || ""),
      D: normalizeText(opts.D || ""),
      answer: ans,
    });
  }
  return questions;
};

// ─── GRADE ────────────────────────────────────────────────────────────────────
const getGrade = (pct) => {
  if (pct >= 90) return { grade: "A+", color: "#15803d" };
  if (pct >= 80) return { grade: "A",  color: "#16a34a" };
  if (pct >= 70) return { grade: "B",  color: "#65a30d" };
  if (pct >= 60) return { grade: "C",  color: "#d97706" };
  if (pct >= 50) return { grade: "D",  color: "#ea580c" };
  return { grade: "F", color: "#dc2626" };
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const lightTheme = {
  bg: "#ffffff", bg2: "#f8f8f8", fg: "#0a0a0a", fg2: "#1a1a1a",
  muted: "#6b6b6b", border: "#e5e5e5", surface: "#f3f3f3",
  accent: "#0a0a0a", correct: "#16a34a", wrong: "#dc2626", warn: "#d97706",
  card: "#ffffff", navBg: "#ffffff", shadow: "0 -1px 0 #e5e5e5",
};
const darkTheme = {
  bg: "#0a0a0a", bg2: "#141414", fg: "#f5f5f5", fg2: "#e0e0e0",
  muted: "#888", border: "#2a2a2a", surface: "#1e1e1e",
  accent: "#f5f5f5", correct: "#22c55e", wrong: "#ef4444", warn: "#f59e0b",
  card: "#141414", navBg: "#0a0a0a", shadow: "0 -1px 0 #2a2a2a",
};

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const buildCSS = (T) => `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { background: ${T.bg}; color: ${T.fg}; font-family: 'Syne', sans-serif; min-height: 100vh; overflow-x: hidden; transition: background 0.2s, color 0.2s; }
  input, textarea, select, button { font-family: inherit; }
  button { cursor: pointer; border: none; background: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes pop { 0%{transform:scale(0.8);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes confetti { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
  @keyframes slideIn { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .fade-up { animation: fadeUp 0.3s ease forwards; }
  .fade-in { animation: fadeIn 0.2s ease forwards; }
  .pop { animation: pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .slide-in { animation: slideIn 0.25s ease forwards; }
  input:focus, textarea:focus { outline: 2px solid ${T.fg}; outline-offset: 1px; }
`;

// ─── MINI COMPONENTS ─────────────────────────────────────────────────────────
const Spinner = ({ size = 22, color }) => (
  <div style={{ width: size, height: size, border: `2.5px solid #e5e5e5`, borderTopColor: color || "#0a0a0a", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
);

const Screen = ({ children, style = {}, noPad = false }) => (
  <div className="fade-up" style={{ minHeight: "100vh", padding: noPad ? 0 : "24px 18px 90px", maxWidth: 540, margin: "0 auto", ...style }}>
    {children}
  </div>
);

const Back = ({ onClick, T }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: 14, fontWeight: 600, marginBottom: 20, letterSpacing: "-0.01em" }}>
    ← Back
  </button>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function MindDrill() {
  const [screen, setScreen] = useState("splash");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem("md_dark") === "1");
  const [toast, setToast] = useState(null);
  const [ctx, setCtx] = useState({});
  const T = dark ? darkTheme : lightTheme;

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const nav = useCallback((s, data = {}) => {
    setCtx(data);
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  const toggleDark = () => {
    setDark(d => { localStorage.setItem("md_dark", !d ? "1" : "0"); return !d; });
  };

  useEffect(() => {
    const t = localStorage.getItem("md_token");
    const u = localStorage.getItem("md_user");
    if (t && u) { setToken(t); setUser(JSON.parse(u)); setScreen("home"); }
    else setTimeout(() => setScreen("auth"), 2000);
  }, []);

  const logout = () => {
    localStorage.removeItem("md_token"); localStorage.removeItem("md_user");
    setUser(null); setToken(null); setScreen("auth");
  };

  const sharedProps = { user, token, nav, showToast, T, dark, toggleDark, ctx, logout };

  const BOTTOM_NAV_SCREENS = ["home", "courses", "performance", "profile"];

  return (
    <>
      <style>{buildCSS(T)}</style>

      {/* Toast */}
      {toast && (
        <div className="pop" style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? T.wrong : toast.type === "success" ? T.correct : T.fg,
          color: "#fff", borderRadius: 14, padding: "12px 22px", fontSize: 14, fontWeight: 600,
          zIndex: 9999, maxWidth: 320, textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
          whiteSpace: "pre-line", lineHeight: 1.5
        }}>{toast.msg}</div>
      )}

      {/* Screens */}
      {screen === "splash"       && <SplashScreen T={T} />}
      {screen === "auth"         && <AuthScreen {...sharedProps} />}
      {screen === "home"         && <HomeScreen {...sharedProps} />}
      {screen === "courses"      && <CoursesScreen {...sharedProps} />}
      {screen === "course-detail"&& <CourseDetailScreen {...sharedProps} />}
      {screen === "upload"       && <UploadScreen {...sharedProps} />}
      {screen === "mode-select"  && <ModeSelectScreen {...sharedProps} />}
      {screen === "test-setup"   && <TestSetupScreen {...sharedProps} />}
      {screen === "session"      && <SessionScreen {...sharedProps} />}
      {screen === "results"      && <ResultsScreen {...sharedProps} />}
      {screen === "review"       && <ReviewScreen {...sharedProps} />}
      {screen === "performance"  && <PerformanceScreen {...sharedProps} />}
      {screen === "profile"      && <ProfileScreen {...sharedProps} />}

      {/* Bottom Nav */}
      {BOTTOM_NAV_SCREENS.includes(screen) && (
        <BottomNav current={screen} nav={nav} T={T} />
      )}
    </>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ current, nav, T }) {
  const items = [
    { id: "home", icon: "⚡", label: "Home" },
    { id: "courses", icon: "📚", label: "Courses" },
    { id: "performance", icon: "📊", label: "Stats" },
    { id: "profile", icon: "👤", label: "Profile" },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, background: T.navBg,
      boxShadow: T.shadow, display: "flex", justifyContent: "space-around",
      padding: "10px 0 20px", zIndex: 100, maxWidth: 540, margin: "0 auto",
      left: "50%", transform: "translateX(-50%)", width: "100%",
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => nav(it.id)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          padding: "6px 16px", borderRadius: 12, background: "none", border: "none",
          color: current === it.id ? T.fg : T.muted,
          transition: "all 0.15s",
        }}>
          <span style={{ fontSize: 20 }}>{it.icon}</span>
          <span style={{ fontSize: 11, fontWeight: current === it.id ? 700 : 500 }}>{it.label}</span>
          {current === it.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.fg }} />}
        </button>
      ))}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function SplashScreen({ T }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div className="pop" style={{ width: 80, height: 80, background: "#fff", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 60px rgba(255,255,255,0.15)" }}>
        <span style={{ fontSize: 40 }}>⚡</span>
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.04em" }}>MindDrill</h1>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sharpen your mind</p>
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({ setUser, setToken, nav, showToast, T }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !pw) return showToast("Fill in all fields", "error");
    if (mode === "signup" && !name) return showToast("Enter your name", "error");
    setLoading(true);
    try {
      let data;
      if (mode === "signup") {
        data = await sbAuth("signup", { email, password: pw, data: { full_name: name } });
        showToast("Welcome to MindDrill! 🎉", "success");
      } else {
        data = await sbAuth("token?grant_type=password", { email, password: pw });
      }
      localStorage.setItem("md_token", data.access_token);
      localStorage.setItem("md_user", JSON.stringify(data.user));
      setUser(data.user); setToken(data.access_token);
      nav("home");
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  };

  const inp = (label, val, set, type = "text", ph = "") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>
      <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
        style={{ border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 15, background: T.bg, color: T.fg, width: "100%" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ width: 56, height: 56, background: T.fg, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 26, filter: "invert(1)" }}>⚡</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: T.fg }}>MindDrill</h1>
        <p style={{ color: T.muted, fontSize: 15, marginTop: 6 }}>
          {mode === "signin" ? "Welcome back. Let's drill." : "Join MindDrill. Start mastering."}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {mode === "signup" && inp("Full Name", name, setName, "text", "Your name")}
        {inp("Email", email, setEmail, "email", "you@email.com")}
        {inp("Password", pw, setPw, "password", "••••••••")}
      </div>
      <button onClick={submit} disabled={loading} style={{
        background: T.fg, color: T.bg, borderRadius: 14, padding: "15px", fontSize: 16, fontWeight: 700,
        width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: loading ? 0.7 : 1,
      }}>
        {loading ? <Spinner color={T.bg} /> : mode === "signin" ? "Sign In" : "Create Account"}
      </button>
      <p style={{ textAlign: "center", color: T.muted, fontSize: 14 }}>
        {mode === "signin" ? "No account? " : "Have an account? "}
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} style={{ color: T.fg, fontWeight: 700, background: "none", border: "none" }}>
          {mode === "signin" ? "Sign Up" : "Sign In"}
        </button>
      </p>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ user, token, nav, showToast, T, dark, toggleDark }) {
  const [stats, setStats] = useState({ total: 0, avg: 0, streak: 0, best: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const sessions = await sbFetch(`sessions?user_id=eq.${user.id}&order=created_at.desc&limit=50`, {}, token);
      if (sessions?.length) {
        const total = sessions.length;
        const avg = Math.round(sessions.reduce((a, s) => a + (s.percentage || 0), 0) / total);
        const best = Math.max(...sessions.map(s => s.percentage || 0));
        // Streak calculation
        let streak = 0;
        const today = new Date(); today.setHours(0,0,0,0);
        const days = new Set(sessions.map(s => new Date(s.created_at).toDateString()));
        for (let i = 0; i < 365; i++) {
          const d = new Date(today); d.setDate(d.getDate() - i);
          if (days.has(d.toDateString())) streak++;
          else if (i > 0) break;
        }
        setStats({ total, avg, streak, best });
        setRecent(sessions.slice(0, 4));
      }
    } catch (e) {}
  };

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";
  const avatar = user?.user_metadata?.avatar_url;
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <Screen>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => nav("profile")} style={{ width: 44, height: 44, borderRadius: "50%", background: T.surface, border: `2px solid ${T.border}`, overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
            {avatar ? <img src={avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>}
          </div>
          <div>
            <p style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{greeting}</p>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: T.fg }}>{name.split(" ")[0]} 👋</h2>
          </div>
        </div>
        <button onClick={toggleDark} style={{ width: 40, height: 40, borderRadius: "50%", background: T.surface, border: `1.5px solid ${T.border}`, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Streak banner */}
      {stats.streak > 0 && (
        <div style={{ background: T.fg, borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 32 }}>🔥</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.bg }}>{stats.streak} Day Streak</div>
            <div style={{ fontSize: 13, color: dark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.7)" }}>Keep it up! Come back tomorrow.</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
        {[
          { label: "Sessions", value: stats.total, emoji: "📚" },
          { label: "Avg Score", value: `${stats.avg}%`, emoji: "🎯" },
          { label: "Best", value: `${stats.best}%`, emoji: "🏆" },
        ].map(s => (
          <div key={s.label} style={{ background: T.surface, borderRadius: 14, padding: "14px 10px", textAlign: "center", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.fg }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Start button */}
      <button onClick={() => nav("courses")} style={{
        width: "100%", background: T.fg, color: T.bg, borderRadius: 16, padding: "18px",
        fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        ⚡ Start Drilling
      </button>

      {/* Recent sessions */}
      {recent.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.fg, marginBottom: 12 }}>Recent Sessions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map(s => {
              const { grade, color } = getGrade(s.percentage || 0);
              const modeEmoji = s.mode === "study" ? "📖" : s.mode === "practice" ? "🏋️" : "🧪";
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.fg }}>{modeEmoji} {s.course_code || "Mixed"}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.fg }}>{s.score}/{s.total}</span>
                    <span style={{ background: color, color: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 800 }}>{grade}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}

// ─── COURSES ──────────────────────────────────────────────────────────────────
function CoursesScreen({ user, token, nav, showToast, T }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { loadCourses(); }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      // Seed courses
      const existing = await sbFetch("courses?select=code", {}, token);
      const existingCodes = new Set((existing || []).map(c => c.code));
      for (const c of SEED_COURSES) {
        if (!existingCodes.has(c.code)) {
          await sbFetch("courses", { method: "POST", body: JSON.stringify({ code: c.code, title: c.title, created_by: user.id }) }, token).catch(() => {});
        }
      }
      const all = await sbFetch("courses?select=*&order=title.asc", {}, token);
      // Get question counts
      const counts = await sbFetch("questions?select=course_id", {}, token);
      const countMap = {};
      (counts || []).forEach(q => { countMap[q.course_id] = (countMap[q.course_id] || 0) + 1; });
      setCourses((all || []).map(c => ({ ...c, qCount: countMap[c.id] || 0 })));
    } catch (e) { showToast("Failed to load courses: " + e.message, "error"); }
    setLoading(false);
  };

  const addCourse = async () => {
    if (!newCode.trim() || !newTitle.trim()) return showToast("Fill in both fields", "error");
    const code = newCode.trim().toUpperCase();
    if (courses.find(c => c.code === code)) return showToast("Course code already exists", "error");
    setAdding(true);
    try {
      await sbFetch("courses", { method: "POST", body: JSON.stringify({ code, title: newTitle.trim(), created_by: user.id }) }, token);
      showToast("Course created!", "success");
      setNewCode(""); setNewTitle(""); setShowAdd(false);
      loadCourses();
    } catch (e) { showToast(e.message, "error"); }
    setAdding(false);
  };

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const isMyCourse = (code) => SEED_COURSES.some(s => s.code === code);

  const myCourses = filtered.filter(c => isMyCourse(c.code));
  const otherCourses = filtered.filter(c => !isMyCourse(c.code));

  const CourseCard = ({ c }) => (
    <div onClick={() => nav("course-detail", { course: c })} style={{
      display: "flex", alignItems: "center", gap: 14, padding: "16px", border: `1.5px solid ${T.border}`,
      borderRadius: 16, cursor: "pointer", background: T.card, transition: "border-color 0.15s",
    }}>
      <div style={{ width: 48, height: 48, background: T.fg, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ color: T.bg, fontSize: 10, fontWeight: 800, textAlign: "center", lineHeight: 1.2, padding: "0 4px" }}>{c.code.slice(0, 7)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.fg, lineHeight: 1.3 }}>{c.title}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{c.code} · {c.qCount} questions</div>
      </div>
      {/* Progress ring placeholder */}
      <ProgressRing pct={0} size={36} stroke={3} color={T.fg} bg={T.border} />
    </div>
  );

  return (
    <Screen>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: T.fg }}>Courses</h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: showAdd ? T.surface : T.fg, color: showAdd ? T.fg : T.bg,
          borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700,
          border: `1.5px solid ${T.border}`,
        }}>{showAdd ? "Cancel" : "+ New"}</button>
      </div>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>{courses.length} courses · {courses.reduce((a, c) => a + c.qCount, 0)} total questions</p>

      {showAdd && (
        <div style={{ background: T.surface, borderRadius: 16, padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 12, border: `1.5px solid ${T.border}` }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Course Code</label>
            <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. PHY201"
              style={{ border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: T.bg, color: T.fg, width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Course Title</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Classical Mechanics"
              style={{ border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: T.bg, color: T.fg, width: "100%" }} />
          </div>
          <button onClick={addCourse} disabled={adding} style={{ background: T.fg, color: T.bg, borderRadius: 12, padding: "13px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {adding ? <Spinner color={T.bg} /> : "Create Course"}
          </button>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search courses..."
        style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 14, background: T.bg, color: T.fg, marginBottom: 24 }} />

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}><Spinner /></div>
      ) : (
        <>
          {myCourses.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>My Courses (2nd Semester 2025/2026)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {myCourses.map(c => <CourseCard key={c.id} c={c} />)}
              </div>
            </>
          )}
          {otherCourses.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>All Other Courses</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {otherCourses.map(c => <CourseCard key={c.id} c={c} />)}
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

// ─── PROGRESS RING ────────────────────────────────────────────────────────────
function ProgressRing({ pct, size, stroke, color, bg }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={size*0.22} fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

// ─── COURSE DETAIL ────────────────────────────────────────────────────────────
function CourseDetailScreen({ user, token, nav, showToast, T, ctx }) {
  const course = ctx.course;
  const [topics, setTopics] = useState([]);
  const [qCount, setQCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const qs = await sbFetch(`questions?course_id=eq.${course.id}&select=topic`, {}, token);
      if (qs) {
        setQCount(qs.length);
        const map = {};
        qs.forEach(q => { const t = q.topic || "General"; map[t] = (map[t] || 0) + 1; });
        setTopics(Object.entries(map).map(([name, count]) => ({ name, count })).sort((a,b)=>b.count-a.count));
      }
    } catch (e) {}
    setLoading(false);
  };

  const seedCourse = SEED_COURSES.find(s => s.code === course.code);

  return (
    <Screen>
      <Back onClick={() => nav("courses")} T={T} />
      <div style={{ background: T.fg, borderRadius: 20, padding: "24px 20px", marginBottom: 24, color: T.bg }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{course.code}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{course.title}</h2>
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.6 }}>{qCount} questions in bank</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        <button onClick={() => nav("mode-select", { course })} style={{ background: T.fg, color: T.bg, borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          ⚡ Start Session
        </button>
        <button onClick={() => nav("upload", { course })} style={{ background: T.surface, color: T.fg, borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 700, border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          📤 Upload Questions
        </button>
      </div>

      {loading ? <Spinner /> : topics.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Topics</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topics.map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.fg }}>{t.name}</span>
                <span style={{ background: T.fg, color: T.bg, borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{t.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function UploadScreen({ user, token, nav, showToast, T, ctx }) {
  const course = ctx.course;
  const [raw, setRaw] = useState("");
  const [topic, setTopic] = useState("");
  const [parsed, setParsed] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const preview = () => {
    if (!raw.trim()) return showToast("Paste your questions first", "error");
    const qs = parseQuestions(raw);
    if (!qs.length) return showToast("No valid questions found.\nCheck the format below.", "error");
    setParsed(qs); setPreviewing(true);
  };

  const upload = async () => {
    setUploading(true);
    try {
      const existing = await sbFetch(`questions?course_id=eq.${course.id}&select=question`, {}, token);
      const existingSet = new Set((existing || []).map(q => q.question.toLowerCase().trim()));
      const toInsert = parsed
        .filter(q => !existingSet.has(q.question.toLowerCase().trim()))
        .map(q => ({ ...q, course_id: course.id, topic: topic.trim() || "General", uploaded_by: user.id }));
      const dupes = parsed.length - toInsert.length;
      if (!toInsert.length) { showToast(`All ${dupes} questions are duplicates`, "error"); setUploading(false); return; }
      for (let i = 0; i < toInsert.length; i += 50) {
        await sbFetch("questions", { method: "POST", body: JSON.stringify(toInsert.slice(i, i + 50)) }, token);
      }
      setResult({ inserted: toInsert.length, dupes, total: parsed.length });
      setPreviewing(false); setRaw(""); setParsed([]);
    } catch (e) { showToast(e.message, "error"); }
    setUploading(false);
  };

  if (result) return (
    <Screen style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="pop" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: T.fg, marginBottom: 8 }}>Done!</h2>
        <p style={{ color: T.muted, fontSize: 16, marginBottom: 6 }}>{result.inserted} questions added</p>
        {result.dupes > 0 && <p style={{ color: T.warn, fontSize: 14, marginBottom: 24 }}>{result.dupes} duplicates skipped</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <button onClick={() => setResult(null)} style={{ background: T.fg, color: T.bg, borderRadius: 14, padding: "14px", fontWeight: 700, fontSize: 15 }}>Upload More</button>
          <button onClick={() => nav("course-detail", { course })} style={{ background: T.surface, color: T.fg, borderRadius: 14, padding: "14px", fontWeight: 700, fontSize: 15, border: `1.5px solid ${T.border}` }}>Back to Course</button>
        </div>
      </div>
    </Screen>
  );

  return (
    <Screen>
      <Back onClick={() => nav("course-detail", { course })} T={T} />
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: T.fg, marginBottom: 4 }}>Upload Questions</h1>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>{course.code} — {course.title}</p>

      <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>📋 Required Format</p>
        <pre style={{ fontSize: 11, color: "#78350f", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "DM Mono, monospace" }}>
{`1. Question text here?
A. First option
B. Second option
C. Third option
D. Fourth option
Answer: B

2. Next question...`}
        </pre>
      </div>

      {!previewing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Topic / Chapter</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Wave Motion, Chapter 3"
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 14, background: T.bg, color: T.fg }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Paste Questions</label>
            <textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder="Paste your AI-generated questions here..."
              style={{ width: "100%", minHeight: 220, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "14px", fontSize: 13, resize: "vertical", background: T.bg, color: T.fg, fontFamily: "DM Mono, monospace", lineHeight: 1.7 }} />
          </div>
          <button onClick={preview} style={{ background: T.fg, color: T.bg, borderRadius: 14, padding: "15px", fontWeight: 700, fontSize: 15 }}>Preview Questions</button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: T.fg }}>{parsed.length} questions ready</h3>
            <button onClick={() => setPreviewing(false)} style={{ color: T.muted, fontSize: 13, fontWeight: 600 }}>Edit</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto", marginBottom: 20 }}>
            {parsed.slice(0, 6).map((q, i) => (
              <div key={i} style={{ background: T.surface, borderRadius: 12, padding: 14, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.fg, marginBottom: 8 }}>Q{i+1}. {q.question}</p>
                {["A","B","C","D"].map(l => (
                  <div key={l} style={{ fontSize: 12, color: l === q.answer ? T.correct : T.muted, marginBottom: 2, fontWeight: l === q.answer ? 700 : 400 }}>
                    {l === q.answer ? "✓ " : "  "}{l}. {q[l]}
                  </div>
                ))}
              </div>
            ))}
            {parsed.length > 6 && <p style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "8px 0" }}>+{parsed.length - 6} more questions</p>}
          </div>
          <button onClick={upload} disabled={uploading} style={{ background: T.fg, color: T.bg, borderRadius: 14, padding: "15px", fontWeight: 700, fontSize: 15, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? <><Spinner color={T.bg} /> Uploading...</> : `Upload All ${parsed.length} Questions`}
          </button>
        </div>
      )}
    </Screen>
  );
}

// ─── MODE SELECT ──────────────────────────────────────────────────────────────
function ModeSelectScreen({ nav, showToast, T, ctx }) {
  const course = ctx.course;
  const modes = [
    {
      id: "test", emoji: "🧪", title: "Test Mode",
      desc: "Answer all questions. No feedback during. Full results & grade at the end.",
      color: "#1e40af", light: "#dbeafe",
    },
    {
      id: "study", emoji: "📖", title: "Study Mode",
      desc: "See the correct answer immediately after each pick. AI explains wrong answers on the spot.",
      color: "#15803d", light: "#dcfce7",
    },
    {
      id: "practice", emoji: "🏋️", title: "Practice Mode",
      desc: "Wrong answers repeat until you get them right. Build mastery through repetition.",
      color: "#9333ea", light: "#f3e8ff",
    },
  ];

  return (
    <Screen>
      <Back onClick={() => nav("course-detail", { course })} T={T} />
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: T.fg, marginBottom: 4 }}>Choose Mode</h1>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 28 }}>{course.code} — {course.title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => nav("test-setup", { course, mode: m.id })} style={{
            background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 18,
            padding: "20px 18px", textAlign: "left", cursor: "pointer", transition: "all 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, background: m.light, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{m.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.fg }}>{m.title}</div>
            </div>
            <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>{m.desc}</p>
          </button>
        ))}
      </div>
    </Screen>
  );
}

// ─── TEST SETUP ───────────────────────────────────────────────────────────────
function TestSetupScreen({ user, token, nav, showToast, T, ctx }) {
  const { course, mode } = ctx;
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [numQ, setNumQ] = useState("20");
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const [loading, setLoading] = useState(true);
  const [totalQ, setTotalQ] = useState(0);

  useEffect(() => { loadTopics(); }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const qs = await sbFetch(`questions?course_id=eq.${course.id}&select=topic`, {}, token);
      if (qs) {
        setTotalQ(qs.length);
        const map = {};
        qs.forEach(q => { const t = q.topic || "General"; map[t] = (map[t] || 0) + 1; });
        const t = Object.entries(map).map(([name, count]) => ({ name, count }));
        setTopics(t);
        setSelectedTopics(t.map(x => x.name));
      }
    } catch (e) {}
    setLoading(false);
  };

  const modeEmoji = mode === "test" ? "🧪" : mode === "study" ? "📖" : "🏋️";
  const modeLabel = mode === "test" ? "Test" : mode === "study" ? "Study" : "Practice";

  const start = async () => {
    if (!selectedTopics.length) return showToast("Select at least one topic", "error");
    const n = parseInt(numQ);
    if (!n || n < 1) return showToast("Enter valid number of questions", "error");
    if (n > totalQ) return showToast(`Only ${totalQ} questions available`, "error");
    nav("session", { course, mode, selectedTopics, numQ: n, timed, minutes: parseInt(minutes) || 30 });
  };

  const Toggle = ({ value, onChange, label, sub }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.fg }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 50, height: 28, borderRadius: 14, background: value ? T.fg : T.border, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s",
      }}>
        <div style={{ width: 22, height: 22, background: "#fff", borderRadius: "50%", position: "absolute", top: 3, left: value ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );

  return (
    <Screen>
      <Back onClick={() => nav("mode-select", { course })} T={T} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>{modeEmoji}</span>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: T.fg }}>{modeLabel} Setup</h1>
      </div>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 28 }}>{course.code} · {totalQ} questions available</p>

      {loading ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Topics */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Select Topics</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={() => setSelectedTopics(topics.map(t=>t.name))} style={{
                padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                background: selectedTopics.length === topics.length ? T.fg : T.surface,
                color: selectedTopics.length === topics.length ? T.bg : T.fg,
                border: `1.5px solid ${T.border}`,
              }}>All</button>
              {topics.map(t => (
                <button key={t.name} onClick={() => setSelectedTopics(prev => prev.includes(t.name) ? prev.filter(x=>x!==t.name) : [...prev, t.name])} style={{
                  padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                  background: selectedTopics.includes(t.name) ? T.fg : T.surface,
                  color: selectedTopics.includes(t.name) ? T.bg : T.fg,
                  border: `1.5px solid ${T.border}`,
                }}>{t.name} ({t.count})</button>
              ))}
            </div>
          </div>

          {/* Number of questions */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Number of Questions</label>
            <input type="number" value={numQ} onChange={e => setNumQ(e.target.value)} placeholder="20"
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 16, fontWeight: 700, background: T.bg, color: T.fg }} />
          </div>

          {/* Timer — only for test mode */}
          {mode === "test" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Toggle value={timed} onChange={setTimed} label="Enable Timer" sub="Set a countdown for your test" />
              {timed && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Minutes</label>
                  <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                    style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 16, fontWeight: 700, background: T.bg, color: T.fg }} />
                </div>
              )}
            </div>
          )}

          <button onClick={start} style={{ background: T.fg, color: T.bg, borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {modeEmoji} Start {modeLabel}
          </button>
        </div>
      )}
    </Screen>
  );
}

// ─── SESSION (Test / Study / Practice) ───────────────────────────────────────
function SessionScreen({ user, token, nav, showToast, T, ctx }) {
  const { course, mode, selectedTopics, numQ, timed, minutes } = ctx;
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [loadingExp, setLoadingExp] = useState(false);
  const [flags, setFlags] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  // Practice mode: queue of questions including repeats
  const [practiceQueue, setPracticeQueue] = useState([]);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => { loadQuestions(); }, []);

  useEffect(() => {
    if (timed && mode === "test" && timeLeft === null && questions.length > 0) {
      setTimeLeft(minutes * 60);
    }
  }, [questions]);

  useEffect(() => {
    if (timed && mode === "test" && timeLeft !== null) {
      if (timeLeft <= 0) { finish(answers); return; }
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timerRef.current);
    }
  }, [timeLeft, timed, mode]);

  const loadQuestions = async () => {
    setLoading(true); setAiLoading(true);
    try {
      const topicFilter = selectedTopics.map(t => `topic.eq.${t}`).join(",");
      const all = await sbFetch(`questions?course_id=eq.${course.id}&or=(${topicFilter})&select=*`, {}, token);
      if (!all?.length) { showToast("No questions in selected topics", "error"); nav("test-setup", { course, mode }); return; }
      // Get recent question ids for AI
      let recentIds = [];
      try {
        const recent = await sbFetch(`sessions?user_id=eq.${user.id}&course_id=eq.${course.id}&order=created_at.desc&limit=5&select=question_ids`, {}, token);
        recentIds = (recent || []).flatMap(s => s.question_ids || []);
      } catch {}
      const picked = await aiPickQuestions(all, numQ, recentIds);
      setQuestions(picked);
      if (mode === "practice") setPracticeQueue([...picked]);
      setLoading(false); setAiLoading(false);
    } catch (e) { showToast("Failed to load: " + e.message, "error"); setLoading(false); setAiLoading(false); }
  };

  const currentQ = mode === "practice" ? practiceQueue[practiceIdx] : questions[current];

  const handleSelect = async (letter) => {
    if (revealed) return;
    setSelected(letter);
    if (mode === "study") {
      setRevealed(true);
      if (letter !== currentQ.answer) {
        setLoadingExp(true);
        const exp = await askAI(`Explain why the correct answer to this question is ${currentQ.answer} in 3-4 sentences.\nQuestion: ${currentQ.question}\nA. ${currentQ.A}\nB. ${currentQ.B}\nC. ${currentQ.C}\nD. ${currentQ.D}\nCorrect: ${currentQ.answer}. ${currentQ[currentQ.answer]}`);
        setExplanation(exp);
        setLoadingExp(false);
      }
    } else if (mode === "practice") {
      setRevealed(true);
    }
  };

  const nextQuestion = () => {
    if (mode === "practice") {
      const correct = selected === currentQ.answer;
      if (correct) {
        setMasteredCount(m => m + 1);
        const newQueue = [...practiceQueue];
        newQueue.splice(practiceIdx, 1);
        if (!newQueue.length) {
          // All mastered
          nav("results", { course, mode, questions, answers: {}, score: questions.length, total: questions.length, masteredAll: true });
          return;
        }
        setPracticeQueue(newQueue);
        setPracticeIdx(p => p >= newQueue.length ? 0 : p);
      } else {
        // Move to end of queue
        const newQueue = [...practiceQueue];
        const q = newQueue.splice(practiceIdx, 1)[0];
        newQueue.push(q);
        setPracticeQueue(newQueue);
        if (practiceIdx >= newQueue.length) setPracticeIdx(0);
      }
      setSelected(null); setRevealed(false); setExplanation("");
    } else if (mode === "study") {
      const newAnswers = { ...answers, [current]: selected };
      setAnswers(newAnswers);
      setSelected(null); setRevealed(false); setExplanation("");
      if (current + 1 >= questions.length) { finish(newAnswers); }
      else setCurrent(c => c + 1);
    } else {
      // Test mode
      if (!selected) return showToast("Select an answer", "error");
      const newAnswers = { ...answers, [current]: selected };
      setAnswers(newAnswers);
      setSelected(null);
      if (current + 1 >= questions.length) { finish(newAnswers); }
      else setCurrent(c => c + 1);
    }
  };

  const finish = (finalAnswers) => {
    clearTimeout(timerRef.current);
    const score = questions.filter((q, i) => finalAnswers[i] === q.answer).length;
    nav("results", { course, mode, questions, answers: finalAnswers, score, total: questions.length, timeLeft, timed, minutes, flags: [...flags] });
  };

  const toggleFlag = () => {
    setFlags(prev => {
      const n = new Set(prev);
      if (n.has(current)) n.delete(current); else n.add(current);
      return n;
    });
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (loading || aiLoading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Spinner size={40} />
      <p style={{ color: T.muted, fontSize: 14 }}>{aiLoading ? "AI is selecting your questions..." : "Loading..."}</p>
    </div>
  );

  if (!currentQ) return null;

  const progress = mode === "practice"
    ? (masteredCount / questions.length) * 100
    : ((current) / questions.length) * 100;

  const qNum = mode === "practice" ? masteredCount + 1 : current + 1;
  const qTotal = mode === "practice" ? questions.length : questions.length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", maxWidth: 540, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "20px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>
            {mode === "practice" ? `${masteredCount}/${qTotal} mastered` : `${qNum}/${qTotal}`}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {timed && mode === "test" && timeLeft !== null && (
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "DM Mono, monospace", color: timeLeft < 60 ? T.wrong : T.fg, animation: timeLeft < 30 ? "pulse 1s infinite" : "none" }}>
                ⏱ {formatTime(timeLeft)}
              </span>
            )}
            {mode === "test" && (
              <button onClick={toggleFlag} style={{ fontSize: 18, background: "none", border: "none" }}>
                {flags.has(current) ? "🚩" : "⚑"}
              </button>
            )}
            <button onClick={() => { clearTimeout(timerRef.current); nav("course-detail", { course }); }} style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>Quit</button>
          </div>
        </div>
        <div style={{ height: 5, background: T.surface, borderRadius: 3 }}>
          <div style={{ height: "100%", background: T.fg, borderRadius: 3, width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Question */}
      <div className="slide-in" key={`${current}-${practiceIdx}`} style={{ flex: 1, padding: "20px 18px", overflowY: "auto" }}>
        <div style={{ background: T.fg, borderRadius: 20, padding: "22px 18px", marginBottom: 20, color: T.bg }}>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {mode === "test" ? "🧪 TEST" : mode === "study" ? "📖 STUDY" : "🏋️ PRACTICE"}
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.65, fontWeight: 600 }}>{currentQ.question}</p>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["A", "B", "C", "D"].map(letter => {
            let bg = T.card, border = T.border, color = T.fg;
            if (revealed) {
              if (letter === currentQ.answer) { bg = "#dcfce7"; border = T.correct; color = T.correct; }
              else if (letter === selected) { bg = "#fee2e2"; border = T.wrong; color = T.wrong; }
            } else if (selected === letter) {
              bg = T.fg; border = T.fg; color = T.bg;
            }
            return (
              <button key={letter} onClick={() => handleSelect(letter)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "15px 16px",
                border: `2px solid ${border}`, borderRadius: 14, background: bg, color,
                cursor: revealed ? "default" : "pointer", transition: "all 0.15s", textAlign: "left",
              }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: revealed ? "transparent" : (selected === letter ? "rgba(255,255,255,0.2)" : T.surface), fontSize: 13, fontWeight: 800 }}>{letter}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45 }}>{currentQ[letter]}</span>
                {revealed && letter === currentQ.answer && <span style={{ marginLeft: "auto", fontSize: 16 }}>✓</span>}
                {revealed && letter === selected && letter !== currentQ.answer && <span style={{ marginLeft: "auto", fontSize: 16 }}>✗</span>}
              </button>
            );
          })}
        </div>

        {/* Explanation (study/practice) */}
        {revealed && (selected !== currentQ.answer) && (
          <div style={{ marginTop: 16, background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: 16 }}>
            {loadingExp ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Spinner size={18} /> <span style={{ fontSize: 13, color: "#1e40af" }}>AI is explaining...</span>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.7 }}>🤖 {explanation}</p>
            )}
          </div>
        )}
        {revealed && selected === currentQ.answer && (
          <div style={{ marginTop: 16, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 14, padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: T.correct, fontWeight: 700 }}>✓ Correct!</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "14px 18px 32px", borderTop: `1px solid ${T.border}` }}>
        {mode === "test" && !revealed ? (
          <button onClick={nextQuestion} disabled={!selected} style={{ width: "100%", background: selected ? T.fg : T.surface, color: selected ? T.bg : T.muted, borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15, opacity: selected ? 1 : 0.7 }}>
            {current + 1 === questions.length ? "Finish Test ✓" : "Next →"}
          </button>
        ) : revealed ? (
          <button onClick={nextQuestion} style={{ width: "100%", background: T.fg, color: T.bg, borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15 }}>
            {mode === "practice" && selected === currentQ.answer ? "Next ✓" : mode === "practice" ? "Retry Later →" : "Next →"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsScreen({ user, token, nav, showToast, T, ctx }) {
  const { course, mode, questions, answers, score, total, timeLeft, timed, minutes, flags, masteredAll } = ctx;
  const pct = Math.round((score / total) * 100);
  const { grade, color } = getGrade(pct);
  const [confetti, setConfetti] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pct >= 70) spawnConfetti();
    saveSession();
  }, []);

  const spawnConfetti = () => {
    const pieces = Array.from({ length: 40 }, (_, i) => ({
      id: i, x: Math.random() * 100, color: ["#0a0a0a","#888","#ccc","#444","#666"][i % 5],
      delay: Math.random() * 2, dur: 2 + Math.random() * 2, size: 6 + Math.random() * 8,
    }));
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 5000);
  };

  const saveSession = async () => {
    if (saved || mode === "practice") return;
    try {
      const timeTaken = timed ? (minutes * 60 - (timeLeft || 0)) : null;
      await sbFetch("sessions", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id, course_id: course.id, course_code: course.code,
          score, total, percentage: pct, grade, mode,
          time_taken: timeTaken,
          answers: JSON.stringify(answers),
          question_ids: questions.map(q => q.id),
        }),
      }, token);
      setSaved(true);
    } catch (e) {}
  };

  const wrong = questions.filter((q, i) => answers[i] !== q.answer).length;
  const timeTaken = timed ? (minutes * 60 - (timeLeft || 0)) : null;
  const fmt = (s) => s ? `${Math.floor(s / 60)}m ${s % 60}s` : "—";
  const flaggedCount = (flags || []).length;

  return (
    <Screen>
      {/* Confetti */}
      {confetti.map(p => (
        <div key={p.id} style={{
          position: "fixed", left: `${p.x}%`, top: -10, width: p.size, height: p.size,
          background: p.color, borderRadius: 2, zIndex: 9998,
          animation: `confetti ${p.dur}s ${p.delay}s linear forwards`,
        }} />
      ))}

      <div className="pop" style={{ textAlign: "center", paddingTop: 20, marginBottom: 32 }}>
        <div style={{ fontSize: 72, marginBottom: 4 }}>
          {masteredAll ? "🏆" : pct >= 70 ? "🎉" : pct >= 50 ? "💪" : "📚"}
        </div>
        {masteredAll ? (
          <h2 style={{ fontSize: 28, fontWeight: 800, color: T.correct }}>All Mastered!</h2>
        ) : (
          <>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.05em", color, lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontSize: 36, fontWeight: 800, color, marginBottom: 6 }}>{grade}</div>
            <p style={{ color: T.muted, fontSize: 15 }}>{score} correct out of {total}</p>
          </>
        )}
      </div>

      {/* Stats row */}
      {!masteredAll && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 28 }}>
          {[
            { l: "✓ Correct", v: score, c: T.correct },
            { l: "✗ Wrong", v: wrong, c: T.wrong },
            { l: "⏱ Time", v: fmt(timeTaken), c: T.fg },
            { l: "🚩 Flagged", v: flaggedCount, c: T.warn },
          ].map(s => (
            <div key={s.l} style={{ background: T.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2, lineHeight: 1.3 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!masteredAll && mode === "test" && (
          <button onClick={() => nav("review", ctx)} style={{ background: T.fg, color: T.bg, borderRadius: 14, padding: "15px", fontWeight: 800, fontSize: 15 }}>📋 Review Answers</button>
        )}
        <button onClick={() => nav("mode-select", { course })} style={{ background: T.surface, color: T.fg, borderRadius: 14, padding: "14px", fontWeight: 700, fontSize: 15, border: `1.5px solid ${T.border}` }}>🔄 Try Again</button>
        <button onClick={() => nav("home")} style={{ background: "transparent", color: T.muted, borderRadius: 14, padding: "12px", fontWeight: 600, fontSize: 14 }}>🏠 Home</button>
      </div>
    </Screen>
  );
}

// ─── REVIEW ───────────────────────────────────────────────────────────────────
function ReviewScreen({ user, token, nav, showToast, T, ctx }) {
  const { course, questions, answers, score, total, flags } = ctx;
  const [filter, setFilter] = useState("all");
  const [explanations, setExplanations] = useState({});
  const [loadingExp, setLoadingExp] = useState({});

  const explain = async (i) => {
    if (explanations[i]) return;
    setLoadingExp(p => ({ ...p, [i]: true }));
    const q = questions[i];
    const exp = await askAI(`Explain clearly why the correct answer to this multiple choice question is ${q.answer}.\nQuestion: ${q.question}\nA. ${q.A}\nB. ${q.B}\nC. ${q.C}\nD. ${q.D}\nCorrect: ${q.answer}. ${q[q.answer]}\nStudent answered: ${answers[i]}. ${q[answers[i]]}\nBe direct and educational in 3-5 sentences.`);
    setExplanations(p => ({ ...p, [i]: exp }));
    setLoadingExp(p => ({ ...p, [i]: false }));
  };

  const flagSet = new Set(flags || []);
  const filtered = questions.map((q, i) => ({ q, i })).filter(({ q, i }) => {
    if (filter === "wrong") return answers[i] !== q.answer;
    if (filter === "correct") return answers[i] === q.answer;
    if (filter === "flagged") return flagSet.has(i);
    return true;
  });

  return (
    <Screen>
      <Back onClick={() => nav("results", ctx)} T={T} />
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.fg, marginBottom: 4 }}>Review</h1>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>{score}/{total} correct</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[["all","All"],["wrong","Wrong"],["correct","Correct"],["flagged","Flagged 🚩"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: "none",
            background: filter === v ? T.fg : T.surface, color: filter === v ? T.bg : T.fg,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filtered.map(({ q, i }) => {
          const correct = answers[i] === q.answer;
          return (
            <div key={i} style={{ border: `1.5px solid ${correct ? T.correct : T.wrong}44`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px", background: correct ? (T.bg === "#ffffff" ? "#f0fdf4" : "#0a1f0a") : (T.bg === "#ffffff" ? "#fff5f5" : "#1f0a0a") }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{correct ? "✅" : "❌"}</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.fg, lineHeight: 1.5 }}>Q{i + 1}. {q.question}</p>
                  {flagSet.has(i) && <span style={{ marginLeft: "auto", fontSize: 14, flexShrink: 0 }}>🚩</span>}
                </div>
                {["A","B","C","D"].map(l => (
                  <div key={l} style={{
                    fontSize: 13, padding: "6px 10px", borderRadius: 8, marginBottom: 4,
                    background: l === q.answer ? `${T.correct}22` : l === answers[i] && !correct ? `${T.wrong}22` : "transparent",
                    color: l === q.answer ? T.correct : l === answers[i] && !correct ? T.wrong : T.muted,
                    fontWeight: l === q.answer || l === answers[i] ? 700 : 400,
                  }}>
                    {l === q.answer ? "✓ " : l === answers[i] && !correct ? "✗ " : "   "}{l}. {q[l]}
                  </div>
                ))}
              </div>
              {!correct && (
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, background: T.card }}>
                  {!explanations[i] ? (
                    <button onClick={() => explain(i)} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1e40af", fontSize: 13, fontWeight: 700 }}>
                      {loadingExp[i] ? <><Spinner size={16} /> Loading AI explanation...</> : "🤖 Get AI Explanation"}
                    </button>
                  ) : (
                    <p style={{ fontSize: 13, color: T.fg, lineHeight: 1.7 }}>🤖 {explanations[i]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ textAlign: "center", color: T.muted, padding: "40px 0" }}>Nothing to show here.</p>}
      </div>
    </Screen>
  );
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────
function PerformanceScreen({ user, token, nav, showToast, T }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("all");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const s = await sbFetch(`sessions?user_id=eq.${user.id}&order=created_at.desc`, {}, token);
      setSessions(s || []);
    } catch (e) {}
    setLoading(false);
  };

  const clear = async () => {
    if (!window.confirm("Clear all history? Cannot be undone.")) return;
    setClearing(true);
    try {
      await sbFetch(`sessions?user_id=eq.${user.id}`, { method: "DELETE" }, token);
      setSessions([]);
      showToast("History cleared", "success");
    } catch (e) { showToast("Failed", "error"); }
    setClearing(false);
  };

  const codes = ["all", ...new Set(sessions.map(s => s.course_code).filter(Boolean))];
  const filtered = selectedCourse === "all" ? sessions : sessions.filter(s => s.course_code === selectedCourse);
  const avg = filtered.length ? Math.round(filtered.reduce((a, s) => a + (s.percentage || 0), 0) / filtered.length) : 0;
  const best = filtered.length ? Math.max(...filtered.map(s => s.percentage || 0)) : 0;

  // Chart data — last 10 sessions
  const chartData = [...filtered].reverse().slice(-10);

  return (
    <Screen>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.fg }}>Performance</h1>
        {sessions.length > 0 && <button onClick={clear} disabled={clearing} style={{ fontSize: 13, color: T.wrong, fontWeight: 700, background: "none", border: "none" }}>{clearing ? "..." : "Clear"}</button>}
      </div>
      <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>{sessions.length} total sessions</p>

      {/* Course filter */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 20 }}>
        {codes.map(c => (
          <button key={c} onClick={() => setSelectedCourse(c)} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, flexShrink: 0,
            background: selectedCourse === c ? T.fg : T.surface,
            color: selectedCourse === c ? T.bg : T.fg,
            border: `1.5px solid ${T.border}`,
          }}>{c === "all" ? "All Courses" : c}</button>
        ))}
      </div>

      {loading ? <Spinner /> : sessions.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ color: T.muted }}>No sessions yet. Take a test!</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
            {[{ l: "Sessions", v: filtered.length }, { l: "Average", v: `${avg}%` }, { l: "Best", v: `${best}%` }].map(s => (
              <div key={s.l} style={{ background: T.fg, borderRadius: 14, padding: "16px 10px", textAlign: "center", color: T.bg }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{s.v}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Score chart */}
          {chartData.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Score Trend</h3>
              <div style={{ background: T.surface, borderRadius: 16, padding: "20px 16px", border: `1px solid ${T.border}` }}>
                <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 50, 100].map(y => (
                    <line key={y} x1="0" y1={100 - y} x2="300" y2={100 - y} stroke={T.border} strokeWidth="1" />
                  ))}
                  {/* Line */}
                  <polyline
                    points={chartData.map((s, i) => `${(i / (chartData.length - 1)) * 300},${100 - (s.percentage || 0)}`).join(" ")}
                    fill="none" stroke={T.fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                  {/* Dots */}
                  {chartData.map((s, i) => {
                    const { color } = getGrade(s.percentage || 0);
                    return <circle key={i} cx={(i / (chartData.length - 1)) * 300} cy={100 - (s.percentage || 0)} r="4" fill={color} />;
                  })}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>Oldest</span>
                  <span style={{ fontSize: 11, color: T.muted }}>Latest</span>
                </div>
              </div>
            </div>
          )}

          {/* Session list */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Sessions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(s => {
              const { grade, color } = getGrade(s.percentage || 0);
              const modeEmoji = s.mode === "study" ? "📖" : s.mode === "practice" ? "🏋️" : "🧪";
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.fg }}>{modeEmoji} {s.course_code}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.fg }}>{s.score}/{s.total}</span>
                    <span style={{ background: color, color: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 800 }}>{grade}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileScreen({ user, token, nav, showToast, T, logout }) {
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const avatar = user?.user_metadata?.avatar_url;
  const initials = (user?.user_metadata?.full_name || user?.email || "?").slice(0, 2).toUpperCase();
  const uid = user?.id?.slice(0, 8).toUpperCase();

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showToast("Image must be under 2MB", "error");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      // Upload to Supabase Storage
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${path}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": file.type, "x-upsert": "true" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const url = `${SUPABASE_URL}/storage/v1/object/public/${path}`;
      // Update user metadata
      await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { avatar_url: url } }),
      });
      const updated = { ...user, user_metadata: { ...user.user_metadata, avatar_url: url } };
      localStorage.setItem("md_user", JSON.stringify(updated));
      showToast("Avatar updated!", "success");
      window.location.reload();
    } catch (e) { showToast("Failed to upload: " + e.message, "error"); }
    setUploading(false);
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { full_name: name.trim() } }),
      });
      const updated = { ...user, user_metadata: { ...user.user_metadata, full_name: name.trim() } };
      localStorage.setItem("md_user", JSON.stringify(updated));
      showToast("Name updated!", "success");
    } catch (e) { showToast("Failed to update", "error"); }
    setSaving(false);
  };

  return (
    <Screen>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: T.fg, marginBottom: 28 }}>Profile</h1>

      {/* Avatar */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div onClick={() => fileRef.current?.click()} style={{ width: 90, height: 90, borderRadius: "50%", background: T.fg, border: `3px solid ${T.border}`, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {avatar ? <img src={avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: T.bg, fontSize: 28, fontWeight: 800 }}>{initials}</span>}
          {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner color="#fff" /></div>}
        </div>
        <p style={{ color: T.muted, fontSize: 12, marginTop: 8 }}>Tap to change photo</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "none" }} />
      </div>

      {/* User ID */}
      <div style={{ background: T.surface, borderRadius: 14, padding: "16px", marginBottom: 20, border: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Your Unique ID</p>
        <p style={{ fontSize: 18, fontWeight: 800, color: T.fg, fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>#{uid}</p>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{user?.email}</p>
      </div>

      {/* Edit name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Display Name</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ flex: 1, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 15, background: T.bg, color: T.fg }} />
          <button onClick={saveName} disabled={saving} style={{ background: T.fg, color: T.bg, borderRadius: 12, padding: "13px 18px", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {saving ? <Spinner color={T.bg} size={18} /> : "Save"}
          </button>
        </div>
      </div>

      {/* Sign out */}
      <button onClick={logout} style={{ width: "100%", background: "#fff1f2", color: T.wrong, borderRadius: 14, padding: "14px", fontWeight: 700, fontSize: 15, border: `1.5px solid #fecdd3`, marginTop: 8 }}>
        Sign Out
      </button>
    </Screen>
  );
}
