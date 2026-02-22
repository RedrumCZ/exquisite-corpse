// app/game/page.js — Full game screen. Handles all phases.
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "../hooks/useGameSocket";
import ReviewPhase from "../components/ReviewPhase";
import RansomNote from "../components/RansomNote";

export default function GamePage() {
  const router = useRouter();
  const game = useGameSocket();

  useEffect(() => {
    const stored = sessionStorage.getItem("exquisite_roomCode");
    if (!game.roomCode && !stored) router.replace("/");
  }, [game.roomCode]);

  if (!game.connected) return <Screen><Spinner label="Connecting…" /></Screen>;
  if (!game.roomState) return <Screen><Spinner label="Loading room…" /></Screen>;

  const { roomState, isHost, playerId } = game;

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (roomState.phase === "lobby") {
    return (
      <Screen>
        <p style={styles.langBadge}>
          {roomState.lang === "cs" ? "🇨🇿 Čeština" : "🇬🇧 English"}
        </p>
        <div style={styles.roomCode}>{roomState.code}</div>
        <p style={styles.hint}>Share this code with your friends 📱</p>

        <div style={styles.playerList}>
          {roomState.players.map((p) => (
            <div key={p.id} style={styles.playerChip}>
              {p.disconnected ? "👻" : "🟢"} {p.name}
              {roomState.hostId === p.id ? " 👑" : ""}
            </div>
          ))}
        </div>

        {isHost ? (
          <>
            <button
              style={roomState.players.length < 2 ? styles.btnDisabled : styles.btn}
              disabled={roomState.players.length < 2}
              onClick={() => game.startGame().catch(console.error)}
            >
              {roomState.players.length < 2
                ? `Waiting for players… (${roomState.players.length}/2 min)`
                : "🚀 Start Game"}
            </button>
            {roomState.players.length < 2 && (
              <p style={styles.hint}>Need at least 2 players to start.</p>
            )}
          </>
        ) : (
          <p style={styles.hint}>⏳ Waiting for host to start…</p>
        )}
      </Screen>
    );
  }

  // ── INPUT PHASE ────────────────────────────────────────────────────────────
  if (roomState.phase === "input") {
    return (
      <InputPhaseScreen
        roomState={roomState}
        alreadyAnswered={game.alreadyAnswered}
        onSubmit={(a) => game.submitAnswer(a)}
      />
    );
  }

  // ── REVIEW ─────────────────────────────────────────────────────────────────
  if (roomState.phase === "review" || roomState.phase === "roundResults") {
    return (
      <Screen>
        <ReviewPhase
          reviewSentence={game.reviewSentence}
          roundResults={game.roundResults}
          alreadyVoted={game.alreadyVoted}
          playerId={playerId}
          onVote={(stars) => game.submitVote(stars).catch(console.error)}
        />
      </Screen>
    );
  }

  // ── FINAL RESULTS ──────────────────────────────────────────────────────────
  if (roomState.phase === "finalResults" && game.finalResults) {
    return (
      <FinalResultsScreen
        finalResults={game.finalResults}
        playerId={playerId}
        onHome={() => {
          sessionStorage.clear();
          router.replace("/");
        }}
      />
    );
  }

  return <Screen><Spinner label="Loading…" /></Screen>;
}

// ─── Input Phase Screen ───────────────────────────────────────────────────────

