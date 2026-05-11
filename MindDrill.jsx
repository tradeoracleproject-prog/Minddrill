import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://lezdidskdvykmumajedj.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlemRpZHNrZHZ5a211bWFqZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTI0MDMsImV4cCI6MjA5NDA2ODQwM30.R-dzOu1WmfV7mqBg35bd1m4NgMUVxEoNQtwuNFkSnVE";
const GEMINI_KEY = "AlzaSyA_zKKKcJOy35EvMZthYh0qFazyVS240ak";

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────
const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
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

// ─── GEMINI HELPER ────────────────────────────────────────────────────────────
const askGemini = async (prompt) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation available.";
};

// ─── QUESTION PARSER ──────────────────────────────────────────────────────────
const parseQuestions = (raw) => {
  const questions = [];
  // Split by numbered question pattern
  const blocks = raw.split(/\n(?=\d+[\.\)]\s)/);
  for (const block of blocks) {
    const lines = block.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 5) continue;
    // Extract question text
    const qLine = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
    // Extract options
    const opts = {};
    const optLines = lines.filter(l => /^[A-D][\.\)]/i.test(l));
    for (const o of optLines) {
      const letter = o[0].toUpperCase();
      opts[letter] = o.replace(/^[A-D][\.\)]\s*/i, "").trim();
    }
    // Extract answer
    const ansLine = lines.find(l => /^answer\s*:/i.test(l));
    if (!ansLine) continue;
    const ans = ansLine.replace(/^answer\s*:\s*/i, "").trim().toUpperCase()[0];
    if (!qLine || Object.keys(opts).length < 4 || !["A","B","C","D"].includes(ans)) continue;
    // Normalize math symbols
    const normalize = (s) => s
      .replace(/\^2/g, "²").replace(/\^3/g, "³")
      .replace(/sqrt\(/g, "√(").replace(/>=/, "≥").replace(/<=/, "≤")
      .replace(/!=/g, "≠").replace(/\bpi\b/gi, "π").replace(/\bdelta\b/gi, "Δ")
      .replace(/\balpha\b/gi, "α").replace(/\bbeta\b/gi, "β").replace(/\btheta\b/gi, "θ")
      .replace(/\blambda\b/gi, "λ").replace(/\bsigma\b/gi, "σ").replace(/\bmu\b/gi, "μ")
      .replace(/\bomega\b/gi, "ω").replace(/\binfinity\b/gi, "∞");
    questions.push({
      question: normalize(qLine),
      A: normalize(opts.A || ""),
      B: normalize(opts.B || ""),
      C: normalize(opts.C || ""),
      D: normalize(opts.D || ""),
      answer: ans,
    });
  }
  return questions;
};

