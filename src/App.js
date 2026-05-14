import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SB  = "https://lezdidskdvykmumajedj.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlemRpZHNrZHZ5a211bWFqZWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTI0MDMsImV4cCI6MjA5NDA2ODQwM30.R-dzOu1WmfV7mqBg35bd1m4NgMUVxEoNQtwuNFkSnVE";

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

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const db = async (path, opts = {}, tok = null) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tok || KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || e.hint || r.statusText); }
  const t = await r.text(); return t ? JSON.parse(t) : null;
};

const authCall = async (path, body) => {
  const r = await fetch(`${SB}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error_description || d.msg || d.error || "Auth error");
  return d;
};

const ai = async (prompt) => {
  try {
    const r = await fetch("/api/gemini", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt }) });
    const d = await r.json(); return d.text || "";
  } catch { return ""; }
};

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION PARSER
// ─────────────────────────────────────────────────────────────────────────────
const fix = (s="") => s
  .replace(/\^2/g,"²").replace(/\^3/g,"³").replace(/sqrt\(/g,"√(")
  .replace(/\bpi\b/gi,"π").replace(/\btheta\b/gi,"θ").replace(/\bdelta\b/gi,"Δ")
  .replace(/\balpha\b/gi,"α").replace(/\bbeta\b/gi,"β").replace(/\bomega\b/gi,"ω")
  .replace(/\binfinity\b/gi,"∞").replace(/>=/g,"≥").replace(/<=/g,"≤").replace(/!=/g,"≠");

const parseQs = (raw) => {
  const out = [];
  const blocks = raw.trim().split(/\n(?=\s*\d+[\.\)]\s)/);
  for (const blk of blocks) {
    const lines = blk.split("\n").map(l=>l.trim()).filter(Boolean);
    if (lines.length < 6) continue;
    const q = lines[0].replace(/^\d+[\.\)]\s*/,"").trim();
    const opts = {}; let ans = "";
    for (const l of lines) {
      const om = l.match(/^([A-Da-d])[\.\)]\s*(.+)/);
      if (om) opts[om[1].toUpperCase()] = om[2].trim();
      const am = l.match(/^[Aa]nswer\s*[:\-]\s*([A-Da-d])/);
      if (am) ans = am[1].toUpperCase();
    }
    if (!q || Object.keys(opts).length < 4 || !ans) continue;
    out.push({ question:fix(q), A:fix(opts.A||""), B:fix(opts.B||""), C:fix(opts.C||""), D:fix(opts.D||""), answer:ans });
  }
  return out;
};

const gradeOf = (p) => {
  if (p>=90) return {g:"A+",c:"#15803d"};
  if (p>=80) return {g:"A", c:"#16a34a"};
  if (p>=70) return {g:"B", c:"#65a30d"};
  if (p>=60) return {g:"C", c:"#ca8a04"};
  if (p>=50) return {g:"D", c:"#ea580c"};
  return {g:"F",c:"#dc2626"};
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────
const LT = { bg:"#fff",s2:"#f7f7f7",fg:"#0a0a0a",mu:"#6b6b6b",br:"#e8e8e8",sf:"#f2f2f2",cd:"#fff" };
const DK = { bg:"#0d0d0d",s2:"#141414",fg:"#f0f0f0",mu:"#888",br:"#222",sf:"#181818",cd:"#141414" };

const GLOBAL = (T) => `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{background:${T.bg};color:${T.fg};font-family:'Inter',sans-serif;min-height:100vh;overflow-x:hidden;transition:background .25s,color .25s}
input,textarea,select,button{font-family:inherit}
button{cursor:pointer;border:none;background:none}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${T.br};border-radius:2px}
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes slide{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
@keyframes pop{0%{transform:scale(.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fall{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(255,255,255,.08)}50%{box-shadow:0 0 40px rgba(255,255,255,.18)}}
.au{animation:up .3s ease both}
.as{animation:slide .22s ease both}
.ap{animation:pop .38s cubic-bezier(.34,1.56,.64,1) both}
input:focus,textarea:focus{outline:2px solid ${T.fg};outline-offset:0}
`;

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const Spin = ({sz=22,c="#111"}) => (
  <div style={{width:sz,height:sz,border:"2.5px solid #ddd",borderTopColor:c,borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>
);

const Pg = ({children,style={}}) => (
  <div className="au" style={{minHeight:"100vh",padding:"28px 20px 100px",maxWidth:520,margin:"0 auto",...style}}>
    {children}
  </div>
);

const Back = ({onClick,T}) => (
  <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:6,color:T.mu,fontSize:14,fontWeight:700,marginBottom:22}}>
    ← Back
  </button>
);

const H1 = ({children,T,mb=4}) => (
  <h1 style={{fontSize:30,fontWeight:900,letterSpacing:"-.04em",color:T.fg,marginBottom:mb}}>{children}</h1>
);

const Label = ({children}) => (
  <label style={{fontSize:11,fontWeight:800,color:"#777",letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:8}}>
    {children}
  </label>
);

const Field = ({label,value,onChange,type="text",placeholder="",style={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:0}}>
    {label && <Label>{label}</Label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{border:"1.5px solid #e8e8e8",borderRadius:12,padding:"14px 16px",fontSize:15,background:"#fff",color:"#111",width:"100%",...style}}/>
  </div>
);

const Tog = ({on,set,T}) => (
  <button onClick={()=>set(!on)} style={{width:52,height:28,borderRadius:14,background:on?T.fg:T.br,border:"none",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
    <div style={{width:22,height:22,background:"#fff",borderRadius:"50%",position:"absolute",top:3,left:on?27:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
  </button>
);

const Badge = ({children,c="#111"}) => (
  <span style={{background:c,color:"#fff",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:800}}>{children}</span>
);

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [user,   setUser]   = useState(null);
  const [tok,    setTok]    = useState(null);
  const [dark,   setDark]   = useState(() => localStorage.getItem("md_dk")==="1");
  const [toast,  setToast]  = useState(null);
  const [ctx,    setCtx]    = useState({});
  const T = dark ? DK : LT;

  const msg = useCallback((m,type="info") => { setToast({m,type}); setTimeout(()=>setToast(null),3500); },[]);
  const go  = useCallback((s,d={}) => { setCtx(d); setScreen(s); window.scrollTo(0,0); },[]);
  const dk  = () => setDark(v => { localStorage.setItem("md_dk",!v?"1":"0"); return !v; });

  useEffect(() => {
    try {
      const t = localStorage.getItem("md_t");
      const u = localStorage.getItem("md_u");
      if (t && u && t.split(".").length===3) { setTok(t); setUser(JSON.parse(u)); setScreen("home"); }
      else { localStorage.removeItem("md_t"); localStorage.removeItem("md_u"); setTimeout(()=>setScreen("auth"),1900); }
    } catch { setTimeout(()=>setScreen("auth"),1900); }
  },[]);

  const store = (data) => {
    const t = data.access_token;
    if (!t || t.split(".").length!==3) throw new Error("Invalid session. Please try again.");
    localStorage.setItem("md_t", t);
    localStorage.setItem("md_u", JSON.stringify(data.user));
    setTok(t); setUser(data.user);
  };

  const out = () => {
    localStorage.removeItem("md_t"); localStorage.removeItem("md_u");
    setUser(null); setTok(null); setScreen("auth");
  };

  const p = {user,tok,go,msg,T,dark,dk,ctx,out,store};
  const NAV = ["home","courses","performance","profile"];

  return (
    <>
      <style>{GLOBAL(T)}</style>

      {/* Toast */}
      {toast && (
        <div className="ap" style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",
          background:toast.type==="error"?"#dc2626":toast.type==="success"?"#16a34a":"#111",
          color:"#fff",borderRadius:16,padding:"13px 24px",fontSize:14,fontWeight:700,
          zIndex:9999,maxWidth:"88vw",textAlign:"center",boxShadow:"0 8px 40px rgba(0,0,0,.25)",lineHeight:1.5}}>
          {toast.m}
        </div>
      )}

      {screen==="splash"        && <Splash/>}
      {screen==="auth"          && <Auth {...p}/>}
      {screen==="home"          && <Home {...p}/>}
      {screen==="courses"       && <Courses {...p}/>}
      {screen==="course-detail" && <CourseDetail {...p}/>}
      {screen==="upload"        && <Upload {...p}/>}
      {screen==="mode-select"   && <ModeSelect {...p}/>}
      {screen==="test-setup"    && <TestSetup {...p}/>}
      {screen==="session"       && <Session {...p}/>}
      {screen==="results"       && <Results {...p}/>}
      {screen==="review"        && <Review {...p}/>}
      {screen==="performance"   && <Perf {...p}/>}
      {screen==="profile"       && <Profile {...p}/>}

      {NAV.includes(screen) && <Nav cur={screen} go={go} T={T}/>}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────────
function Nav({cur,go,T}) {
  const items=[{id:"home",ic:"⚡",lb:"Home"},{id:"courses",ic:"📚",lb:"Courses"},{id:"performance",ic:"📊",lb:"Stats"},{id:"profile",ic:"👤",lb:"Profile"}];
  return (
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:520,
      background:T.bg,borderTop:`1px solid ${T.br}`,display:"flex",justifyContent:"space-around",
      padding:"10px 0 22px",zIndex:200}}>
      {items.map(it=>(
        <button key={it.id} onClick={()=>go(it.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 16px",color:cur===it.id?T.fg:T.mu}}>
          <span style={{fontSize:22}}>{it.ic}</span>
          <span style={{fontSize:11,fontWeight:cur===it.id?800:500}}>{it.lb}</span>
          {cur===it.id && <div style={{width:5,height:5,borderRadius:"50%",background:T.fg,marginTop:1}}/>}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
      <div className="ap" style={{width:90,height:90,background:"#fff",borderRadius:26,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 80px rgba(255,255,255,.12)",animation:"glow 3s infinite"}}>
        <span style={{fontSize:46}}>⚡</span>
      </div>
      <h1 style={{fontSize:44,fontWeight:900,color:"#fff",letterSpacing:"-.05em"}}>MindDrill</h1>
      <p style={{color:"rgba(255,255,255,.3)",fontSize:12,letterSpacing:".2em",textTransform:"uppercase"}}>Sharpen Your Mind</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
function Auth({go,msg,T,store}) {
  const [mode,setMode] = useState("signin");
  const [email,setEmail] = useState("");
  const [pw,setPw] = useState("");
  const [name,setName] = useState("");
  const [uname,setUname] = useState("");
  const [busy,setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()||!pw) return msg("Fill in all fields","error");
    if (mode==="signup") {
      if (!name.trim()) return msg("Enter your full name","error");
      if (!uname.trim()) return msg("Choose a username","error");
      if (uname.includes(" ")) return msg("Username cannot contain spaces","error");
      if (uname.length < 3) return msg("Username must be at least 3 characters","error");
    }
    if (pw.length<6) return msg("Password needs at least 6 characters","error");
    setBusy(true);
    try {
      let data;
      if (mode==="signup") {
        data = await authCall("signup",{ email:email.trim(), password:pw, data:{ full_name:name.trim(), username:uname.trim().toLowerCase() } });
        if (!data.access_token) { msg("Account created! Check your email to confirm, then sign in.","success"); setMode("signin"); setBusy(false); return; }
      } else {
        data = await authCall("token?grant_type=password",{ email:email.trim(), password:pw });
      }
      store(data);
      msg("Welcome to MindDrill! ⚡","success");
      go("home");
    } catch(e) { msg(e.message,"error"); }
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Top hero */}
      <div style={{background:"#0a0a0a",padding:"48px 28px 52px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-60,left:-30,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{width:56,height:56,background:"#fff",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
          <span style={{fontSize:28}}>⚡</span>
        </div>
        <h1 style={{fontSize:36,fontWeight:900,color:"#fff",letterSpacing:"-.04em",marginBottom:6}}>MindDrill</h1>
        <p style={{color:"rgba(255,255,255,.45)",fontSize:14}}>
          {mode==="signin"?"Welcome back. Let's drill.":"Join thousands of students mastering their courses."}
        </p>
      </div>

      {/* Form */}
      <div className="au" style={{flex:1,padding:"32px 28px 40px",background:T.bg}}>
        {/* Tab switcher */}
        <div style={{display:"flex",background:T.sf,borderRadius:14,padding:4,marginBottom:28}}>
          {["signin","signup"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"11px",borderRadius:11,fontWeight:800,fontSize:14,background:mode===m?T.bg:"transparent",color:mode===m?T.fg:T.mu,boxShadow:mode===m?"0 2px 8px rgba(0,0,0,.08)":"none",transition:"all .2s"}}>
              {m==="signin"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:22}}>
          {mode==="signup" && <>
            <Field label="Full Name" value={name} onChange={setName} placeholder="Your full name"/>
            <div>
              <Label>Username</Label>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontWeight:700,fontSize:15}}>@</span>
                <input value={uname} onChange={e=>setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} placeholder="yourname"
                  style={{width:"100%",border:"1.5px solid #e8e8e8",borderRadius:12,padding:"14px 16px 14px 32px",fontSize:15,background:"#fff",color:"#111"}}/>
              </div>
              <p style={{fontSize:11,color:"#aaa",marginTop:5}}>Letters, numbers, underscores only</p>
            </div>
          </>}
          <Field label="Email Address" value={email} onChange={setEmail} type="email" placeholder="you@email.com"/>
          <Field label="Password" value={pw} onChange={setPw} type="password" placeholder="Min. 6 characters"/>
        </div>

        <button onClick={submit} disabled={busy} style={{width:"100%",background:"#0a0a0a",color:"#fff",borderRadius:16,padding:"18px",fontSize:17,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:18,opacity:busy?.6:1}}>
          {busy ? <Spin c="#fff"/> : mode==="signin" ? "Sign In →" : "Create Account →"}
        </button>

        {mode==="signup" && (
          <p style={{textAlign:"center",fontSize:12,color:T.mu,lineHeight:1.6}}>
            By signing up you agree to use MindDrill responsibly.
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME — premium dashboard
// ─────────────────────────────────────────────────────────────────────────────
function Home({user,tok,go,T,dark,dk}) {
  const [stats,  setStats]  = useState({sessions:0,avg:0,best:0,streak:0,correct:0,wrong:0});
  const [recent, setRecent] = useState([]);
  const [courses,setCourses]= useState([]);

  useEffect(()=>{ loadData(); },[]);

  const loadData = async () => {
    try {
      const [sess,crss] = await Promise.all([
        db(`sessions?user_id=eq.${user.id}&order=created_at.desc&limit=50`,{},tok),
        db("courses?select=*&order=title.asc",{},tok),
      ]);
      if (sess?.length) {
        const avg  = Math.round(sess.reduce((a,s)=>a+(s.percentage||0),0)/sess.length);
        const best = Math.max(...sess.map(s=>s.percentage||0));
        const correct = sess.reduce((a,s)=>a+(s.score||0),0);
        const wrong   = sess.reduce((a,s)=>a+((s.total||0)-(s.score||0)),0);
        let streak=0;
        const today=new Date();today.setHours(0,0,0,0);
        const days=new Set(sess.map(s=>new Date(s.created_at).toDateString()));
        for(let i=0;i<365;i++){const d=new Date(today);d.setDate(d.getDate()-i);if(days.has(d.toDateString()))streak++;else if(i>0)break;}
        setStats({sessions:sess.length,avg,best,streak,correct,wrong});
        setRecent(sess.slice(0,4));
      }
      if (crss) setCourses(crss.slice(0,6));
    } catch {}
  };

  const meta  = user?.user_metadata || {};
  const uname = meta.username || meta.full_name?.split(" ")[0] || "Student";
  const fname = meta.full_name?.split(" ")[0] || uname;
  const avatar= meta.avatar_url;
  const h     = new Date().getHours();
  const greet = h<12?"Good morning":h<17?"Good afternoon":"Good evening";
  const uid   = (user?.id||"").slice(0,8).toUpperCase();

  return (
    <div style={{minHeight:"100vh",background:T.bg,maxWidth:520,margin:"0 auto"}}>
      {/* ── HERO HEADER ── */}
      <div style={{background:"#0a0a0a",padding:"32px 20px 28px",position:"relative",overflow:"hidden"}}>
        {/* decorative circles */}
        <div style={{position:"absolute",top:-50,right:-50,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.04)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-80,left:-40,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,.03)",pointerEvents:"none"}}/>

        {/* top row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div onClick={()=>go("profile")} style={{width:46,height:46,borderRadius:"50%",background:"#222",border:"2px solid #333",overflow:"hidden",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {avatar
                ? <img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                : <span style={{color:"#fff",fontSize:18,fontWeight:900}}>{uname[0]?.toUpperCase()}</span>}
            </div>
            <div>
              <p style={{fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600}}>{greet}</p>
              <p style={{fontSize:16,color:"#fff",fontWeight:800}}>@{uname}</p>
            </div>
          </div>
          <button onClick={dk} style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"none",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {dark?"☀️":"🌙"}
          </button>
        </div>

        {/* big welcome */}
        <div style={{position:"relative"}}>
          <p style={{fontSize:13,color:"rgba(255,255,255,.45)",marginBottom:4,fontWeight:600}}>Welcome back,</p>
          <h2 style={{fontSize:34,fontWeight:900,color:"#fff",letterSpacing:"-.04em",lineHeight:1.1,marginBottom:16}}>
            {fname}
          </h2>

          {/* streak pill */}
          {stats.streak>0 && (
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.12)",borderRadius:22,padding:"8px 16px"}}>
              <span style={{fontSize:18}}>🔥</span>
              <span style={{color:"#fff",fontWeight:800,fontSize:14}}>{stats.streak} Day Streak</span>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,marginTop:24,background:"rgba(255,255,255,.08)",borderRadius:16,overflow:"hidden"}}>
          {[{l:"Sessions",v:stats.sessions},{l:"Avg Score",v:`${stats.avg}%`},{l:"Best",v:`${stats.best}%`}].map((s,i)=>(
            <div key={s.l} style={{padding:"14px 12px",textAlign:"center",background:i===1?"rgba(255,255,255,.06)":"transparent"}}>
              <div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:"-.02em"}}>{s.v}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:3,fontWeight:700}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{padding:"24px 20px 100px"}}>

        {/* start drilling CTA */}
        <button onClick={()=>go("courses")} style={{width:"100%",background:"#0a0a0a",color:"#fff",borderRadius:18,padding:"20px",fontSize:18,fontWeight:900,letterSpacing:"-.02em",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:24,boxShadow:"0 4px 20px rgba(0,0,0,.15)"}}>
          ⚡ Start Drilling
        </button>

        {/* quick stats cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
          <div style={{background:"#dcfce7",borderRadius:18,padding:"18px 16px"}}>
            <div style={{fontSize:28,marginBottom:4}}>✅</div>
            <div style={{fontSize:26,fontWeight:900,color:"#15803d"}}>{stats.correct}</div>
            <div style={{fontSize:12,color:"#166534",fontWeight:700,marginTop:2}}>Total Correct</div>
          </div>
          <div style={{background:"#fee2e2",borderRadius:18,padding:"18px 16px"}}>
            <div style={{fontSize:28,marginBottom:4}}>❌</div>
            <div style={{fontSize:26,fontWeight:900,color:"#dc2626"}}>{stats.wrong}</div>
            <div style={{fontSize:12,color:"#991b1b",fontWeight:700,marginTop:2}}>Total Wrong</div>
          </div>
        </div>

        {/* quick actions */}
        <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".08em",textTransform:"uppercase",marginBottom:14}}>Quick Actions</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
          {[
            {ic:"📤",lb:"Upload Questions",sub:"Add to any course question bank",action:()=>go("courses")},
            {ic:"📊",lb:"My Performance",sub:"See your stats and trends",action:()=>go("performance")},
            {ic:"👤",lb:"My Profile",sub:`@${uname} · ID #${uid}`,action:()=>go("profile")},
          ].map(a=>(
            <button key={a.lb} onClick={a.action} style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px",border:`1.5px solid ${T.br}`,borderRadius:16,background:T.cd,cursor:"pointer",textAlign:"left",width:"100%"}}>
              <div style={{width:46,height:46,background:T.sf,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{a.ic}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,color:T.fg}}>{a.lb}</div>
                <div style={{fontSize:12,color:T.mu,marginTop:2}}>{a.sub}</div>
              </div>
              <span style={{color:T.mu,fontSize:22}}>›</span>
            </button>
          ))}
        </div>

        {/* recent sessions */}
        {recent.length>0 && (
          <>
            <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".08em",textTransform:"uppercase",marginBottom:14}}>Recent Sessions</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {recent.map(s=>{
                const {g,c}=gradeOf(s.percentage||0);
                const me=s.mode==="study"?"📖":s.mode==="practice"?"🏋️":"🧪";
                return(
                  <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 18px",background:T.sf,borderRadius:16,border:`1.5px solid ${T.br}`}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:15,color:T.fg}}>{me} {s.course_code||"Mixed"}</div>
                      <div style={{fontSize:12,color:T.mu,marginTop:2}}>{new Date(s.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:15,fontWeight:800,color:T.fg}}>{s.score}/{s.total}</span>
                      <Badge c={c}>{g}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────────────────────────────
function Courses({user,tok,go,msg,T}) {
  const [courses,setCourses] = useState([]);
  const [loading,setLoading] = useState(true);
  const [showAdd,setShowAdd] = useState(false);
  const [nc,setNc] = useState(""); const [nt,setNt] = useState("");
  const [adding,setAdding] = useState(false);
  const [search,setSearch]  = useState("");

  useEffect(()=>{ load(); },[]);

  const load = async () => {
    setLoading(true);
    try {
      const ex = await db("courses?select=code",{},tok)||[];
      const exSet = new Set(ex.map(c=>c.code));
      for (const c of SEEDS) {
        if (!exSet.has(c.code)) await db("courses",{method:"POST",body:JSON.stringify({code:c.code,title:c.title,created_by:user.id})},tok).catch(()=>{});
      }
      const all = await db("courses?select=*&order=title.asc",{},tok)||[];
      const qs  = await db("questions?select=course_id",{},tok)||[];
      const cm  = {}; qs.forEach(q=>{ cm[q.course_id]=(cm[q.course_id]||0)+1; });
      setCourses(all.map(c=>({...c,qc:cm[c.id]||0})));
    } catch(e) { msg("Failed to load: "+e.message,"error"); }
    setLoading(false);
  };

  const add = async () => {
    if (!nc.trim()||!nt.trim()) return msg("Fill in both fields","error");
    const cd=nc.trim().toUpperCase();
    if (courses.find(c=>c.code===cd)) return msg("Course code already exists","error");
    setAdding(true);
    try {
      await db("courses",{method:"POST",body:JSON.stringify({code:cd,title:nt.trim(),created_by:user.id})},tok);
      msg("Course created!","success"); setNc(""); setNt(""); setShowAdd(false); load();
    } catch(e) { msg(e.message,"error"); }
    setAdding(false);
  };

  const filt = courses.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())||c.code.toLowerCase().includes(search.toLowerCase()));
  const mine  = filt.filter(c=>SEEDS.some(s=>s.code===c.code));
  const other = filt.filter(c=>!SEEDS.some(s=>s.code===c.code));

  const Card = ({c}) => (
    <div onClick={()=>go("course-detail",{course:c})} style={{display:"flex",alignItems:"center",gap:14,padding:"17px 18px",border:`1.5px solid ${T.br}`,borderRadius:18,cursor:"pointer",background:T.cd}}>
      <div style={{width:50,height:50,background:T.fg,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{color:T.bg,fontSize:9,fontWeight:900,textAlign:"center",lineHeight:1.3,padding:"0 4px"}}>{c.code.slice(0,9)}</span>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:800,fontSize:14,color:T.fg,lineHeight:1.4}}>{c.title}</div>
        <div style={{fontSize:12,color:T.mu,marginTop:3}}>{c.code} · {c.qc} questions</div>
      </div>
      <span style={{color:T.mu,fontSize:22}}>›</span>
    </div>
  );

  return (
    <Pg>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <H1 T={T}>Courses</H1>
        <button onClick={()=>setShowAdd(!showAdd)} style={{background:showAdd?T.sf:T.fg,color:showAdd?T.fg:T.bg,borderRadius:12,padding:"9px 18px",fontSize:13,fontWeight:800,border:`1.5px solid ${T.br}`}}>
          {showAdd?"Cancel":"+ New"}
        </button>
      </div>
      <p style={{color:T.mu,fontSize:13,marginBottom:22}}>{courses.length} courses · {courses.reduce((a,c)=>a+c.qc,0)} questions total</p>

      {showAdd && (
        <div style={{background:T.sf,borderRadius:18,padding:20,marginBottom:22,display:"flex",flexDirection:"column",gap:14,border:`1.5px solid ${T.br}`}}>
          <Field label="Course Code" value={nc} onChange={setNc} placeholder="e.g. BIO201"/>
          <Field label="Course Title" value={nt} onChange={setNt} placeholder="e.g. Cell Biology"/>
          <button onClick={add} disabled={adding} style={{background:T.fg,color:T.bg,borderRadius:14,padding:"15px",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:adding?.6:1}}>
            {adding?<><Spin c={T.bg}/>Creating...</>:"Create Course"}
          </button>
        </div>
      )}

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search courses..."
        style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:14,padding:"14px 18px",fontSize:14,background:T.bg,color:T.fg,marginBottom:26}}/>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",paddingTop:48}}><Spin sz={40}/></div>
        : <>
            {mine.length>0 && <>
              <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>My Courses — AFIT 2nd Semester 2025/2026</p>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:26}}>{mine.map(c=><Card key={c.id} c={c}/>)}</div>
            </>}
            {other.length>0 && <>
              <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>Other Courses</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>{other.map(c=><Card key={c.id} c={c}/>)}</div>
            </>}
            {!filt.length && <p style={{textAlign:"center",color:T.mu,padding:"48px 0",fontSize:15}}>No courses found.</p>}
          </>
      }
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function CourseDetail({user,tok,go,T,ctx}) {
  const {course}=ctx;
  const [topics,setTopics]=useState([]);
  const [qc,setQc]=useState(0);

  useEffect(()=>{
    db(`questions?course_id=eq.${course.id}&select=topic`,{},tok).then(qs=>{
      if (!qs) return; setQc(qs.length);
      const m={}; qs.forEach(q=>{const t=q.topic||"General";m[t]=(m[t]||0)+1;});
      setTopics(Object.entries(m).map(([n,c])=>({n,c})).sort((a,b)=>b.c-a.c));
    }).catch(()=>{});
  },[]);

  return (
    <Pg>
      <Back onClick={()=>go("courses")} T={T}/>
      <div style={{background:T.fg,borderRadius:22,padding:"26px 22px",marginBottom:24,color:T.bg}}>
        <div style={{fontSize:11,fontWeight:800,opacity:.4,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>{course.code}</div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:"-.03em",lineHeight:1.35,marginBottom:12}}>{course.title}</h2>
        <div style={{fontSize:13,opacity:.5,fontWeight:700}}>{qc} questions in the bank</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
        <button onClick={()=>go("mode-select",{course})} style={{background:T.fg,color:T.bg,borderRadius:16,padding:"18px",fontSize:17,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
          ⚡ Start Session
        </button>
        <button onClick={()=>go("upload",{course})} style={{background:T.sf,color:T.fg,borderRadius:16,padding:"16px",fontSize:15,fontWeight:700,border:`1.5px solid ${T.br}`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          📤 Upload Questions
        </button>
      </div>
      {topics.length>0 && <>
        <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".08em",textTransform:"uppercase",marginBottom:12}}>Topics</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {topics.map(t=>(
            <div key={t.n} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:T.sf,borderRadius:14,border:`1.5px solid ${T.br}`}}>
              <span style={{fontSize:14,fontWeight:700,color:T.fg}}>{t.n}</span>
              <Badge>{t.c}</Badge>
            </div>
          ))}
        </div>
      </>}
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function Upload({user,tok,go,msg,T,ctx}) {
  const {course}=ctx;
  const [raw,setRaw]=useState(""); const [topic,setTopic]=useState("");
  const [parsed,setParsed]=useState([]); const [prev,setPrev]=useState(false);
  const [busy,setBusy]=useState(false); const [done,setDone]=useState(null);

  const preview=()=>{
    if (!raw.trim()) return msg("Paste questions first","error");
    const qs=parseQs(raw);
    if (!qs.length) return msg("No valid questions found — check the format","error");
    setParsed(qs); setPrev(true);
  };

  const upload=async()=>{
    setBusy(true);
    try {
      const ex=await db(`questions?course_id=eq.${course.id}&select=question`,{},tok)||[];
      const exSet=new Set(ex.map(q=>q.question.toLowerCase().trim()));
      const ins=parsed.filter(q=>!exSet.has(q.question.toLowerCase().trim())).map(q=>({...q,course_id:course.id,topic:topic.trim()||"General",uploaded_by:user.id}));
      const dupes=parsed.length-ins.length;
      if (!ins.length) { msg(`All ${dupes} questions already exist`,"error"); setBusy(false); return; }
      for (let i=0;i<ins.length;i+=50) await db("questions",{method:"POST",body:JSON.stringify(ins.slice(i,i+50))},tok);
      setDone({inserted:ins.length,dupes,total:parsed.length});
      setPrev(false); setRaw(""); setParsed([]);
    } catch(e) { msg(e.message,"error"); }
    setBusy(false);
  };

  if (done) return (
    <Pg style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <div className="ap" style={{textAlign:"center"}}>
        <div style={{fontSize:80,marginBottom:16}}>✅</div>
        <h2 style={{fontSize:30,fontWeight:900,color:T.fg,marginBottom:10}}>Upload Complete!</h2>
        <p style={{color:T.mu,fontSize:16,marginBottom:8}}>{done.inserted} questions added to {course.code}</p>
        {done.dupes>0&&<p style={{color:"#d97706",fontSize:14}}>{done.dupes} duplicates skipped</p>}
        <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:28}}>
          <button onClick={()=>setDone(null)} style={{background:T.fg,color:T.bg,borderRadius:16,padding:"16px",fontWeight:800,fontSize:16}}>Upload More</button>
          <button onClick={()=>go("course-detail",{course})} style={{background:T.sf,color:T.fg,borderRadius:16,padding:"14px",fontWeight:700,fontSize:15,border:`1.5px solid ${T.br}`}}>Back to Course</button>
        </div>
      </div>
    </Pg>
  );

  return (
    <Pg>
      <Back onClick={()=>go("course-detail",{course})} T={T}/>
      <H1 T={T}>Upload Questions</H1>
      <p style={{color:T.mu,fontSize:13,marginBottom:24}}>{course.code} — {course.title}</p>

      <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:16,padding:18,marginBottom:24}}>
        <p style={{fontSize:13,fontWeight:800,color:"#92400e",marginBottom:10}}>📋 Required Format</p>
        <pre style={{fontSize:12,color:"#78350f",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"JetBrains Mono,monospace"}}>
{`1. Question text here?
A. First option
B. Second option
C. Third option
D. Fourth option
Answer: B

2. Next question...`}
        </pre>
      </div>

      {!prev ? (
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <Field label="Topic / Chapter (optional)" value={topic} onChange={setTopic} placeholder="e.g. Wave Motion, Chapter 3"/>
          <div>
            <Label>Paste Questions Here</Label>
            <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste your AI-generated questions here..."
              style={{width:"100%",minHeight:240,border:`1.5px solid ${T.br}`,borderRadius:14,padding:"16px",fontSize:13,resize:"vertical",background:T.bg,color:T.fg,fontFamily:"JetBrains Mono,monospace",lineHeight:1.8}}/>
          </div>
          <button onClick={preview} style={{background:T.fg,color:T.bg,borderRadius:16,padding:"17px",fontWeight:900,fontSize:16}}>Preview Questions</button>
        </div>
      ) : (
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
            <h3 style={{fontSize:22,fontWeight:900,color:T.fg}}>{parsed.length} questions ready</h3>
            <button onClick={()=>setPrev(false)} style={{color:T.mu,fontSize:13,fontWeight:700}}>Edit</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:380,overflowY:"auto",marginBottom:20}}>
            {parsed.slice(0,6).map((q,i)=>(
              <div key={i} style={{background:T.sf,borderRadius:14,padding:16,border:`1.5px solid ${T.br}`}}>
                <p style={{fontSize:13,fontWeight:700,color:T.fg,marginBottom:10}}>Q{i+1}. {q.question}</p>
                {["A","B","C","D"].map(l=>(
                  <div key={l} style={{fontSize:12,color:l===q.answer?"#16a34a":T.mu,marginBottom:3,fontWeight:l===q.answer?800:400}}>
                    {l===q.answer?"✓ ":"  "}{l}. {q[l]}
                  </div>
                ))}
              </div>
            ))}
            {parsed.length>6&&<p style={{textAlign:"center",color:T.mu,fontSize:13,padding:"10px 0"}}>+ {parsed.length-6} more</p>}
          </div>
          <button onClick={upload} disabled={busy} style={{background:T.fg,color:T.bg,borderRadius:16,padding:"17px",fontWeight:900,fontSize:16,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:busy?.6:1}}>
            {busy?<><Spin c={T.bg}/>Uploading...</>:`Upload All ${parsed.length} Questions`}
          </button>
        </div>
      )}
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE SELECT
// ─────────────────────────────────────────────────────────────────────────────
function ModeSelect({go,T,ctx}) {
  const {course}=ctx;
  const modes=[
    {id:"test",  e:"🧪",title:"Test Mode",   desc:"Answer all questions without feedback. Full grade and review at the end.", bg:"#dbeafe"},
    {id:"study", e:"📖",title:"Study Mode",  desc:"See correct answer immediately. AI explains every wrong answer instantly.", bg:"#dcfce7"},
    {id:"practice",e:"🏋️",title:"Practice Mode",desc:"Wrong answers repeat until you get them right. Build true mastery.", bg:"#f3e8ff"},
  ];
  return (
    <Pg>
      <Back onClick={()=>go("course-detail",{course})} T={T}/>
      <H1 T={T}>Choose Mode</H1>
      <p style={{color:T.mu,fontSize:13,marginBottom:28}}>{course.code} — {course.title}</p>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {modes.map(m=>(
          <button key={m.id} onClick={()=>go("test-setup",{course,mode:m.id})} style={{background:T.cd,border:`1.5px solid ${T.br}`,borderRadius:22,padding:"22px 20px",textAlign:"left",cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
              <div style={{width:52,height:52,background:m.bg,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{m.e}</div>
              <div style={{fontSize:20,fontWeight:900,color:T.fg}}>{m.title}</div>
            </div>
            <p style={{fontSize:14,color:T.mu,lineHeight:1.65}}>{m.desc}</p>
          </button>
        ))}
      </div>
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────
function TestSetup({user,tok,go,msg,T,ctx}) {
  const {course,mode}=ctx;
  const [topics,setTopics]=useState([]); const [selT,setSelT]=useState([]);
  const [numQ,setNumQ]=useState("20"); const [timed,setTimed]=useState(false);
  const [mins,setMins]=useState("30"); const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    db(`questions?course_id=eq.${course.id}&select=topic`,{},tok).then(qs=>{
      if (!qs?.length) { msg("No questions uploaded for this course yet","error"); go("course-detail",{course}); return; }
      setTotal(qs.length);
      const m={}; qs.forEach(q=>{const t=q.topic||"General";m[t]=(m[t]||0)+1;});
      const t=Object.entries(m).map(([n,c])=>({n,c}));
      setTopics(t); setSelT(t.map(x=>x.n));
    }).catch(e=>msg(e.message,"error")).finally(()=>setLoading(false));
  },[]);

  const start=()=>{
    if (!selT.length) return msg("Select at least one topic","error");
    const n=parseInt(numQ);
    if (!n||n<1) return msg("Enter a valid number","error");
    if (n>total) return msg(`Only ${total} questions available`,"error");
    go("session",{course,mode,selT,numQ:n,timed,mins:parseInt(mins)||30});
  };

  const ml=mode==="test"?"🧪 Test":mode==="study"?"📖 Study":"🏋️ Practice";

  return (
    <Pg>
      <Back onClick={()=>go("mode-select",{course})} T={T}/>
      <H1 T={T}>{ml} Setup</H1>
      <p style={{color:T.mu,fontSize:13,marginBottom:28}}>{course.code} · {total} questions available</p>

      {loading
        ? <div style={{display:"flex",justifyContent:"center",paddingTop:48}}><Spin sz={40}/></div>
        : <div style={{display:"flex",flexDirection:"column",gap:26}}>
            <div>
              <Label>Select Topics</Label>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                <button onClick={()=>setSelT(topics.map(t=>t.n))} style={{padding:"9px 18px",borderRadius:22,fontSize:13,fontWeight:800,border:`1.5px solid ${T.br}`,background:selT.length===topics.length?T.fg:T.sf,color:selT.length===topics.length?T.bg:T.fg}}>All</button>
                {topics.map(t=>(
                  <button key={t.n} onClick={()=>setSelT(p=>p.includes(t.n)?p.filter(x=>x!==t.n):[...p,t.n])} style={{padding:"9px 16px",borderRadius:22,fontSize:13,fontWeight:700,border:`1.5px solid ${T.br}`,background:selT.includes(t.n)?T.fg:T.sf,color:selT.includes(t.n)?T.bg:T.fg}}>
                    {t.n} ({t.c})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Number of Questions</Label>
              <input type="number" value={numQ} onChange={e=>setNumQ(e.target.value)} min="1" max={total}
                style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:14,padding:"16px 18px",fontSize:22,fontWeight:900,background:T.bg,color:T.fg}}/>
            </div>

            {mode==="test" && (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:T.fg}}>Enable Timer</div>
                    <div style={{fontSize:12,color:T.mu,marginTop:3}}>Countdown during your test</div>
                  </div>
                  <Tog on={timed} set={setTimed} T={T}/>
                </div>
                {timed && (
                  <div>
                    <Label>Minutes</Label>
                    <input type="number" value={mins} onChange={e=>setMins(e.target.value)}
                      style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:14,padding:"16px 18px",fontSize:22,fontWeight:900,background:T.bg,color:T.fg}}/>
                  </div>
                )}
              </div>
            )}

            <button onClick={start} style={{background:T.fg,color:T.bg,borderRadius:18,padding:"18px",fontWeight:900,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              {ml} — Start Now
            </button>
          </div>
      }
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────────────────
function Session({user,tok,go,msg,T,ctx}) {
  const {course,mode,selT,numQ,timed,mins}=ctx;
  const [questions,setQuestions]=useState([]);
  const [cur,setCur]=useState(0);
  const [answers,setAnswers]=useState({});
  const [sel,setSel]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [aiExp,setAiExp]=useState(""); const [loadExp,setLoadExp]=useState(false);
  const [flags,setFlags]=useState(new Set());
  const [timeLeft,setTimeLeft]=useState(null);
  const [loading,setLoading]=useState(true);
  const [aiNote,setAiNote]=useState("AI is selecting your questions...");
  const [pQ,setPQ]=useState([]); const [pI,setPI]=useState(0); const [mastered,setMastered]=useState(0);
  const tmr=useRef(null); const tmrOn=useRef(false);

  useEffect(()=>{ loadSess(); },[]);

  useEffect(()=>{
    if (timed&&mode==="test"&&timeLeft===null&&questions.length>0&&!tmrOn.current) {
      tmrOn.current=true; setTimeLeft(mins*60);
    }
  },[questions]);

  useEffect(()=>{
    if (timed&&mode==="test"&&timeLeft!==null) {
      if (timeLeft<=0) { finish(answers); return; }
      tmr.current=setTimeout(()=>setTimeLeft(v=>v-1),1000);
      return ()=>clearTimeout(tmr.current);
    }
  },[timeLeft,timed,mode,answers]);

  const loadSess=async()=>{
    setLoading(true);
    try {
      const filter=selT.map(t=>`topic.eq.${encodeURIComponent(t)}`).join(",");
      const all=await db(`questions?course_id=eq.${course.id}&or=(${filter})&select=*`,{},tok)||[];
      if (!all.length) { msg("No questions found for selected topics","error"); go("test-setup",{course,mode}); return; }

      setAiNote("AI is picking your questions...");
      let recentIds=[];
      try {
        const rec=await db(`sessions?user_id=eq.${user.id}&course_id=eq.${course.id}&order=created_at.desc&limit=3&select=question_ids`,{},tok)||[];
        recentIds=rec.flatMap(s=>s.question_ids||[]);
      } catch {}

      let picked=[];
      try {
        const pool=all.map((q,i)=>`${i}:${q.id}`).join(",");
        const rStr=recentIds.slice(-15).join(",");
        const prompt=`You are a study assistant. Select ${Math.min(numQ,all.length)} questions from a pool of ${all.length}.\nPool (index:id): ${pool}\nRecently seen IDs (vary away from these): ${rStr}\nRespond ONLY with comma-separated indices. Example: 2,7,14\nSelect exactly ${Math.min(numQ,all.length)} unique indices.`;
        const res=await ai(prompt);
        const indices=[...new Set((res.match(/\d+/g)||[]).map(Number).filter(n=>n>=0&&n<all.length))];
        picked=indices.slice(0,numQ).map(i=>all[i]);
        if (picked.length<Math.min(numQ,all.length)) {
          const used=new Set(indices.slice(0,numQ));
          const extra=all.filter((_,i)=>!used.has(i)).sort(()=>Math.random()-.5);
          picked=[...picked,...extra.slice(0,Math.min(numQ,all.length)-picked.length)];
        }
      } catch {
        picked=all.sort(()=>Math.random()-.5).slice(0,Math.min(numQ,all.length));
      }

      setQuestions(picked);
      if (mode==="practice") setPQ([...picked]);
    } catch(e) { msg("Load error: "+e.message,"error"); }
    setLoading(false);
  };

  const curQ=mode==="practice"?pQ[pI]:questions[cur];

  const pick=async(letter)=>{
    if (revealed) return;
    setSel(letter);
    if (mode==="study"||mode==="practice") {
      setRevealed(true);
      if (letter!==curQ.answer) {
        setLoadExp(true);
        const e=await ai(`Explain in 4 clear sentences why the correct answer is ${curQ.answer}.\nQ: ${curQ.question}\nA.${curQ.A} B.${curQ.B} C.${curQ.C} D.${curQ.D}\nCorrect: ${curQ.answer}. ${curQ[curQ.answer]}`);
        setAiExp(e); setLoadExp(false);
      }
    }
  };

  const advance=()=>{
    if (mode==="practice") {
      const ok=sel===curQ.answer;
      if (ok) {
        setMastered(m=>m+1);
        const nq=[...pQ]; nq.splice(pI,1);
        if (!nq.length) { go("results",{course,mode,questions,answers:{},score:questions.length,total:questions.length,masteredAll:true}); return; }
        setPQ(nq); if (pI>=nq.length) setPI(0);
      } else {
        const nq=[...pQ]; const q=nq.splice(pI,1)[0]; nq.push(q);
        setPQ(nq); if (pI>=nq.length) setPI(0);
      }
      setSel(null); setRevealed(false); setAiExp("");
    } else if (mode==="study") {
      const na={...answers,[cur]:sel}; setAnswers(na);
      setSel(null); setRevealed(false); setAiExp("");
      if (cur+1>=questions.length) finish(na); else setCur(c=>c+1);
    }
  };

  const goQ=(i)=>{
    if (sel&&answers[cur]===undefined) setAnswers(a=>({...a,[cur]:sel}));
    setCur(i); setSel(answers[i]||null); setRevealed(false); setAiExp("");
  };

  const nextQ=()=>{
    const ans=sel||answers[cur];
    if (!ans) return msg("Select an answer to continue","error");
    const na={...answers,[cur]:ans}; setAnswers(na);
    if (cur+1>=questions.length) { finish(na); return; }
    setCur(c=>c+1); setSel(answers[cur+1]||null);
  };

  const prevQ=()=>{
    if (cur===0) return;
    const ans=sel||answers[cur];
    if (ans) setAnswers(a=>({...a,[cur]:ans}));
    setCur(c=>c-1); setSel(answers[cur-1]||null);
  };

  const finish=(fa)=>{
    clearTimeout(tmr.current);
    const score=questions.filter((q,i)=>fa[i]===q.answer).length;
    go("results",{course,mode,questions,answers:fa,score,total:questions.length,timeLeft,timed,mins,flags:[...flags]});
  };

  const fmt=(s)=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if (loading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
      <Spin sz={48}/><p style={{color:T.mu,fontSize:15,fontWeight:600}}>{aiNote}</p>
    </div>
  );
  if (!curQ) return null;

  const prog=mode==="practice"?(mastered/Math.max(questions.length,1))*100:(cur/Math.max(questions.length,1))*100;
  const qLbl=mode==="practice"?`${mastered} / ${questions.length} mastered`:`${cur+1} / ${questions.length}`;
  const mLbl=mode==="test"?"🧪 TEST":mode==="study"?"📖 STUDY":"🏋️ PRACTICE";

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",maxWidth:520,margin:"0 auto"}}>
      {/* Top */}
      <div style={{padding:"20px 20px 0",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:12,fontWeight:800,color:T.mu,letterSpacing:".06em"}}>{qLbl}</span>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            {timed&&mode==="test"&&timeLeft!==null&&(
              <span style={{fontSize:18,fontWeight:900,fontFamily:"JetBrains Mono,monospace",color:timeLeft<60?"#dc2626":T.fg,animation:timeLeft<30?"pulse 1s infinite":"none"}}>
                ⏱ {fmt(timeLeft)}
              </span>
            )}
            {mode==="test"&&(
              <button onClick={()=>setFlags(f=>{const n=new Set(f);n.has(cur)?n.delete(cur):n.add(cur);return n;})} style={{fontSize:20}}>
                {flags.has(cur)?"🚩":"⚑"}
              </button>
            )}
            <button onClick={()=>{clearTimeout(tmr.current);go("course-detail",{course});}} style={{fontSize:13,color:T.mu,fontWeight:700}}>Quit</button>
          </div>
        </div>
        <div style={{height:6,background:T.sf,borderRadius:3}}>
          <div style={{height:"100%",background:T.fg,borderRadius:3,width:`${prog}%`,transition:"width .4s ease"}}/>
        </div>
      </div>

      {/* Question */}
      <div className="as" key={`${cur}-${pI}`} style={{flex:1,padding:"18px 20px 16px",overflowY:"auto"}}>
        <div style={{display:"inline-block",background:T.fg,color:T.bg,borderRadius:8,padding:"5px 13px",fontSize:11,fontWeight:800,letterSpacing:".08em",marginBottom:16}}>
          {mLbl}
        </div>
        <div style={{background:T.fg,borderRadius:22,padding:"22px 20px",marginBottom:20,color:T.bg}}>
          <p style={{fontSize:16,lineHeight:1.7,fontWeight:600}}>{curQ.question}</p>
        </div>

        {/* Options */}
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {["A","B","C","D"].map(l=>{
            let bg=T.cd,bdr=T.br,col=T.fg,fw=600;
            if (revealed) {
              if (l===curQ.answer){bg="#dcfce7";bdr="#16a34a";col="#16a34a";fw=800;}
              else if (l===sel){bg="#fee2e2";bdr="#dc2626";col="#dc2626";fw=800;}
            } else if (sel===l){bg=T.fg;bdr=T.fg;col=T.bg;fw=800;}
            return (
              <button key={l} onClick={()=>pick(l)} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 18px",border:`2px solid ${bdr}`,borderRadius:16,background:bg,color:col,cursor:revealed?"default":"pointer",transition:"all .15s",textAlign:"left"}}>
                <span style={{width:34,height:34,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:revealed?"transparent":(sel===l?"rgba(255,255,255,.2)":T.sf),fontSize:14,fontWeight:900}}>{l}</span>
                <span style={{fontSize:14,lineHeight:1.5,fontWeight:fw,flex:1}}>{curQ[l]}</span>
                {revealed&&l===curQ.answer&&<span style={{flexShrink:0,fontSize:18}}>✓</span>}
                {revealed&&l===sel&&l!==curQ.answer&&<span style={{flexShrink:0,fontSize:18}}>✗</span>}
              </button>
            );
          })}
        </div>

        {revealed&&sel!==curQ.answer&&(
          <div style={{marginTop:16,background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:16,padding:18}}>
            {loadExp
              ? <div style={{display:"flex",alignItems:"center",gap:10}}><Spin sz={18}/><span style={{fontSize:13,color:"#1e40af",fontWeight:600}}>AI is explaining...</span></div>
              : aiExp?<p style={{fontSize:13,color:"#1e3a8a",lineHeight:1.8}}>🤖 {aiExp}</p>:null}
          </div>
        )}
        {revealed&&sel===curQ.answer&&(
          <div style={{marginTop:16,background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:14,padding:14,textAlign:"center"}}>
            <p style={{fontSize:15,color:"#16a34a",fontWeight:800}}>✓ Correct!</p>
          </div>
        )}

        {/* Question navigator */}
        {mode==="test"&&questions.length>1&&(
          <div style={{marginTop:24}}>
            <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".06em",textTransform:"uppercase",marginBottom:12}}>Question Navigator</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {questions.map((_,i)=>{
                const done=answers[i]!==undefined; const isCur=i===cur; const fl=flags.has(i);
                return (
                  <button key={i} onClick={()=>goQ(i)} style={{width:38,height:38,borderRadius:9,fontSize:13,fontWeight:800,border:`2px solid ${isCur?T.fg:done?"#16a34a":T.br}`,background:isCur?T.fg:done?"#dcfce7":T.sf,color:isCur?T.bg:done?"#16a34a":T.mu,position:"relative"}}>
                    {i+1}
                    {fl&&<span style={{position:"absolute",top:-5,right:-5,fontSize:10}}>🚩</span>}
                  </button>
                );
              })}
            </div>
            <p style={{fontSize:12,color:T.mu,marginTop:10}}>
              {Object.keys(answers).length} answered · {questions.length-Object.keys(answers).length} remaining
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{padding:"14px 20px 36px",borderTop:`1px solid ${T.br}`,flexShrink:0}}>
        {mode==="test"?(
          <div style={{display:"flex",gap:10}}>
            {cur>0&&<button onClick={prevQ} style={{flex:1,background:T.sf,color:T.fg,borderRadius:14,padding:"15px",fontWeight:800,fontSize:15,border:`1.5px solid ${T.br}`}}>← Prev</button>}
            <button onClick={nextQ} style={{flex:2,background:T.fg,color:T.bg,borderRadius:14,padding:"15px",fontWeight:800,fontSize:15}}>
              {cur+1===questions.length?"Finish ✓":"Next →"}
            </button>
          </div>
        ):revealed?(
          <button onClick={advance} style={{width:"100%",background:T.fg,color:T.bg,borderRadius:16,padding:"17px",fontWeight:900,fontSize:16}}>
            {mode==="practice"&&sel===curQ.answer?"Got it ✓ — Next":mode==="practice"?"Retry later — Next →":"Next →"}
          </button>
        ):null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────
function Results({user,tok,go,T,ctx}) {
  const {course,mode,questions,answers,score,total,timeLeft,timed,mins,flags,masteredAll}=ctx;
  const pct=Math.round((score/total)*100);
  const {g,c}=gradeOf(pct);
  const [conf,setConf]=useState([]);
  const saved=useRef(false);

  useEffect(()=>{
    if (pct>=70) spawnConf();
    save();
  },[]);

  const spawnConf=()=>{
    const p=Array.from({length:50},(_,i)=>({id:i,x:Math.random()*100,col:["#111","#555","#999","#333","#777"][i%5],del:Math.random()*1.5,dur:2+Math.random()*2,sz:6+Math.random()*10}));
    setConf(p); setTimeout(()=>setConf([]),6000);
  };

  const save=async()=>{
    if (saved.current||mode==="practice") return;
    saved.current=true;
    try {
      const tt=timed?(mins*60-(timeLeft||0)):null;
      await db("sessions",{method:"POST",body:JSON.stringify({user_id:user.id,course_id:course.id,course_code:course.code,score,total,percentage:pct,grade:g,mode,time_taken:tt,answers:JSON.stringify(answers),question_ids:questions.map(q=>q.id)})},tok);
    } catch {}
  };

  const wrong=questions.filter((q,i)=>answers[i]!==q.answer).length;
  const tt=timed?(mins*60-(timeLeft||0)):null;
  const fmtT=(s)=>s?`${Math.floor(s/60)}m ${s%60}s`:"—";

  return (
    <Pg>
      {conf.map(p=>(
        <div key={p.id} style={{position:"fixed",left:`${p.x}%`,top:-10,width:p.sz,height:p.sz,background:p.col,borderRadius:2,zIndex:9998,animation:`fall ${p.dur}s ${p.del}s linear forwards`}}/>
      ))}

      <div className="ap" style={{textAlign:"center",paddingTop:16,marginBottom:36}}>
        <div style={{fontSize:80,marginBottom:8}}>{masteredAll?"🏆":pct>=70?"🎉":pct>=50?"💪":"📚"}</div>
        {masteredAll?(
          <h2 style={{fontSize:34,fontWeight:900,color:"#16a34a"}}>All Mastered!</h2>
        ):(
          <>
            <div style={{fontSize:88,fontWeight:900,letterSpacing:"-.05em",color:c,lineHeight:1}}>{pct}%</div>
            <div style={{fontSize:44,fontWeight:900,color:c,marginBottom:8}}>{g}</div>
            <p style={{color:T.mu,fontSize:16,fontWeight:600}}>{score} correct out of {total}</p>
          </>
        )}
      </div>

      {!masteredAll&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:32}}>
          {[{l:"✓",sub:"Correct",v:score,c:"#16a34a"},{l:"✗",sub:"Wrong",v:wrong,c:"#dc2626"},{l:"⏱",sub:"Time",v:fmtT(tt),c:T.fg},{l:"🚩",sub:"Flagged",v:(flags||[]).length,c:"#d97706"}].map(s=>(
            <div key={s.sub} style={{background:T.sf,borderRadius:14,padding:"14px 8px",textAlign:"center",border:`1.5px solid ${T.br}`}}>
              <div style={{fontSize:11,marginBottom:4}}>{s.l}</div>
              <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:T.mu,marginTop:2,fontWeight:700}}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {!masteredAll&&mode==="test"&&(
          <button onClick={()=>go("review",ctx)} style={{background:T.fg,color:T.bg,borderRadius:16,padding:"17px",fontWeight:900,fontSize:16}}>📋 Review Answers</button>
        )}
        <button onClick={()=>go("mode-select",{course})} style={{background:T.sf,color:T.fg,borderRadius:16,padding:"15px",fontWeight:800,fontSize:15,border:`1.5px solid ${T.br}`}}>🔄 Try Again</button>
        <button onClick={()=>go("home")} style={{background:"transparent",color:T.mu,borderRadius:16,padding:"13px",fontWeight:700,fontSize:14}}>🏠 Home</button>
      </div>
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW
// ─────────────────────────────────────────────────────────────────────────────
function Review({go,T,ctx}) {
  const {course,questions,answers,score,total,flags}=ctx;
  const [filter,setFilter]=useState("all");
  const [exps,setExps]=useState({}); const [loading,setLoading]=useState({});
  const fSet=new Set(flags||[]);

  const explain=async(i)=>{
    if (exps[i]) return;
    setLoading(p=>({...p,[i]:true}));
    const q=questions[i];
    const e=await ai(`Explain clearly why the correct answer is ${q.answer} in 4-5 sentences.\nQ: ${q.question}\nA.${q.A} B.${q.B} C.${q.C} D.${q.D}\nCorrect: ${q.answer}. ${q[q.answer]}\nStudent chose: ${answers[i]}. ${q[answers[i]]}`);
    setExps(p=>({...p,[i]:e})); setLoading(p=>({...p,[i]:false}));
  };

  const filt=questions.map((q,i)=>({q,i})).filter(({i})=>{
    if (filter==="wrong") return answers[i]!==questions[i].answer;
    if (filter==="correct") return answers[i]===questions[i].answer;
    if (filter==="flagged") return fSet.has(i);
    return true;
  });

  return (
    <Pg>
      <Back onClick={()=>go("results",ctx)} T={T}/>
      <H1 T={T}>Review</H1>
      <p style={{color:T.mu,fontSize:13,marginBottom:22}}>{score}/{total} correct</p>

      <div style={{display:"flex",gap:8,marginBottom:26,flexWrap:"wrap"}}>
        {[["all","All"],["wrong","Wrong"],["correct","Correct"],["flagged","Flagged 🚩"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"9px 18px",borderRadius:22,fontSize:13,fontWeight:800,border:`1.5px solid ${T.br}`,background:filter===v?T.fg:T.sf,color:filter===v?T.bg:T.fg}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {filt.map(({q,i})=>{
          const ok=answers[i]===q.answer;
          return (
            <div key={i} style={{border:`1.5px solid ${ok?"#16a34a":"#dc2626"}44`,borderRadius:18,overflow:"hidden"}}>
              <div style={{padding:"18px",background:ok?"#f0fdf4":"#fff5f5"}}>
                <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"flex-start"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{ok?"✅":"❌"}</span>
                  <p style={{fontSize:14,fontWeight:700,color:"#111",lineHeight:1.6,flex:1}}>Q{i+1}. {q.question}</p>
                  {fSet.has(i)&&<span style={{flexShrink:0}}>🚩</span>}
                </div>
                {["A","B","C","D"].map(l=>(
                  <div key={l} style={{fontSize:13,padding:"7px 12px",borderRadius:10,marginBottom:5,background:l===q.answer?"#dcfce7":l===answers[i]&&!ok?"#fee2e2":"transparent",color:l===q.answer?"#16a34a":l===answers[i]&&!ok?"#dc2626":"#777",fontWeight:l===q.answer||l===answers[i]?800:400}}>
                    {l===q.answer?"✓ ":l===answers[i]&&!ok?"✗ ":"   "}{l}. {q[l]}
                  </div>
                ))}
              </div>
              {!ok&&(
                <div style={{padding:"14px 18px",borderTop:`1px solid ${T.br}`,background:T.cd}}>
                  {!exps[i]?(
                    <button onClick={()=>explain(i)} style={{display:"flex",alignItems:"center",gap:8,color:"#1e40af",fontSize:14,fontWeight:800}}>
                      {loading[i]?<><Spin sz={18}/>Getting explanation...</>:"🤖 Get AI Explanation"}
                    </button>
                  ):(
                    <p style={{fontSize:13,color:T.fg,lineHeight:1.8}}>{exps[i]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!filt.length&&<p style={{textAlign:"center",color:T.mu,padding:"40px 0",fontSize:15}}>Nothing to show.</p>}
      </div>
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
function Perf({user,tok,go,msg,T}) {
  const [sess,setSess]=useState([]); const [loading,setLoading]=useState(true);
  const [clearing,setClearing]=useState(false); const [sel,setSel]=useState("all");

  useEffect(()=>{
    db(`sessions?user_id=eq.${user.id}&order=created_at.desc`,{},tok).then(s=>setSess(s||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const clear=async()=>{
    if (!window.confirm("Clear all session history? Cannot be undone.")) return;
    setClearing(true);
    try { await db(`sessions?user_id=eq.${user.id}`,{method:"DELETE"},tok); setSess([]); msg("Cleared","success"); }
    catch(e){ msg(e.message,"error"); }
    setClearing(false);
  };

  const codes=["all",...new Set(sess.map(s=>s.course_code).filter(Boolean))];
  const filt=sel==="all"?sess:sess.filter(s=>s.course_code===sel);
  const avg=filt.length?Math.round(filt.reduce((a,s)=>a+(s.percentage||0),0)/filt.length):0;
  const best=filt.length?Math.max(...filt.map(s=>s.percentage||0)):0;
  const chart=[...filt].reverse().slice(-12);

  return (
    <Pg>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <H1 T={T}>Performance</H1>
        {sess.length>0&&<button onClick={clear} disabled={clearing} style={{fontSize:13,color:"#dc2626",fontWeight:800}}>{clearing?"...":"Clear"}</button>}
      </div>
      <p style={{color:T.mu,fontSize:13,marginBottom:22}}>{sess.length} total sessions</p>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:22}}>
        {codes.map(c=>(
          <button key={c} onClick={()=>setSel(c)} style={{padding:"8px 16px",borderRadius:22,fontSize:12,fontWeight:800,flexShrink:0,background:sel===c?T.fg:T.sf,color:sel===c?T.bg:T.fg,border:`1.5px solid ${T.br}`}}>
            {c==="all"?"All":c}
          </button>
        ))}
      </div>

      {loading?<div style={{display:"flex",justifyContent:"center",paddingTop:48}}><Spin sz={40}/></div>
      :!sess.length?(
        <div style={{textAlign:"center",paddingTop:64}}>
          <div style={{fontSize:56,marginBottom:14}}>📊</div>
          <p style={{color:T.mu,fontSize:16,fontWeight:700}}>No sessions yet.</p>
          <p style={{color:T.mu,fontSize:13,marginTop:6}}>Take a test to see your performance here.</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:28}}>
            {[{l:"Sessions",v:filt.length},{l:"Average",v:`${avg}%`},{l:"Best",v:`${best}%`}].map(s=>(
              <div key={s.l} style={{background:T.fg,borderRadius:18,padding:"20px 12px",textAlign:"center",color:T.bg}}>
                <div style={{fontSize:24,fontWeight:900,letterSpacing:"-.02em"}}>{s.v}</div>
                <div style={{fontSize:11,opacity:.5,marginTop:4,fontWeight:700}}>{s.l}</div>
              </div>
            ))}
          </div>

          {chart.length>1&&(
            <div style={{marginBottom:28}}>
              <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".06em",textTransform:"uppercase",marginBottom:14}}>Score Trend</p>
              <div style={{background:T.sf,borderRadius:18,padding:"24px 16px 16px",border:`1.5px solid ${T.br}`}}>
                <svg width="100%" height="110" viewBox={`0 0 ${Math.max((chart.length-1)*30,30)} 100`} preserveAspectRatio="none">
                  {[0,50,100].map(y=><line key={y} x1="0" y1={100-y} x2="9999" y2={100-y} stroke={T.br} strokeWidth=".5"/>)}
                  <polyline points={chart.map((s,i)=>`${i*30},${100-(s.percentage||0)}`).join(" ")} fill="none" stroke={T.fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {chart.map((s,i)=>{const{c}=gradeOf(s.percentage||0);return <circle key={i} cx={i*30} cy={100-(s.percentage||0)} r="5" fill={c}/>;} )}
                </svg>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                  <span style={{fontSize:11,color:T.mu}}>Oldest</span>
                  <span style={{fontSize:11,color:T.mu}}>Latest</span>
                </div>
              </div>
            </div>
          )}

          <p style={{fontSize:11,fontWeight:800,color:T.mu,letterSpacing:".06em",textTransform:"uppercase",marginBottom:14}}>All Sessions</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filt.map(s=>{
              const{g,c}=gradeOf(s.percentage||0);
              const me=s.mode==="study"?"📖":s.mode==="practice"?"🏋️":"🧪";
              return(
                <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",background:T.sf,borderRadius:16,border:`1.5px solid ${T.br}`}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:T.fg}}>{me} {s.course_code}</div>
                    <div style={{fontSize:12,color:T.mu,marginTop:2}}>{new Date(s.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,fontWeight:800,color:T.fg}}>{s.score}/{s.total}</span>
                    <Badge c={c}>{g}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Pg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
function Profile({user,tok,go,msg,T,out}) {
  const [name,setName]=useState(user?.user_metadata?.full_name||"");
  const [uname,setUname]=useState(user?.user_metadata?.username||"");
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef();

  const meta=user?.user_metadata||{};
  const avatar=meta.avatar_url;
  const displayName=meta.full_name||meta.username||"Student";
  const uid=(user?.id||"--------").slice(0,8).toUpperCase();

  const saveProfile=async()=>{
    if (!name.trim()) return msg("Name cannot be empty","error");
    setSaving(true);
    try {
      await fetch(`${SB}/auth/v1/user`,{method:"PUT",headers:{apikey:KEY,Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},body:JSON.stringify({data:{full_name:name.trim(),username:uname.trim().toLowerCase()||meta.username}})});
      const updated={...user,user_metadata:{...meta,full_name:name.trim(),username:uname.trim().toLowerCase()||meta.username}};
      localStorage.setItem("md_u",JSON.stringify(updated));
      msg("Profile updated!","success");
    } catch(e){ msg(e.message,"error"); }
    setSaving(false);
  };

  const uploadPhoto=async(e)=>{
    const file=e.target.files?.[0]; if (!file) return;
    if (file.size>3*1024*1024) return msg("Photo must be under 3MB","error");
    setUploading(true);
    try {
      // Convert to base64 data URL for reliable upload
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        try {
          const dataUrl=ev.target.result;
          const base64=dataUrl.split(",")[1];
          const mimeType=file.type||"image/jpeg";
          const ext=file.name.split(".").pop()||"jpg";
          const path=`avatars/${user.id}.${ext}`;

          // Try Supabase storage upload
          const upRes=await fetch(`${SB}/storage/v1/object/${path}`,{
            method:"POST",
            headers:{apikey:KEY,Authorization:`Bearer ${tok}`,"Content-Type":mimeType,"x-upsert":"true"},
            body:file,
          });

          let url;
          if (upRes.ok) {
            url=`${SB}/storage/v1/object/public/${path}?v=${Date.now()}`;
          } else {
            // Fallback: store as data URL in user metadata directly
            url=dataUrl;
          }

          // Update user metadata with avatar
          await fetch(`${SB}/auth/v1/user`,{method:"PUT",headers:{apikey:KEY,Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},body:JSON.stringify({data:{avatar_url:url}})});
          const updated={...user,user_metadata:{...meta,avatar_url:url}};
          localStorage.setItem("md_u",JSON.stringify(updated));
          msg("Photo updated!","success");
          setTimeout(()=>window.location.reload(),800);
        } catch(err){ msg("Failed: "+err.message,"error"); }
        setUploading(false);
      };
      reader.onerror=()=>{ msg("Could not read image file","error"); setUploading(false); };
      reader.readAsDataURL(file);
    } catch(e){ msg(e.message,"error"); setUploading(false); }
  };

  return (
    <Pg>
      <H1 T={T}>Profile</H1>
      <p style={{color:T.mu,fontSize:13,marginBottom:32}}>Your account details</p>

      {/* Avatar */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:32}}>
        <div onClick={()=>!uploading&&fileRef.current?.click()} style={{width:100,height:100,borderRadius:"50%",background:T.fg,border:`3px solid ${T.br}`,overflow:"hidden",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",marginBottom:10}}>
          {avatar
            ? <img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
            : <span style={{color:T.bg,fontSize:36,fontWeight:900}}>{(meta.username||meta.full_name||"?")[0]?.toUpperCase()}</span>}
          {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center"}}><Spin c="#fff"/></div>}
          {/* Camera overlay */}
          {!uploading&&<div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,.5)",padding:"6px 0",textAlign:"center"}}>
            <span style={{fontSize:16}}>📷</span>
          </div>}
        </div>
        <p style={{color:T.mu,fontSize:12,fontWeight:600}}>Tap photo to change</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} style={{display:"none"}}/>
      </div>

      {/* ID card */}
      <div style={{background:T.fg,borderRadius:20,padding:"22px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
        <p style={{fontSize:11,fontWeight:800,opacity:.4,letterSpacing:".1em",textTransform:"uppercase",marginBottom:6,color:T.bg}}>Student ID</p>
        <p style={{fontSize:28,fontWeight:900,fontFamily:"JetBrains Mono,monospace",letterSpacing:".1em",color:T.bg}}>#{uid}</p>
        <p style={{fontSize:14,opacity:.5,marginTop:6,color:T.bg,fontWeight:600}}>{user?.email}</p>
        {meta.username&&<p style={{fontSize:16,color:T.bg,fontWeight:800,marginTop:4,opacity:.7}}>@{meta.username}</p>}
      </div>

      {/* Edit fields */}
      <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:20}}>
        <div>
          <Label>Full Name</Label>
          <input value={name} onChange={e=>setName(e.target.value)} style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:14,padding:"15px 16px",fontSize:15,background:T.bg,color:T.fg}}/>
        </div>
        <div>
          <Label>Username</Label>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontWeight:700,fontSize:15}}>@</span>
            <input value={uname} onChange={e=>setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))}
              style={{width:"100%",border:`1.5px solid ${T.br}`,borderRadius:14,padding:"15px 16px 15px 32px",fontSize:15,background:T.bg,color:T.fg}}/>
          </div>
        </div>
      </div>

      <button onClick={saveProfile} disabled={saving} style={{width:"100%",background:T.fg,color:T.bg,borderRadius:14,padding:"16px",fontWeight:900,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12,opacity:saving?.6:1}}>
        {saving?<><Spin c={T.bg}/>Saving...</>:"Save Changes"}
      </button>

      <button onClick={out} style={{width:"100%",background:"#fff1f2",color:"#dc2626",borderRadius:16,padding:"16px",fontWeight:800,fontSize:16,border:"1.5px solid #fecdd3"}}>
        Sign Out
      </button>
    </Pg>
  );
}
