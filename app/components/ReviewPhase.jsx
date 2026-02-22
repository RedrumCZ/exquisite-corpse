// components/ReviewPhase.jsx
// The shared review screen — all players see the same sentence,
// vote 1-3 stars, see commentary, then scores update.
"use client";

import { useState, useEffect, useRef } from "react";

// ─── Star Button ─────────────────────────────────────────────────────────────

function StarButton({ value, selected, disabled, onClick }) {
  return (
    <button
      onClick={() => !disabled && onClick(value)}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontSize: "clamp(2.2rem, 8vw, 3.5rem)",
        filter: selected ? "none" : "grayscale(1) opacity(0.35)",
        transform: selected ? "scale(1.25)" : "scale(1)",
        transition: "transform 0.15s, filter 0.15s",
        padding: "0.2rem 0.4rem",
        lineHeight: 1,
      }}
      aria-label={`${value} star${value > 1 ? "s" : ""}`}
    >
      ⭐
    </button>
  );
}

// ─── Countdown Ring ───────────────────────────────────────────────────────────

function CountdownRing({ duration, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(duration / 1000));
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [duration]);

  const pct = (timeLeft / Math.ceil(duration / 1000)) * 100;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;

  const color = pct > 50 ? "#2ecc71" : pct > 25 ? "#f39c12" : "#e74c3c";

  return (
    <div style={{ position: "relative", width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#333" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${strokeDash} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.25s, stroke 0.5s" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Bangers', cursive",
        fontSize: "1.6rem",
        color,
      }}>
        {timeLeft}
      </span>
    </div>
  );
}

// ─── Sentence Fragments (Ransom Note style inline) ────────────────────────────

const FONT_POOL = [
  "'Abril Fatface', serif",
  "'Permanent Marker', cursive",
  "'Lobster', cursive",
  "'Pacifico', cursive",
  "'Playfair Display', serif",
  "'Bangers', cursive",
];
const COLOR_POOL = ["#e74c3c", "#3498db", "#9b59b6", "#e67e22", "#1abc9c", "#f39c12"];

function SentenceFragment({ text, index, visible }) {
  return (
    <span
      style={{
        fontFamily: FONT_POOL[index % FONT_POOL.length],
        color: COLOR_POOL[index % COLOR_POOL.length],
        fontSize: `clamp(1.1rem, 4vw, 1.6rem)`,
        display: "inline-block",
        padding: "0.15em 0.4em",
        lineHeight: 1.25,
        transform: `rotate(${(index % 2 === 0 ? 1 : -1) * (index % 3)}deg)`,
        verticalAlign: "middle",
        opacity: visible ? 1 : 0,
        transition: `opacity 0.4s ease ${index * 0.12}s`,
        background: "rgba(255,255,255,0.04)",
        borderRadius: "4px",
      }}
    >
      {text}
    </span>
  );
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
      <span style={{ width: "2rem", textAlign: "right", fontSize: "1.2rem" }}>{label}</span>
      <div style={{
        flex: 1, height: "22px", background: "#222",
        borderRadius: "11px", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color,
          borderRadius: "11px",
          transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          minWidth: pct > 0 ? "22px" : "0",
        }} />
      </div>
      <span style={{ width: "1.5rem", color: "#aaa", fontSize: "0.85rem" }}>{count}</span>
    </div>
  );
}

// ─── Leaderboard Row ──────────────────────────────────────────────────────────

function LeaderRow({ rank, name, score, isMe }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "1rem",
      background: isMe ? "rgba(231,76,60,0.15)" : "rgba(255,255,255,0.04)",
      border: isMe ? "1px solid rgba(231,76,60,0.4)" : "1px solid transparent",
      borderRadius: "10px",
      padding: "0.65rem 1rem",
    }}>
      <span style={{ fontSize: "1.4rem", width: "2rem", textAlign: "center" }}>
        {medals[rank] ?? `${rank + 1}.`}
      </span>
      <span style={{ flex: 1, fontWeight: isMe ? "bold" : "normal", color: isMe ? "#e74c3c" : "#eee" }}>
        {name} {isMe ? "(you)" : ""}
      </span>
      <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.4rem", color: "#f39c12", letterSpacing: "0.05em" }}>
        {score.toFixed(1)} ⭐
      </span>
    </div>
  );
}

// ─── Main Review Component ────────────────────────────────────────────────────