function InputPhaseScreen({ roomState, alreadyAnswered, onSubmit }) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadyAnswered);
  const textRef = useRef(null);

  useEffect(() => {
    setAnswer("");
    setSubmitting(false);
    setSubmitted(alreadyAnswered);
    if (!alreadyAnswered) textRef.current?.focus();
  }, [roomState.currentPhaseIndex, alreadyAnswered]);

  async function handleSubmit() {
    if (!answer.trim() || submitted) return;
    setSubmitting(true);
    try {
      await onSubmit(answer.trim());
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  }

  const answeredCount = roomState.players.filter((p) => p.answeredCurrentPhase).length;
  const activeCount = roomState.players.filter((p) => !p.disconnected).length;

  return (
    <Screen>
      {/* Progress dots */}
      <div style={styles.progressDots}>
        {Array.from({ length: roomState.totalPhases }).map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.dot,
              background:
                i < roomState.currentPhaseIndex
                  ? "#2ecc71"
                  : i === roomState.currentPhaseIndex
                  ? "#e74c3c"
                  : "#333",
            }}
          />
        ))}
      </div>

      <p style={styles.phaseCounter}>
        Question {roomState.currentPhaseIndex + 1} of {roomState.totalPhases}
      </p>

      <div style={styles.phaseLabel}>{roomState.phaseLabel}</div>

      <p style={styles.privacyNote}>
        🔒 Your answer is hidden from everyone else
      </p>

      {!submitted ? (
        <>
          <textarea
            ref={textRef}
            style={styles.textarea}
            placeholder="Type your answer…"
            value={answer}
            maxLength={280}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <p style={{ ...styles.hint, alignSelf: "flex-end", marginRight: "0.5rem" }}>
            {answer.length}/280
          </p>
          <button
            style={!answer.trim() || submitting ? styles.btnDisabled : styles.btn}
            disabled={!answer.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Locking in…" : "🔒 Lock In Answer"}
          </button>
        </>
      ) : (
        <div style={styles.waitingCard}>
          <div style={{ fontSize: "3rem" }}>✅</div>
          <p style={{ margin: "0.5rem 0 0", fontWeight: "bold" }}>Answer locked!</p>
          <p style={styles.hint}>
            Waiting for {activeCount - answeredCount} more player
            {activeCount - answeredCount !== 1 ? "s" : ""}…
          </p>
          <div style={styles.playerList}>
            {roomState.players.map((p) => (
              <div key={p.id} style={styles.playerChip}>
                {p.disconnected ? "👻" : p.answeredCurrentPhase ? "✅" : "⏳"} {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}

// ─── Final Results Screen ─────────────────────────────────────────────────────

function FinalResultsScreen({ finalResults, playerId, onHome }) {
  const { leaderboard, allSentences, phaseLabels, lang } = finalResults;
  const [showSentences, setShowSentences] = useState(false);

  const winnerName = leaderboard[0]?.name;
  const isWinner = leaderboard[0]?.id === playerId;

  return (
    <Screen>
      {/* Winner banner */}
      <div style={styles.winnerBanner}>
        <div style={{ fontSize: "3.5rem" }}>🏆</div>
        <div style={styles.winnerName}>{winnerName}</div>
        <div style={{ color: "#f39c12", fontSize: "0.85rem" }}>
          {isWinner ? "That's you! 🎉" : "wins this round!"}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={styles.sectionLabel}>FINAL LEADERBOARD</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {leaderboard.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: p.id === playerId ? "rgba(231,76,60,0.12)" : "rgba(255,255,255,0.04)",
                border: p.id === playerId ? "1px solid rgba(231,76,60,0.35)" : "1px solid #222",
                borderRadius: "10px", padding: "0.65rem 1rem",
              }}
            >
              <span style={{ fontSize: "1.4rem", width: "2rem", textAlign: "center" }}>
                {["🥇","🥈","🥉"][i] ?? `${i+1}.`}
              </span>
              <span style={{ flex: 1, color: p.id === playerId ? "#e74c3c" : "#eee" }}>
                {p.name} {p.id === playerId ? "(you)" : ""}
              </span>
              <span style={{ fontFamily: "'Bangers', cursive", fontSize: "1.3rem", color: "#f39c12" }}>
                {p.score.toFixed(1)} ⭐
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* All sentences as Ransom Notes */}
      <button
        style={styles.btnSecondary}
        onClick={() => setShowSentences((v) => !v)}
      >
        {showSentences ? "▲ Hide stories" : "📖 Show all stories"}
      </button>

      {showSentences && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%", maxWidth: "560px" }}>
          {allSentences.map((sentence, i) => (
            <RansomNote
              key={i}
              sentence={sentence}
              phaseLabels={phaseLabels}
              lang={lang}
            />
          ))}
        </div>
      )}

      <button style={styles.btn} onClick={onHome}>
        🏠 Back to Home
      </button>
    </Screen>
  );
}

// ─── Shared Layout ────────────────────────────────────────────────────────────

function Screen({ children }) {
  return (
    <main style={styles.main}>
      {children}
    </main>
  );
}

function Spinner({ label }) {
  return (
    <div style={{ textAlign: "center", color: "#aaa" }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
      <p>{label}</p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "2rem 1rem 4rem",
    gap: "1.25rem",
  },
  langBadge: {
    margin: 0,
    color: "#aaa",
    fontSize: "0.8rem",
    background: "#16213e",
    padding: "0.3rem 0.75rem",
    borderRadius: "999px",
  },
  roomCode: {
    fontFamily: "'Bangers', cursive",
    fontSize: "clamp(3.5rem, 16vw, 5rem)",
    letterSpacing: "0.4em",
    color: "#e74c3c",
    lineHeight: 1,
  },
  hint: { color: "#aaa", fontSize: "0.82rem", margin: 0 },
  phaseCounter: { color: "#aaa", fontSize: "0.82rem", margin: 0 },
  phaseLabel: {
    fontFamily: "'Bangers', cursive",
    fontSize: "clamp(2.2rem, 10vw, 3.2rem)",
    letterSpacing: "0.05em",
    color: "#f39c12",
    textAlign: "center",
    lineHeight: 1.1,
    maxWidth: "480px",
  },
  privacyNote: {
    color: "#888",
    fontSize: "0.75rem",
    margin: 0,
    fontStyle: "italic",
  },
  textarea: {
    width: "100%",
    maxWidth: "480px",
    minHeight: "110px",
    padding: "1rem",
    borderRadius: "10px",
    border: "2px solid #0f3460",
    background: "#16213e",
    color: "#eee",
    fontSize: "1rem",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: 1.5,
  },
  btn: {
    background: "#e74c3c",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "0.9rem 2rem",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    maxWidth: "480px",
  },
  btnSecondary: {
    background: "#16213e",
    color: "#eee",
    border: "1px solid #0f3460",
    borderRadius: "10px",
    padding: "0.75rem 2rem",
    fontSize: "0.95rem",
    cursor: "pointer",
    width: "100%",
    maxWidth: "480px",
  },
  btnDisabled: {
    background: "#2a2a2a",
    color: "#555",
    border: "none",
    borderRadius: "10px",
    padding: "0.9rem 2rem",
    fontSize: "1rem",
    cursor: "not-allowed",
    width: "100%",
    maxWidth: "480px",
  },
  playerList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    justifyContent: "center",
    width: "100%",
    maxWidth: "480px",
  },
  playerChip: {
    background: "#16213e",
    border: "1px solid #0f3460",
    borderRadius: "999px",
    padding: "0.35rem 0.9rem",
    fontSize: "0.85rem",
  },
  waitingCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.6rem",
    background: "#16213e",
    borderRadius: "12px",
    padding: "1.5rem",
    width: "100%",
    maxWidth: "480px",
  },
  progressDots: {
    display: "flex",
    gap: "0.4rem",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    transition: "background 0.3s",
  },
  winnerBanner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.3rem",
    background: "linear-gradient(135deg, #1a1a2e, #16213e)",
    border: "2px solid #f39c12",
    borderRadius: "16px",
    padding: "1.5rem 2rem",
    width: "100%",
    maxWidth: "480px",
  },
  winnerName: {
    fontFamily: "'Bangers', cursive",
    fontSize: "clamp(1.8rem, 8vw, 2.8rem)",
    color: "#f39c12",
    letterSpacing: "0.05em",
  },
  sectionLabel: {
    color: "#555",
    fontSize: "0.7rem",
    letterSpacing: "0.12em",
    marginBottom: "0.6rem",
  },
};
