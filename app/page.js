// app/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "./hooks/useGameSocket";
import { GAME_LABELS } from "./lib/labels";

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom, connected, error: socketError } = useGameSocket();

  const [uiLang,     setUiLang]     = useState("en");
  const [gameLang,   setGameLang]   = useState("en");
  const [view,       setView]       = useState("home");
  const [name,       setName]       = useState("");
  const [joinCode,   setJoinCode]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [localError, setLocalError] = useState(null);
  const [secs,       setSecs]       = useState(0);

  const t   = GAME_LABELS[uiLang] ?? GAME_LABELS.en;
  const err = localError || socketError;

  // Count seconds while disconnected
  useEffect(() => {
    if (connected) { setSecs(0); return; }
    const id = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  // Bounce to /game if already in a session
  useEffect(() => {
    const stored = sessionStorage.getItem("exquisite_roomCode");
    if (stored) router.replace("/game");
  }, []);

  function clearError() { setLocalError(null); }

  async function handleCreate() {
    clearError();
    if (!name.trim())  return setLocalError(t.needName);
    if (!connected)    return setLocalError(t.notConnected);
    setLoading(true);
    try {
      await createRoom(name.trim(), gameLang);
      router.push("/game");
    } catch (e) { setLocalError(e.message); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    clearError();
    if (!name.trim())             return setLocalError(t.needName);
    if (joinCode.trim().length !== 4) return setLocalError(t.needCode);
    if (!connected)               return setLocalError(t.notConnected);
    setLoading(true);
    try {
      await joinRoom(name.trim(), joinCode.trim().toUpperCase());
      router.push("/game");
    } catch (e) { setLocalError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <main style={s.main}>

      {/* Language switcher */}
      <div style={s.uiLangToggle}>
        <button style={uiLang === "en" ? s.uiLangActive : s.uiLangBtn} onClick={() => setUiLang("en")}>EN</button>
        <span style={{ color: "#444" }}>|</span>
        <button style={uiLang === "cs" ? s.uiLangActive : s.uiLangBtn} onClick={() => setUiLang("cs")}>CS</button>
      </div>

      {/* Connection status */}
      {!connected ? (
        <div style={s.connectingBanner}>
          {t.connecting}{secs > 5 ? ` (${secs}s)` : ""}
        </div>
      ) : (
        <div style={s.connectedBanner}>{t.connected}</div>
      )}

      {/* Logo */}
      <div style={s.logoWrap}>
        <div style={s.logoEmoji}>🎲</div>
        <h1 style={s.title}>{t.title}</h1>
        <p style={s.subtitle}>{t.subtitle}</p>
      </div>

      {/* Error */}
      {err && <div style={s.errorBanner} role="alert">⚠️ {err}</div>}

      {/* HOME */}
      {view === "home" && (
        <div style={s.homeButtons}>
          <button style={!connected ? s.btnDisabled : s.btnPrimary} disabled={!connected}
            onClick={() => { clearError(); setView("create"); }}>
            {t.createRoom}
          </button>
          <button style={!connected ? s.btnDisabled : s.btnSecondary} disabled={!connected}
            onClick={() => { clearError(); setView("join"); }}>
            {t.joinRoom}
          </button>
        </div>
      )}

      {/* CREATE */}
      {view === "create" && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>{t.createTitle}</h2>
          <label style={s.label}>{uiLang === "cs" ? "Tvoje jméno" : "Your name"}</label>
          <input style={s.input} placeholder={t.namePlaceholder} value={name} maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus autoComplete="given-name" />

          <label style={s.label}>{t.langLabel}</label>
          <div style={s.langRow}>
            {["en","cs"].map((l) => (
              <button key={l} style={gameLang === l ? s.langActive : s.langInactive}
                onClick={() => setGameLang(l)}>
                {GAME_LABELS[l].lang}
              </button>
            ))}
          </div>

          <button style={loading || !name.trim() || !connected ? s.btnDisabled : s.btnPrimary}
            disabled={loading || !name.trim() || !connected} onClick={handleCreate}>
            {loading ? t.creating : t.startCreate}
          </button>
          <button style={s.backLink} onClick={() => { clearError(); setView("home"); }}>{t.back}</button>
        </div>
      )}

      {/* JOIN */}
      {view === "join" && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>{t.joinTitle}</h2>
          <label style={s.label}>{uiLang === "cs" ? "Tvoje jméno" : "Your name"}</label>
          <input style={s.input} placeholder={t.namePlaceholder} value={name} maxLength={24}
            onChange={(e) => setName(e.target.value)}
            autoFocus autoComplete="given-name" />

          <label style={s.label}>{uiLang === "cs" ? "Kód místnosti" : "Room code"}</label>
          <input style={s.codeInput} placeholder={t.codePlaceholder} maxLength={4}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} />

          <button style={loading || !name.trim() || joinCode.length !== 4 || !connected ? s.btnDisabled : s.btnPrimary}
            disabled={loading || !name.trim() || joinCode.length !== 4 || !connected} onClick={handleJoin}>
            {loading ? t.joining : t.startJoin}
          </button>
          <button style={s.backLink} onClick={() => { clearError(); setView("home"); }}>{t.back}</button>
        </div>
      )}

      <p style={s.footer}>{t.footer}</p>
    </main>
  );
}

