// components/ReviewPhase.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { GAME_LABELS } from "../lib/labels";

// ─── Star Button ─────────────────────────────────────────────────────────────

function StarButton({ value, selected, disabled, onClick }) {
  return (
    <button
      onClick={() => !disabled && onClick(value)}
      disabled={disabled}
      style={{
        background: "none", border: "none",
        cursor: disabled ? "default" : "pointer",
        fontSize: "clamp(2.2rem, 8vw, 3.5rem)",
        filter: selected ? "none" : "grayscale(1) opacity(0.35)",
        transform: selected ? "scale(1.25)" : "scale(1)",
        transition: "transform 0.15s, filter 0.15s",
        padding: "0.2rem 0.4rem", lineHeight: 1,
      }}
      aria-label={`${value} star${value > 1 ? "s" : ""}`}
    >⭐</button>
  );
}

// ─── Countdown Ring (key-reset pattern) ──────────────────────────────────────

function CountdownRing({ duration, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(duration / 1000));
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setTimeLeft(Math.ceil(duration / 1000));
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((duration - (Date.now() - startRef.current)) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) { clearInterval(id); onExpire?.(); }
    }, 250);
    return () => clearInterval(id);
  }, []); // intentionally empty — remount via key

  const pct  = (timeLeft / Math.ceil(duration / 1000)) * 100;
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const col  = pct > 50 ? "#2ecc71" : pct > 25 ? "#f39c12" : "#e74c3c";

  return (
    <div style={{ position: "relative", width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#333" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={col} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.25s, stroke 0.5s" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Bangers', cursive", fontSize: "1.6rem", color: col,
      }}>{timeLeft}</span>
    </div>
  );
}

// ─── Sentence Fragments ───────────────────────────────────────────────────────

const FONTS  = ["'Abril Fatface',serif","'Permanent Marker',cursive","'Lobster',cursive","'Pacifico',cursive","'Playfair Display',serif","'Bangers',cursive"];
const COLORS = ["#e74c3c","#3498db","#9b59b6","#e67e22","#1abc9c","#f39c12"];