// ─── INITIAL COURSES ──────────────────────────────────────────────────────────
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const G = {
  bg: "#ffffff",
  fg: "#0a0a0a",
  muted: "#6b6b6b",
  border: "#e0e0e0",
  accent: "#0a0a0a",
  correct: "#16a34a",
  wrong: "#dc2626",
  warn: "#d97706",
  surface: "#f5f5f5",
  pill: "#0a0a0a",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: 'Space Grotesk', sans-serif; background: ${G.bg}; color: ${G.fg}; min-height: 100vh; overflow-x: hidden; }
  input, textarea, select { font-family: inherit; }
  button { cursor: pointer; font-family: inherit; border: none; background: none; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 2px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  .fade-up { animation: fadeUp 0.35s ease forwards; }
  .spin { animation: spin 0.8s linear infinite; }
`;

// ─── TINY COMPONENTS ──────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="spin" style={{ width:24,height:24,border:`3px solid ${G.border}`,borderTopColor:G.fg,borderRadius:"50%",display:"inline-block" }} />
);

const Btn = ({ children, onClick, variant="primary", style={}, disabled=false, small=false }) => {
  const base = {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
    borderRadius:12, fontWeight:600, fontSize: small?13:15, letterSpacing:"-0.01em",
    padding: small?"8px 16px":"14px 24px", transition:"all 0.15s", cursor: disabled?"not-allowed":"pointer",
    opacity: disabled?0.5:1, ...style
  };
  const variants = {
    primary: { background:G.fg, color:"#fff" },
    outline: { background:"transparent", color:G.fg, border:`2px solid ${G.fg}` },
    ghost: { background:G.surface, color:G.fg },
    danger: { background:G.wrong, color:"#fff" },
    success: { background:G.correct, color:"#fff" },
  };
  return <button style={{...base,...variants[variant]}} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{
    background:G.bg, border:`1.5px solid ${G.border}`, borderRadius:16,
    padding:"20px", transition:"all 0.15s", cursor:onClick?"pointer":"default",
    ...(onClick?{":hover":{borderColor:G.fg}}:{}), ...style
  }}>{children}</div>
);

const Input = ({ label, value, onChange, type="text", placeholder="", required=false, style={} }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    {label && <label style={{ fontSize:13, fontWeight:600, color:G.muted, letterSpacing:"0.05em", textTransform:"uppercase" }}>{label}</label>}
    <input
      type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} required={required}
      style={{ border:`1.5px solid ${G.border}`, borderRadius:10, padding:"12px 14px",
        fontSize:15, background:G.bg, color:G.fg, outline:"none", width:"100%", ...style }}
    />
  </div>
);

const Badge = ({ children, color=G.fg }) => (
  <span style={{ background:color, color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>{children}</span>
);

const Tag = ({ children }) => (
  <span style={{ background:G.surface, color:G.muted, borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:500 }}>{children}</span>
);

const Back = ({ onClick }) => (
  <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:6, color:G.muted, fontSize:14, fontWeight:600, marginBottom:24, background:"none", border:"none", cursor:"pointer" }}>
    ← Back
  </button>
);

const Screen = ({ children, style={} }) => (
  <div className="fade-up" style={{ minHeight:"100vh", padding:"24px 20px 100px", maxWidth:520, margin:"0 auto", ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>{children}</h2>
);

// ─── GRADE HELPER ─────────────────────────────────────────────────────────────
const getGrade = (pct) => {
  if (pct >= 90) return { grade:"A+", color:G.correct };
  if (pct >= 80) return { grade:"A", color:G.correct };
  if (pct >= 70) return { grade:"B", color:"#16a34a" };
  if (pct >= 60) return { grade:"C", color:G.warn };
  if (pct >= 50) return { grade:"D", color:G.warn };
  return { grade:"F", color:G.wrong };
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function MindDrill() {
  const [screen, setScreen] = useState("splash");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [toast, setToast] = useState(null);
  // shared state passed to screens
  const [ctx, setCtx] = useState({});

  const showToast = (msg, type="info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const nav = (s, data={}) => { setCtx(data); setScreen(s); };

  useEffect(() => {
    const saved = localStorage.getItem("md_token");
    const savedUser = localStorage.getItem("md_user");
    if (saved && savedUser) {
      setToken(saved);
      setUser(JSON.parse(savedUser));
      setScreen("home");
    } else {
      setTimeout(() => setScreen("auth"), 1800);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("md_token");
    localStorage.removeItem("md_user");
    setUser(null); setToken(null);
    setScreen("auth");
  };

  const authProps = { setUser, setToken, nav, showToast };
  const appProps = { user, token, nav, showToast, ctx, logout };

  return (
    <>
      <style>{css}</style>
      {toast && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="error"?G.wrong: toast.type==="success"?G.correct:G.fg,
          color:"#fff", borderRadius:12, padding:"12px 20px", fontSize:14, fontWeight:600,
          zIndex:9999, maxWidth:320, textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.15)"
        }}>{toast.msg}</div>
      )}
      {screen === "splash" && <SplashScreen />}
      {screen === "auth" && <AuthScreen {...authProps} />}
      {screen === "home" && <HomeScreen {...appProps} />}
      {screen === "courses" && <CoursesScreen {...appProps} />}
      {screen === "course-detail" && <CourseDetailScreen {...appProps} />}
      {screen === "upload" && <UploadScreen {...appProps} />}
      {screen === "test-setup" && <TestSetupScreen {...appProps} />}
      {screen === "test" && <TestScreen {...appProps} />}
      {screen === "results" && <ResultsScreen {...appProps} />}
      {screen === "review" && <ReviewScreen {...appProps} />}
      {screen === "performance" && <PerformanceScreen {...appProps} />}
    </>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:G.fg }}>
      <div style={{ width:72, height:72, background:"#fff", borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:36 }}>⚡</span>
      </div>
      <h1 style={{ fontSize:32, fontWeight:700, color:"#fff", letterSpacing:"-0.04em" }}>MindDrill</h1>
      <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14 }}>Sharpen your mind</p>
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({ setUser, setToken, nav, showToast }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return showToast("Fill in all fields", "error");
    if (mode === "signup" && !name) return showToast("Enter your name", "error");
    setLoading(true);
    try {
      let data;
      if (mode === "signup") {
        data = await sbAuth("signup", { email, password, data: { full_name: name } });
        showToast("Account created! Welcome to MindDrill 🎉", "success");
      } else {
        data = await sbAuth("token?grant_type=password", { email, password });
      }
      const u = data.user || data;
      const t = data.access_token;
      localStorage.setItem("md_token", t);
      localStorage.setItem("md_user", JSON.stringify(u));
      setUser(u); setToken(t);
      nav("home");
    } catch (e) {
      showToast(e.message, "error");
    } finally { setLoading(false); }
  };

  return (
    <Screen style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"40px 24px" }}>
      <div style={{ marginBottom:40 }}>
        <div style={{ width:52, height:52, background:G.fg, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
          <span style={{ fontSize:24 }}>⚡</span>
        </div>
        <h1 style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.04em" }}>MindDrill</h1>
        <p style={{ color:G.muted, fontSize:15, marginTop:6 }}>
          {mode==="signin"?"Welcome back. Let's drill.":"Create your account. Start drilling."}
        </p>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:24 }}>
        {mode==="signup" && <Input label="Full Name" value={name} onChange={setName} placeholder="Your name" />}
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" />
        <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
      </div>
      <Btn onClick={submit} disabled={loading} style={{ width:"100%", marginBottom:16 }}>
        {loading ? <Spinner /> : mode==="signin"?"Sign In":"Create Account"}
      </Btn>
      <p style={{ textAlign:"center", color:G.muted, fontSize:14 }}>
        {mode==="signin"?"No account? ":"Have an account? "}
        <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} style={{ color:G.fg, fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>
          {mode==="signin"?"Sign Up":"Sign In"}
        </button>
      </p>
    </Screen>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeScreen({ user, token, nav, showToast, logout }) {
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const sessions = await sb(`sessions?user_id=eq.${user.id}&order=created_at.desc&limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (sessions) {
        setRecentSessions(sessions.slice(0, 3));
        const total = sessions.length;
        const avgScore = total ? Math.round(sessions.reduce((a,s)=>a+(s.score||0),0)/total) : 0;
        setStats({ total, avgScore });
      }
    } catch(e) {}
  };

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Screen>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
        <div>
          <p style={{ fontSize:13, color:G.muted, fontWeight:500 }}>{greeting}</p>
          <h2 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em" }}>{name.split(" ")[0]} 👋</h2>
        </div>
        <button onClick={logout} style={{ background:G.surface, border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:600, color:G.muted, cursor:"pointer" }}>
          Sign out
        </button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:28 }}>
          {[
            { label:"Total Sessions", value:stats.total, icon:"📚" },
            { label:"Avg Score", value:`${stats.avgScore}%`, icon:"🎯" },
          ].map(s => (
            <div key={s.label} style={{ background:G.fg, borderRadius:16, padding:"18px 16px", color:"#fff" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
              <div style={{ fontSize:24, fontWeight:700 }}>{s.value}</div>
              <div style={{ fontSize:12, opacity:0.6, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <SectionTitle>Quick Start</SectionTitle>
      <p style={{ color:G.muted, fontSize:14, marginBottom:16 }}>What do you want to do?</p>
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:32 }}>
        {[
          { icon:"🚀", label:"Start a Test", sub:"Pick course & drill questions", action:()=>nav("courses", { mode:"test" }) },
          { icon:"📖", label:"Browse Courses", sub:"View all courses & questions", action:()=>nav("courses", { mode:"browse" }) },
          { icon:"📊", label:"My Performance", sub:"Track your progress", action:()=>nav("performance") },
        ].map(a => (
          <div key={a.label} onClick={a.action} style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 20px", border:`1.5px solid ${G.border}`, borderRadius:16, cursor:"pointer", background:G.bg }}>
            <div style={{ fontSize:28, width:44, height:44, background:G.surface, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>{a.icon}</div>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>{a.label}</div>
              <div style={{ fontSize:13, color:G.muted }}>{a.sub}</div>
            </div>
            <div style={{ marginLeft:"auto", color:G.muted }}>›</div>
          </div>
        ))}
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <>
          <SectionTitle>Recent Sessions</SectionTitle>
          <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:10 }}>
            {recentSessions.map(s => {
              const pct = Math.round((s.score/s.total)*100);
              const { grade, color } = getGrade(pct);
              return (
                <div key={s.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:G.surface, borderRadius:12 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{s.course_code || "Mixed"}</div>
                    <div style={{ fontSize:12, color:G.muted }}>{new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:14, fontWeight:600 }}>{s.score}/{s.total}</span>
                    <Badge color={color}>{grade}</Badge>
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
function CoursesScreen({ user, token, nav, showToast, ctx }) {
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
      // Ensure seed courses exist
      const existing = await sb("courses?select=code", { headers:{ Authorization:`Bearer ${token}` } });
      const existingCodes = (existing||[]).map(c=>c.code);
      for (const c of SEED_COURSES) {
        if (!existingCodes.includes(c.code)) {
          await sb("courses", { method:"POST", body:JSON.stringify({ code:c.code, title:c.title, created_by:user.id }), headers:{ Authorization:`Bearer ${token}` } }).catch(()=>{});
        }
      }
      const all = await sb("courses?select=*,questions(count)&order=title.asc", { headers:{ Authorization:`Bearer ${token}` } });
      setCourses(all || []);
    } catch(e) { showToast("Failed to load courses", "error"); }
    setLoading(false);
  };

  const addCourse = async () => {
    if (!newCode.trim() || !newTitle.trim()) return showToast("Fill in code and title", "error");
    const code = newCode.trim().toUpperCase();
    if (courses.find(c=>c.code===code)) return showToast("Course code already exists", "error");
    setAdding(true);
    try {
      await sb("courses", { method:"POST", body:JSON.stringify({ code, title:newTitle.trim(), created_by:user.id }), headers:{ Authorization:`Bearer ${token}` } });
      showToast("Course created!", "success");
      setNewCode(""); setNewTitle(""); setShowAdd(false);
      loadCourses();
    } catch(e) { showToast(e.message, "error"); }
    setAdding(false);
  };

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Screen>
      <Back onClick={()=>nav("home")} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <SectionTitle>Courses</SectionTitle>
        <Btn small onClick={()=>setShowAdd(!showAdd)} variant={showAdd?"ghost":"primary"}>
          {showAdd?"Cancel":"+ New"}
        </Btn>
      </div>
      <p style={{ color:G.muted, fontSize:14, marginBottom:20 }}>{courses.length} courses available</p>

      {showAdd && (
        <div style={{ background:G.surface, borderRadius:16, padding:20, marginBottom:24, display:"flex", flexDirection:"column", gap:12 }}>
          <Input label="Course Code" value={newCode} onChange={setNewCode} placeholder="e.g. PHY201" />
          <Input label="Course Title" value={newTitle} onChange={setNewTitle} placeholder="e.g. Classical Mechanics" />
          <Btn onClick={addCourse} disabled={adding}>{adding?<Spinner />:"Create Course"}</Btn>
        </div>
      )}

      <div style={{ marginBottom:20 }}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Search courses..." />
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", paddingTop:40 }}><Spinner /></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(c => {
            const qCount = c.questions?.[0]?.count || 0;
            return (
              <div key={c.id} onClick={()=>nav("course-detail", { course:c })}
                style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 20px", border:`1.5px solid ${G.border}`, borderRadius:16, cursor:"pointer", background:G.bg }}>
                <div style={{ width:46, height:46, background:G.fg, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:"#fff", fontSize:11, fontWeight:700, textAlign:"center", lineHeight:1.2 }}>{c.code.slice(0,6)}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, lineHeight:1.3 }}>{c.title}</div>
                  <div style={{ fontSize:12, color:G.muted, marginTop:2 }}>{c.code} · {qCount} questions</div>
                </div>
                <div style={{ color:G.muted }}>›</div>
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

// ─── COURSE DETAIL ────────────────────────────────────────────────────────────
function CourseDetailScreen({ user, token, nav, showToast, ctx }) {
  const course = ctx.course;
  const [topics, setTopics] = useState([]);
  const [qCount, setQCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = await sb(`questions?course_id=eq.${course.id}&select=topic`, { headers:{ Authorization:`Bearer ${token}` } });
      if (qs) {
        setQCount(qs.length);
        const topicMap = {};
        qs.forEach(q => { const t = q.topic||"General"; topicMap[t]=(topicMap[t]||0)+1; });
        setTopics(Object.entries(topicMap).map(([name,count])=>({name,count})));
      }
    } catch(e) {}
    setLoading(false);
  };

  return (
    <Screen>
      <Back onClick={()=>nav("courses")} />
      <div style={{ marginBottom:28 }}>
        <Tag>{course.code}</Tag>
        <h2 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginTop:10, lineHeight:1.3 }}>{course.title}</h2>
        <p style={{ color:G.muted, fontSize:14, marginTop:6 }}>{qCount} questions in the bank</p>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:32 }}>
        <Btn onClick={()=>nav("test-setup", { course })} style={{ width:"100%" }}>
          🚀 Start Test
        </Btn>
        <Btn variant="outline" onClick={()=>nav("upload", { course })} style={{ width:"100%" }}>
          📤 Upload Questions
        </Btn>
      </div>

      {loading ? <Spinner /> : topics.length > 0 && (
        <>
          <h3 style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>Topics</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {topics.map(t => (
              <div key={t.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:G.surface, borderRadius:12 }}>
                <span style={{ fontSize:14, fontWeight:500 }}>{t.name}</span>
                <Badge>{t.count}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function UploadScreen({ user, token, nav, showToast, ctx }) {
  const course = ctx.course;
  const [raw, setRaw] = useState("");
  const [topic, setTopic] = useState("");
  const [parsed, setParsed] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const preview = () => {
    if (!raw.trim()) return showToast("Paste your questions first", "error");
    const qs = parseQuestions(raw);
    if (!qs.length) return showToast("No valid questions found. Check the format.", "error");
    setParsed(qs);
    setPreviewing(true);
  };

  const upload = async () => {
    if (!parsed.length) return;
    setUploading(true);
    try {
      // Load existing questions for dedup check
      const existing = await sb(`questions?course_id=eq.${course.id}&select=question`, { headers:{ Authorization:`Bearer ${token}` } });
      const existingSet = new Set((existing||[]).map(q=>q.question.toLowerCase().trim()));

      const toInsert = parsed
        .filter(q => !existingSet.has(q.question.toLowerCase().trim()))
        .map(q => ({ ...q, course_id:course.id, topic:topic.trim()||"General", uploaded_by:user.id }));

      const dupes = parsed.length - toInsert.length;
      if (!toInsert.length) {
        showToast("All questions are duplicates — nothing uploaded", "error");
        setUploading(false);
        return;
      }

      // Insert in batches of 50
      let inserted = 0;
      for (let i=0; i<toInsert.length; i+=50) {
        const batch = toInsert.slice(i,i+50);
        await sb("questions", { method:"POST", body:JSON.stringify(batch), headers:{ Authorization:`Bearer ${token}` } });
        inserted += batch.length;
      }
      setUploadResult({ inserted, dupes, total:parsed.length });
      setPreviewing(false);
      setRaw(""); setParsed([]);
    } catch(e) { showToast(e.message, "error"); }
    setUploading(false);
  };

  if (uploadResult) return (
    <Screen style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:26, fontWeight:700, marginBottom:8 }}>Upload Complete!</h2>
        <p style={{ color:G.muted, fontSize:16, marginBottom:24 }}>
          {uploadResult.inserted} questions added to {course.code}
          {uploadResult.dupes > 0 && `, ${uploadResult.dupes} duplicates skipped`}
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Btn onClick={()=>{ setUploadResult(null); }} style={{ width:"100%" }}>Upload More</Btn>
          <Btn variant="outline" onClick={()=>nav("course-detail", { course })} style={{ width:"100%" }}>Back to Course</Btn>
        </div>
      </div>
    </Screen>
  );

  return (
    <Screen>
      <Back onClick={()=>nav("course-detail", { course })} />
      <SectionTitle>Upload Questions</SectionTitle>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, marginBottom:24 }}>
        <Tag>{course.code}</Tag>
        <span style={{ color:G.muted, fontSize:13 }}>{course.title}</span>
      </div>

      <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:12, padding:16, marginBottom:24 }}>
        <p style={{ fontSize:13, fontWeight:600, color:"#92400e", marginBottom:8 }}>📋 Required Format</p>
        <pre style={{ fontSize:11, color:"#78350f", lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily:"DM Mono, monospace" }}>
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
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Input label="Topic / Chapter (optional)" value={topic} onChange={setTopic} placeholder="e.g. Wave Motion, Chapter 3" />
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:G.muted, letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:6 }}>
              Paste Questions
            </label>
            <textarea
              value={raw} onChange={e=>setRaw(e.target.value)}
              placeholder="Paste your questions here..."
              style={{ width:"100%", minHeight:200, border:`1.5px solid ${G.border}`, borderRadius:10, padding:"12px 14px", fontSize:14, resize:"vertical", background:G.bg, color:G.fg, outline:"none", fontFamily:"DM Mono, monospace", lineHeight:1.6 }}
            />
          </div>
          <Btn onClick={preview} style={{ width:"100%" }}>Preview Questions</Btn>
        </div>
      ) : (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <h3 style={{ fontSize:16, fontWeight:700 }}>{parsed.length} questions found</h3>
            <button onClick={()=>setPreviewing(false)} style={{ color:G.muted, fontSize:13, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>Edit</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20, maxHeight:360, overflowY:"auto" }}>
            {parsed.slice(0,5).map((q,i) => (
              <div key={i} style={{ background:G.surface, borderRadius:12, padding:14 }}>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Q{i+1}. {q.question}</p>
                {["A","B","C","D"].map(l => (
                  <div key={l} style={{ fontSize:12, color: l===q.answer?G.correct:G.muted, marginBottom:2 }}>
                    {l===q.answer?"✓ ":"   "}{l}. {q[l]}
                  </div>
                ))}
              </div>
            ))}
            {parsed.length > 5 && <p style={{ textAlign:"center", color:G.muted, fontSize:13 }}>+ {parsed.length-5} more questions</p>}
          </div>
          <Btn onClick={upload} disabled={uploading} style={{ width:"100%" }}>
            {uploading ? <Spinner /> : `Upload All ${parsed.length} Questions`}
          </Btn>
        </div>
      )}
    </Screen>
  );
}