export default function ReviewPhase({
  reviewSentence,
  roundResults,
  alreadyVoted,
  playerId,
  onVote,
}) {
  const [selectedStars, setSelectedStars] = useState(null);
  const [sentenceVisible, setSentenceVisible] = useState(false);
  const [votingExpired, setVotingExpired] = useState(false);

  // Reset when a new sentence arrives
  useEffect(() => {
    if (!reviewSentence) return;
    setSelectedStars(null);
    setVotingExpired(false);
    setSentenceVisible(false);
    // Brief drumroll — then reveal text
    const t = setTimeout(() => setSentenceVisible(true), 400);
    return () => clearTimeout(t);
  }, [reviewSentence?.sentenceIndex]);

  if (!reviewSentence) {
    return (
      <div style={styles.center}>
        <div style={styles.drumroll}>⏳ Get ready…</div>
      </div>
    );
  }

  const { sentence, phaseLabels, reviewDuration, sentenceIndex, totalSentences } = reviewSentence;
  const votingClosed = alreadyVoted || votingExpired || !!roundResults;

  function handleVote(stars) {
    if (votingClosed) return;
    setSelectedStars(stars);
    onVote(stars);
  }

  // ── Round Results sub-view ──────────────────────────────────────────────
  if (roundResults) {
    const { voteBreakdown, avgScore, commentary, scores, isLastSentence } = roundResults;
    const total = Object.values(voteBreakdown).reduce((a, b) => a + b, 0);
    const scoreList = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);

    return (
      <div style={styles.wrapper}>
        {/* Commentary Banner */}
        <div style={styles.commentaryBanner}>
          <span style={styles.commentaryText}>{commentary}</span>
        </div>

        {/* Sentence recap */}
        <div style={styles.sentenceCard}>
          <div style={styles.sentenceRow}>
            {sentence.map((frag, i) => (
              <SentenceFragment key={i} text={frag} index={i} visible={true} />
            ))}
          </div>
        </div>

        {/* Vote bars */}
        <div style={styles.voteSection}>
          <div style={{ color: "#aaa", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            VOTES ({total} cast)
          </div>
          <VoteBar label="⭐" count={voteBreakdown[1] ?? 0} total={total} color="#e74c3c" />
          <VoteBar label="⭐⭐" count={voteBreakdown[2] ?? 0} total={total} color="#f39c12" />
          <VoteBar label="⭐⭐⭐" count={voteBreakdown[3] ?? 0} total={total} color="#2ecc71" />
          <div style={{ color: "#f39c12", fontFamily: "'Bangers', cursive", fontSize: "1.3rem", marginTop: "0.5rem" }}>
            Average: {avgScore} ⭐
          </div>
        </div>

        {/* Live leaderboard */}
        <div style={styles.leaderboard}>
          <div style={{ color: "#aaa", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            {isLastSentence ? "FINAL SCORES" : "SCORES SO FAR"}
          </div>
          {scoreList.map(([pid, { name, score }], i) => (
            <LeaderRow key={pid} rank={i} name={name} score={score} isMe={pid === playerId} />
          ))}
        </div>

        <div style={styles.nextHint}>
          {isLastSentence ? "🏆 Calculating final results…" : "⏭ Next sentence coming up…"}
        </div>
      </div>
    );
  }

  // ── Active Review + Voting ──────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.sentenceCounter}>
          Story {sentenceIndex + 1} / {totalSentences}
        </div>
        <CountdownRing
          duration={reviewDuration}
          onExpire={() => setVotingExpired(true)}
        />
      </div>

      {/* The sentence itself */}
      <div style={styles.sentenceCard}>
        {!sentenceVisible ? (
          <div style={styles.drumroll}>🥁 …</div>
        ) : (
          <>
            <div style={{ color: "#aaa", fontSize: "0.7rem", marginBottom: "0.75rem", letterSpacing: "0.12em" }}>
              {phaseLabels.join("  ·  ")}
            </div>
            <div style={styles.sentenceRow}>
              {sentence.map((frag, i) => (
                <SentenceFragment key={i} text={frag} index={i} visible={sentenceVisible} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Voting area */}
      <div style={styles.voteArea}>
        {votingClosed ? (
          <div style={styles.voteConfirm}>
            {selectedStars
              ? `You voted ${"⭐".repeat(selectedStars)} — waiting for others…`
              : "Time's up! Tallying votes…"}
          </div>
        ) : (
          <>
            <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              Rate this story:
            </div>
            <div style={styles.starsRow}>
              {[1, 2, 3].map((s) => (
                <StarButton
                  key={s}
                  value={s}
                  selected={selectedStars === s}
                  disabled={!!selectedStars}
                  onClick={handleVote}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Waiting indicator */}
      {sentenceVisible && (
        <div style={styles.waitingPips}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.pip,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pipBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
    padding: "1.5rem 1rem",
    width: "100%",
    maxWidth: "560px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sentenceCounter: {
    fontFamily: "'Bangers', cursive",
    fontSize: "1.1rem",
    letterSpacing: "0.08em",
    color: "#aaa",
  },
  sentenceCard: {
    background: "#fdf6e3",
    border: "2px solid #d4b896",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    padding: "1.5rem",
    width: "100%",
    minHeight: "100px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transform: "rotate(-0.4deg)",
  },
  sentenceRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.2rem",
    textAlign: "center",
  },
  drumroll: {
    fontFamily: "'Bangers', cursive",
    fontSize: "2rem",
    color: "#888",
    letterSpacing: "0.1em",
    padding: "1rem",
  },
  voteArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "#16213e",
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    width: "100%",
    minHeight: "80px",
    justifyContent: "center",
  },
  starsRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  voteConfirm: {
    color: "#2ecc71",
    fontFamily: "'Permanent Marker', cursive",
    fontSize: "1rem",
    textAlign: "center",
  },
  voteSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    width: "100%",
    background: "#16213e",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  commentaryBanner: {
    background: "linear-gradient(135deg, #c0392b, #922b21)",
    borderRadius: "10px",
    padding: "1rem 1.5rem",
    width: "100%",
    textAlign: "center",
  },
  commentaryText: {
    fontFamily: "'Permanent Marker', cursive",
    fontSize: "clamp(0.9rem, 3.5vw, 1.15rem)",
    color: "#fff",
    lineHeight: 1.4,
  },
  leaderboard: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    width: "100%",
  },
  nextHint: {
    color: "#aaa",
    fontSize: "0.8rem",
    fontStyle: "italic",
  },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
  },
  waitingPips: {
    display: "flex",
    gap: "0.5rem",
  },
  pip: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#555",
    animation: "pipBounce 1.2s ease-in-out infinite",
  },
};