const s = {
  main:            { minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem 4rem", gap:"1.25rem", position:"relative" },
  uiLangToggle:    { position:"absolute", top:"1.25rem", right:"1.25rem", display:"flex", alignItems:"center", gap:"0.4rem" },
  uiLangBtn:       { background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"0.8rem", fontWeight:"bold", padding:"0.2rem 0.3rem" },
  uiLangActive:    { background:"none", border:"none", color:"#e74c3c", cursor:"pointer", fontSize:"0.8rem", fontWeight:"bold", padding:"0.2rem 0.3rem" },
  connectingBanner:{ background:"#2c1a00", border:"1px solid #f39c12", color:"#f39c12", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.8rem", width:"100%", maxWidth:"380px", textAlign:"center" },
  connectedBanner: { background:"#0a2c0a", border:"1px solid #2ecc71", color:"#2ecc71", borderRadius:"8px", padding:"0.4rem 1rem", fontSize:"0.78rem", width:"100%", maxWidth:"380px", textAlign:"center" },
  logoWrap:        { display:"flex", flexDirection:"column", alignItems:"center", gap:"0.25rem" },
  logoEmoji:       { fontSize:"3.5rem", lineHeight:1 },
  title:           { fontFamily:"'Bangers',cursive", fontSize:"clamp(2.8rem,12vw,4.5rem)", letterSpacing:"0.08em", color:"#e74c3c", margin:0, lineHeight:1 },
  subtitle:        { color:"#666", fontSize:"0.82rem", margin:0, letterSpacing:"0.08em", textTransform:"uppercase" },
  errorBanner:     { background:"#2c0a08", border:"1px solid #7b241c", color:"#e74c3c", borderRadius:"8px", padding:"0.75rem 1rem", width:"100%", maxWidth:"380px", fontSize:"0.88rem", textAlign:"center" },
  homeButtons:     { display:"flex", flexDirection:"column", gap:"0.85rem", width:"100%", maxWidth:"340px" },
  card:            { background:"#16213e", border:"1px solid #0f3460", borderRadius:"14px", padding:"1.75rem 1.5rem", display:"flex", flexDirection:"column", gap:"0.85rem", width:"100%", maxWidth:"360px" },
  cardTitle:       { fontFamily:"'Bangers',cursive", fontSize:"1.6rem", letterSpacing:"0.06em", color:"#f39c12", margin:0 },
  label:           { color:"#777", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"-0.4rem" },
  input:           { padding:"0.8rem 1rem", borderRadius:"8px", border:"1px solid #0f3460", background:"#0d1b36", color:"#eee", fontSize:"1rem", outline:"none", width:"100%", boxSizing:"border-box" },
  codeInput:       { padding:"0.8rem 1rem", borderRadius:"8px", border:"2px solid #0f3460", background:"#0d1b36", color:"#e74c3c", fontSize:"2rem", fontFamily:"'Bangers',cursive", letterSpacing:"0.5em", textAlign:"center", outline:"none", width:"100%", boxSizing:"border-box", textTransform:"uppercase" },
  langRow:         { display:"flex", gap:"0.6rem" },
  langActive:      { flex:1, background:"#e74c3c", color:"#fff", border:"none", borderRadius:"8px", padding:"0.65rem 0.5rem", fontSize:"0.9rem", cursor:"pointer", fontWeight:"bold" },
  langInactive:    { flex:1, background:"#0d1b36", color:"#777", border:"1px solid #0f3460", borderRadius:"8px", padding:"0.65rem 0.5rem", fontSize:"0.9rem", cursor:"pointer" },
  btnPrimary:      { background:"#e74c3c", color:"#fff", border:"none", borderRadius:"10px", padding:"0.9rem", fontSize:"1rem", fontWeight:"bold", cursor:"pointer", width:"100%" },
  btnSecondary:    { background:"#0f3460", color:"#eee", border:"1px solid #1a4a7a", borderRadius:"10px", padding:"0.9rem", fontSize:"1rem", cursor:"pointer", width:"100%" },
  btnDisabled:     { background:"#1e1e2e", color:"#444", border:"none", borderRadius:"10px", padding:"0.9rem", fontSize:"1rem", cursor:"not-allowed", width:"100%" },
  backLink:        { background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"0.85rem", padding:"0.25rem", alignSelf:"flex-start" },
  footer:          { color:"#333", fontSize:"0.72rem", textAlign:"center", position:"absolute", bottom:"1.5rem" },
};