// ─── TEST SETUP ───────────────────────────────────────────────────────────────
function TestSetupScreen({ user, token, nav, showToast, ctx }) {
  const course = ctx.course;
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [numQ, setNumQ] = useState("20");
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const [shuffle, setShuffle] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTopics(); }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const qs = await sb(`questions?course_id=eq.${course.id}&select=topic`, { headers:{ Authorization:`Bearer ${token}` } });
      if (qs) {
        const topicMap = {};
        qs.forEach(q => { const t = q.topic||"General"; topicMap[t]=(topicMap[t]||0)+1; });
        const t = Object.entries(topicMap).map(([name,count])=>({name,count}));
        setTopics(t);
        setSelectedTopics(t.map(x=>x.name));
      }
    } catch(e) {}
    setLoading(false);
  };

  const toggleTopic = (name) => {
    setSelectedTopics(prev =>
      prev.includes(name) ? prev.filter(t=>t!==name) : [...prev, name]
    );
  };

  const start = () => {
    if (!selectedTopics.length) return showToast("Select at least one topic", "error");
    const n = parseInt(numQ);
    if (!n || n < 1) return showToast("Enter a valid number of questions", "error");
    nav("test", { course, selectedTopics, numQ:n, timed, minutes:parseInt(minutes)||30, shuffle });
  };

  return (
    <Screen>
      <Back onClick={()=>nav("course-detail", { course })} />
      <SectionTitle>Test Setup</SectionTitle>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, marginBottom:28 }}>
        <Tag>{course.code}</Tag>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
          {/* Topics */}
          <div>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Topics</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button onClick={()=>setSelectedTopics(topics.map(t=>t.name))}
                style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:600, background: selectedTopics.length===topics.length?G.fg:G.surface, color: selectedTopics.length===topics.length?"#fff":G.fg, border:"none", cursor:"pointer" }}>
                All
              </button>
              {topics.map(t => (
                <button key={t.name} onClick={()=>toggleTopic(t.name)}
                  style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:600,
                    background: selectedTopics.includes(t.name)?G.fg:G.surface,
                    color: selectedTopics.includes(t.name)?"#fff":G.fg, border:"none", cursor:"pointer" }}>
                  {t.name} ({t.count})
                </button>
              ))}
            </div>
          </div>

          {/* Number of questions */}
          <Input label="Number of Questions" type="number" value={numQ} onChange={setNumQ} placeholder="20" />

          {/* Timer */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <h3 style={{ fontSize:15, fontWeight:700 }}>Timer</h3>
              <button onClick={()=>setTimed(!timed)} style={{
                width:48, height:26, borderRadius:13, background: timed?G.fg:G.border, border:"none", cursor:"pointer",
                position:"relative", transition:"background 0.2s"
              }}>
                <div style={{ width:20, height:20, background:"#fff", borderRadius:"50%", position:"absolute", top:3, left: timed?25:3, transition:"left 0.2s" }} />
              </button>
            </div>
            {timed && <Input label="Minutes" type="number" value={minutes} onChange={setMinutes} placeholder="30" />}
          </div>

          {/* Shuffle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <h3 style={{ fontSize:15, fontWeight:700 }}>Shuffle Questions</h3>
              <p style={{ fontSize:13, color:G.muted }}>Randomize question order</p>
            </div>
            <button onClick={()=>setShuffle(!shuffle)} style={{
              width:48, height:26, borderRadius:13, background: shuffle?G.fg:G.border, border:"none", cursor:"pointer",
              position:"relative", transition:"background 0.2s"
            }}>
              <div style={{ width:20, height:20, background:"#fff", borderRadius:"50%", position:"absolute", top:3, left: shuffle?25:3, transition:"left 0.2s" }} />
            </button>
          </div>

          <Btn onClick={start} style={{ width:"100%", marginTop:8 }}>Start Test 🚀</Btn>
        </div>
      )}
    </Screen>
  );
}

// ─── TEST ─────────────────────────────────────────────────────────────────────
function TestScreen({ user, token, nav, showToast, ctx }) {
  const { course, selectedTopics, numQ, timed, minutes, shuffle } = ctx;
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(timed ? minutes*60 : null);
  const [selected, setSelected] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => { loadQuestions(); }, []);

  useEffect(() => {
    if (timed && timeLeft !== null) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); finish(answers); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timed, questions]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const topicFilter = selectedTopics.map(t=>`topic.eq.${t}`).join(",");
      const all = await sb(`questions?course_id=eq.${course.id}&or=(${topicFilter})&select=*`, { headers:{ Authorization:`Bearer ${token}` } });
      if (!all || !all.length) { showToast("No questions found for selected topics", "error"); nav("test-setup", { course }); return; }
      let pool = shuffle ? all.sort(()=>Math.random()-0.5) : all;
      setQuestions(pool.slice(0, numQ));
    } catch(e) { showToast("Failed to load questions", "error"); }
    setLoading(false);
  };

  const pick = (letter) => setSelected(letter);

  const next = () => {
    if (!selected) return showToast("Select an answer", "error");
    const newAnswers = { ...answers, [current]: selected };
    setAnswers(newAnswers);
    setSelected(null);
    if (current + 1 >= questions.length) {
      finish(newAnswers);
    } else {
      setCurrent(c => c+1);
    }
  };

  const finish = (finalAnswers) => {
    clearInterval(timerRef.current);
    const score = questions.filter((q,i) => finalAnswers[i] === q.answer).length;
    nav("results", { course, questions, answers:finalAnswers, score, total:questions.length, timeLeft, timed, minutes });
  };

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if (loading) return <Screen style={{ display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner /></Screen>;
  if (!questions.length) return null;

  const q = questions[current];
  const progress = (current / questions.length) * 100;

  return (
    <div style={{ minHeight:"100vh", padding:"0", maxWidth:520, margin:"0 auto", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ padding:"20px 20px 0", background:G.bg }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <span style={{ fontSize:13, fontWeight:600, color:G.muted }}>{current+1} / {questions.length}</span>
          {timed && (
            <span style={{ fontSize:16, fontWeight:700, fontFamily:"DM Mono, monospace", color: timeLeft<60?G.wrong:G.fg }}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
          <button onClick={()=>{ clearInterval(timerRef.current); nav("course-detail",{course}); }}
            style={{ fontSize:13, color:G.muted, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>
            Quit
          </button>
        </div>
        {/* Progress bar */}
        <div style={{ height:4, background:G.surface, borderRadius:2, marginBottom:20 }}>
          <div style={{ height:"100%", background:G.fg, borderRadius:2, width:`${progress}%`, transition:"width 0.3s" }} />
        </div>
      </div>

      {/* Question */}
      <div className="fade-up" key={current} style={{ flex:1, padding:"8px 20px 24px", overflowY:"auto" }}>
        <div style={{ background:G.fg, borderRadius:20, padding:"24px 20px", marginBottom:24, color:"#fff" }}>
          <p style={{ fontSize:13, fontWeight:600, opacity:0.5, marginBottom:10, letterSpacing:"0.05em" }}>QUESTION {current+1}</p>
          <p style={{ fontSize:17, lineHeight:1.6, fontWeight:500 }}>{q.question}</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {["A","B","C","D"].map(letter => (
            <button key={letter} onClick={()=>pick(letter)} style={{
              display:"flex", alignItems:"center", gap:14, padding:"16px 18px",
              border: selected===letter ? `2px solid ${G.fg}` : `1.5px solid ${G.border}`,
              borderRadius:14, background: selected===letter ? G.fg : G.bg,
              color: selected===letter ? "#fff" : G.fg, cursor:"pointer",
              transition:"all 0.15s", textAlign:"left"
            }}>
              <span style={{
                width:30, height:30, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                background: selected===letter ? "rgba(255,255,255,0.2)" : G.surface,
                fontSize:13, fontWeight:700
              }}>{letter}</span>
              <span style={{ fontSize:15, lineHeight:1.4 }}>{q[letter]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:"16px 20px 32px", borderTop:`1px solid ${G.border}` }}>
        <Btn onClick={next} disabled={!selected} style={{ width:"100%" }}>
          {current+1===questions.length ? "Finish Test" : "Next Question →"}
        </Btn>
      </div>
    </div>
  );
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────
function ResultsScreen({ user, token, nav, showToast, ctx }) {
  const { course, questions, answers, score, total, timeLeft, timed, minutes } = ctx;
  const pct = Math.round((score/total)*100);
  const { grade, color } = getGrade(pct);
  const [saved, setSaved] = useState(false);

  useEffect(() => { saveSession(); }, []);

  const saveSession = async () => {
    if (saved) return;
    try {
      const timeTaken = timed ? (minutes*60 - (timeLeft||0)) : null;
      await sb("sessions", {
        method:"POST",
        body: JSON.stringify({
          user_id: user.id, course_id: course.id, course_code: course.code,
          score, total, percentage: pct, grade: grade,
          time_taken: timeTaken,
          answers: JSON.stringify(answers),
          question_ids: questions.map(q=>q.id),
        }),
        headers: { Authorization:`Bearer ${token}` }
      });
      setSaved(true);
    } catch(e) {}
  };

  const timeTaken = timed ? (minutes*60 - (timeLeft||0)) : null;
  const formatTime = (s) => s ? `${Math.floor(s/60)}m ${s%60}s` : "—";

  const wrongCount = questions.filter((q,i)=>answers[i]!==q.answer).length;

  return (
    <Screen>
      <div style={{ textAlign:"center", paddingTop:20, marginBottom:32 }}>
        <div style={{ fontSize:72, marginBottom:8 }}>
          {pct >= 70 ? "🎉" : pct >= 50 ? "💪" : "📚"}
        </div>
        <div style={{ fontSize:80, fontWeight:700, letterSpacing:"-0.05em", color }}>
          {pct}%
        </div>
        <div style={{ fontSize:40, fontWeight:700, color, marginBottom:8 }}>{grade}</div>
        <p style={{ color:G.muted, fontSize:16 }}>{score} correct out of {total}</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:32 }}>
        {[
          { label:"Correct", value:score, color:G.correct },
          { label:"Wrong", value:wrongCount, color:G.wrong },
          { label:"Time", value:formatTime(timeTaken), color:G.fg },
        ].map(s => (
          <div key={s.label} style={{ background:G.surface, borderRadius:14, padding:"16px 12px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:G.muted, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <Btn onClick={()=>nav("review", ctx)} style={{ width:"100%" }}>📋 Review Answers</Btn>
        <Btn variant="outline" onClick={()=>nav("test-setup", { course })} style={{ width:"100%" }}>🔄 Try Again</Btn>
        <Btn variant="ghost" onClick={()=>nav("home")} style={{ width:"100%" }}>🏠 Home</Btn>
      </div>
    </Screen>
  );
}

// ─── REVIEW ───────────────────────────────────────────────────────────────────
function ReviewScreen({ user, token, nav, showToast, ctx }) {
  const { course, questions, answers, score, total } = ctx;
  const [explanations, setExplanations] = useState({});
  const [loadingExplanation, setLoadingExplanation] = useState({});
  const [filter, setFilter] = useState("all");

  const explain = async (idx) => {
    if (explanations[idx]) return;
    setLoadingExplanation(prev=>({...prev,[idx]:true}));
    const q = questions[idx];
    const prompt = `A student answered a multiple choice question incorrectly. Explain the correct answer clearly and concisely.

Question: ${q.question}
A. ${q.A}
B. ${q.B}
C. ${q.C}
D. ${q.D}
Correct Answer: ${q.answer}. ${q[q.answer]}
Student's Answer: ${answers[idx]}. ${q[answers[idx]]}

Give a clear, educational explanation in 3-5 sentences. Be direct and helpful.`;
    try {
      const exp = await askGemini(prompt);
      setExplanations(prev=>({...prev,[idx]:exp}));
    } catch(e) {
      setExplanations(prev=>({...prev,[idx]:"Could not load explanation. Check your connection."}));
    }
    setLoadingExplanation(prev=>({...prev,[idx]:false}));
  };

  const filtered = questions.map((q,i)=>({q,i})).filter(({q,i}) => {
    if (filter==="wrong") return answers[i]!==q.answer;
    if (filter==="correct") return answers[i]===q.answer;
    return true;
  });

  return (
    <Screen>
      <Back onClick={()=>nav("results", ctx)} />
      <SectionTitle>Review</SectionTitle>
      <p style={{ color:G.muted, fontSize:14, marginBottom:20 }}>{score}/{total} correct</p>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {[["all","All"],["wrong","Wrong"],["correct","Correct"]].map(([val,label])=>(
          <button key={val} onClick={()=>setFilter(val)} style={{
            padding:"8px 16px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", cursor:"pointer",
            background: filter===val?G.fg:G.surface, color: filter===val?"#fff":G.fg
          }}>{label}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {filtered.map(({q,i}) => {
          const correct = answers[i]===q.answer;
          return (
            <div key={i} style={{ border:`1.5px solid ${correct?G.correct:G.wrong}22`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ padding:"16px 16px 12px", background: correct?"#f0fdf4":"#fff5f5" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:16 }}>{correct?"✅":"❌"}</span>
                  <p style={{ fontSize:14, fontWeight:600, lineHeight:1.5, flex:1 }}>Q{i+1}. {q.question}</p>
                </div>
                {["A","B","C","D"].map(l => (
                  <div key={l} style={{
                    fontSize:13, padding:"6px 10px", borderRadius:8, marginBottom:4,
                    background: l===q.answer ? `${G.correct}22` : l===answers[i] && !correct ? `${G.wrong}22` : "transparent",
                    color: l===q.answer ? G.correct : l===answers[i] && !correct ? G.wrong : G.muted,
                    fontWeight: l===q.answer||l===answers[i] ? 600 : 400
                  }}>
                    {l===q.answer?"✓ ":l===answers[i]&&!correct?"✗ ":"  "}{l}. {q[l]}
                  </div>
                ))}
              </div>
              {!correct && (
                <div style={{ padding:"12px 16px", borderTop:`1px solid ${G.border}` }}>
                  {!explanations[i] ? (
                    <button onClick={()=>explain(i)} style={{ display:"flex", alignItems:"center", gap:6, color:G.fg, fontSize:13, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>
                      {loadingExplanation[i] ? <><Spinner /><span>Loading...</span></> : "🤖 AI Explanation"}
                    </button>
                  ) : (
                    <p style={{ fontSize:13, color:G.fg, lineHeight:1.7 }}>🤖 {explanations[i]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────
function PerformanceScreen({ user, token, nav, showToast }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const s = await sb(`sessions?user_id=eq.${user.id}&order=created_at.desc`, { headers:{ Authorization:`Bearer ${token}` } });
      setSessions(s||[]);
    } catch(e) {}
    setLoading(false);
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear all session history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await sb(`sessions?user_id=eq.${user.id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } });
      setSessions([]);
      showToast("History cleared", "success");
    } catch(e) { showToast("Failed to clear history", "error"); }
    setClearing(false);
  };

  const avg = sessions.length ? Math.round(sessions.reduce((a,s)=>a+(s.percentage||0),0)/sessions.length) : 0;
  const best = sessions.length ? Math.max(...sessions.map(s=>s.percentage||0)) : 0;

  // Group by course
  const byCourse = {};
  sessions.forEach(s => {
    if (!byCourse[s.course_code]) byCourse[s.course_code] = [];
    byCourse[s.course_code].push(s);
  });

  return (
    <Screen>
      <Back onClick={()=>nav("home")} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <SectionTitle>Performance</SectionTitle>
        {sessions.length > 0 && (
          <button onClick={clearHistory} disabled={clearing} style={{ fontSize:13, color:G.wrong, fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>
            {clearing ? "Clearing..." : "Clear"}
          </button>
        )}
      </div>
      <p style={{ color:G.muted, fontSize:14, marginBottom:24 }}>{sessions.length} sessions total</p>

      {loading ? <Spinner /> : sessions.length === 0 ? (
        <div style={{ textAlign:"center", paddingTop:60 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
          <p style={{ color:G.muted }}>No sessions yet. Take a test to see your performance.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:28 }}>
            {[
              { label:"Sessions", value:sessions.length },
              { label:"Average", value:`${avg}%` },
              { label:"Best", value:`${best}%` },
            ].map(s=>(
              <div key={s.label} style={{ background:G.fg, borderRadius:14, padding:"16px 12px", textAlign:"center", color:"#fff" }}>
                <div style={{ fontSize:22, fontWeight:700 }}>{s.value}</div>
                <div style={{ fontSize:12, opacity:0.6, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* By course */}
          {Object.entries(byCourse).map(([code, css]) => {
            const courseAvg = Math.round(css.reduce((a,s)=>a+(s.percentage||0),0)/css.length);
            const { grade, color } = getGrade(courseAvg);
            return (
              <div key={code} style={{ marginBottom:24 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <h3 style={{ fontSize:16, fontWeight:700 }}>{code}</h3>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:14, fontWeight:600 }}>{courseAvg}%</span>
                    <Badge color={color}>{grade}</Badge>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {css.slice(0,5).map(s => {
                    const { grade:g, color:c } = getGrade(s.percentage||0);
                    return (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:G.surface, borderRadius:10 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{s.score}/{s.total} questions</div>
                          <div style={{ fontSize:12, color:G.muted }}>{new Date(s.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:c }}>{s.percentage}%</span>
                          <Badge color={c}>{g}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </Screen>
  );
}