function Fragment({ text, index, visible }) {
  return (
    <span style={{
      fontFamily: FONTS[index % FONTS.length],
      color: COLORS[index % COLORS.length],
      fontSize: "clamp(1.1rem, 4vw, 1.6rem)",
      display: "inline-block", padding: "0.15em 0.4em", lineHeight: 1.25,
      transform: `rotate(${(index % 2 === 0 ? 1 : -1) * (index % 3)}deg)`,
      verticalAlign: "middle",
      opacity: visible ? 1 : 0,
      transition: `opacity 0.4s ease ${index * 0.12}s`,
      background: "rgba(255,255,255,0.04)", borderRadius: "4px",
    }}>{text}</span>
  );
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
      <span style={{ width: "2.5rem", textAlign: "right", fontSize: "0.85rem" }}>{label}</span>
      <div style={{ flex: 1, height: "22px", background: "#222", borderRadius: "11px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "11px",
          transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)", minWidth: pct > 0 ? "22px" : "0" }} />
      </div>
      <span style={{ width: "1.5rem", color: "#aaa", fontSize: "0.85rem" }}>{count}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReviewPhase({ reviewSentence, roundResults, alreadyVoted, playerId, onVote, lang = "en" }) {
  const t = GAME_LABELS[lang] ?? GAME_LABELS.en;

  const [selectedStars,   setSelectedStars]   = useState(null);
  const [sentenceVisible, setSentenceVisible] = useState(false);
  const [votingExpired,   setVotingExpired]   = useState(false);

  const sentenceIndex = reviewSentence?.sentenceIndex;

  // Full reset when sentence changes
  useEffect(() => {
    if (sentenceIndex === undefined || sentenceIndex === null) return;
    setSelectedStars(null);
    setVotingExpired(false);
    setSentenceVisible(false);
    const tid = setTimeout(() => setSentenceVisible(true), 400);
    return () => clearTimeout(tid);
  }, [sentenceIndex]);

  if (!reviewSentence) {
    return (
      <div style={s.center}>
        <div style={s.drumroll}>{t.getReady}</div>
      </div>
    );
  }

  const { sentence, phaseLabels, reviewDuration, totalSentences } = reviewSentence;
  const votingClosed = alreadyVoted || votingExpired || !!roundResults;

  function handleVote(stars) {
    if (votingClosed) return;
    setSelectedStars(stars);
    onVote(stars);
  }

  // ── Round results overlay ─────────────────────────────────────────────────
  if (roundResults) {
    const { voteBreakdown, avgScore, commentary, scores, isLastSentence } = roundResults;
    const total     = Object.values(voteBreakdown).reduce((a, b) => a + b, 0);
    const scoreList = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
    const medals    = ["🥇","🥈","🥉"];

    return (
      <div style={s.wrapper}>
        <div style={s.commentaryBanner}>
          <span style={s.commentaryText}>{commentary}</span>
        </div>

        <div style={s.sentenceCard}>
          <div style={s.sentenceRow}>
            {sentence.map((frag, i) => <Fragment key={i} text={frag} index={i} visible={true} />)}
          </div>
        </div>

        <div style={s.voteSection}>
          <div style={s.hint}>{t.votesCast(total)}</div>
          <VoteBar label="⭐"       count={voteBreakdown[1] ?? 0} total={total} color="#e74c3c" />
          <VoteBar label="⭐⭐"    count={voteBreakdown[2] ?? 0} total={total} color="#f39c12" />
          <VoteBar label="⭐⭐⭐" count={voteBreakdown[3] ?? 0} total={total} color="#2ecc71" />
          <div style={{ color: "#f39c12", fontFamily: "'Bangers', cursive", fontSize: "1.3rem", marginTop: "0.4rem" }}>
            {t.average(avgScore)}
          </div>
        </div>

        <div style={s.leaderboard}>
          <div style={s.hint}>{isLastSentence ? t.finalScores : t.scoresSoFar}</div>
          {scoreList.map(([pid, { name, score }], i) => {
            const isMe = pid === playerId;
            return (
              <div key={pid} style={{
                ...s.leaderRow,
                background: isMe ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.04)",
                border: isMe ? "1px solid rgba(231,76,60,0.4)" : "1px solid transparent",
              }}>
                <span style={{ fontSize: "1.3rem", width: "2rem", textAlign: "center" }}>{medals[i] ?? `${i+1}.`}</span>
                <span style={{ flex: 1, color: isMe ? "#e74c3c" : "#eee", fontWeight: isMe ? "bold" : "normal" }}>
                  {name}{isMe ? ` ${t.you}` : ""}
                </span>
                <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.3rem", color: "#f39c12" }}>
                  {score.toFixed(1)} ⭐
                </span>
              </div>
            );
          })}
        </div>

        <div style={s.nextHint}>
          {isLastSentence ? t.finalResults : t.nextStory}
        </div>
      </div>
    );
  }

  // ── Active voting ─────────────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <div style={s.storyCounter}>{t.story(sentenceIndex + 1, totalSentences)}</div>
        <CountdownRing key={sentenceIndex} duration={reviewDuration} onExpire={() => setVotingExpired(true)} />
      </div>

      <div style={s.sentenceCard}>
        {!sentenceVisible ? (
          <div style={s.drumroll}>{t.drumroll}</div>
        ) : (
          <>
            <div style={s.phaseTrail}>{phaseLabels.join("  ·  ")}</div>
            <div style={s.sentenceRow}>
              {sentence.map((frag, i) => <Fragment key={i} text={frag} index={i} visible={sentenceVisible} />)}
            </div>
          </>
        )}
      </div>

      <div style={s.voteArea}>
        {votingClosed ? (
          <div style={s.voteConfirm}>
            {selectedStars ? t.waitingVote(selectedStars) : t.timesUp}
          </div>
        ) : (
          <>
            <div style={s.hint}>{t.rateThis}</div>
            <div style={s.starsRow}>
              {[1, 2, 3].map((n) => (
                <StarButton key={n} value={n} selected={selectedStars === n} disabled={!!selectedStars} onClick={handleVote} />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes pb{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1.1);opacity:1}}`}</style>
      <div style={s.pips}>
        {[0,1,2].map((i) => <div key={i} style={{ ...s.pip, animationDelay: `${i * 0.2}s` }} />)}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  wrapper:        { display:"flex", flexDirection:"column", alignItems:"center", gap:"1.25rem", padding:"1.5rem 1rem", width:"100%", maxWidth:"560px", margin:"0 auto" },
  header:         { display:"flex", width:"100%", alignItems:"center", justifyContent:"space-between" },
  storyCounter:   { fontFamily:"'Bangers',cursive", fontSize:"1.1rem", letterSpacing:"0.08em", color:"#aaa" },
  sentenceCard:   { background:"#fdf6e3", border:"2px solid #d4b896", borderRadius:"10px", boxShadow:"0 4px 20px rgba(0,0,0,.35)", padding:"1.5rem", width:"100%", minHeight:"100px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", transform:"rotate(-0.4deg)" },
  phaseTrail:     { color:"#aaa", fontSize:"0.7rem", marginBottom:"0.75rem", letterSpacing:"0.1em", textAlign:"center" },
  sentenceRow:    { display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"center", gap:"0.2rem", textAlign:"center" },
  drumroll:       { fontFamily:"'Bangers',cursive", fontSize:"2rem", color:"#888", letterSpacing:"0.1em", padding:"1rem" },
  voteArea:       { display:"flex", flexDirection:"column", alignItems:"center", background:"#16213e", borderRadius:"12px", padding:"1.25rem 1.5rem", width:"100%", minHeight:"80px", justifyContent:"center" },
  starsRow:       { display:"flex", gap:"0.5rem", alignItems:"center" },
  voteConfirm:    { color:"#2ecc71", fontFamily:"'Permanent Marker',cursive", fontSize:"1rem", textAlign:"center" },
  voteSection:    { display:"flex", flexDirection:"column", gap:"0.5rem", width:"100%", background:"#16213e", borderRadius:"12px", padding:"1.25rem" },
  commentaryBanner:{ background:"linear-gradient(135deg,#c0392b,#922b21)", borderRadius:"10px", padding:"1rem 1.5rem", width:"100%", textAlign:"center" },
  commentaryText: { fontFamily:"'Permanent Marker',cursive", fontSize:"clamp(0.9rem,3.5vw,1.15rem)", color:"#fff", lineHeight:1.4 },
  leaderboard:    { display:"flex", flexDirection:"column", gap:"0.5rem", width:"100%" },
  leaderRow:      { display:"flex", alignItems:"center", gap:"1rem", borderRadius:"10px", padding:"0.65rem 1rem" },
  nextHint:       { color:"#aaa", fontSize:"0.8rem", fontStyle:"italic" },
  hint:           { color:"#aaa", fontSize:"0.75rem", letterSpacing:"0.1em", marginBottom:"0.4rem" },
  center:         { display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" },
  pips:           { display:"flex", gap:"0.5rem" },
  pip:            { width:"8px", height:"8px", borderRadius:"50%", background:"#555", animation:"pb 1.2s ease-in-out infinite" },
};
