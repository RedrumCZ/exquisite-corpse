// app/game/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGameSocket } from "../hooks/useGameSocket";
import { GAME_LABELS } from "../lib/labels";
import ReviewPhase from "../components/ReviewPhase";
import RansomNote from "../components/RansomNote";

export default function GamePage() {
  const router = useRouter();
  const game   = useGameSocket();

  // Redirect home if no session and no room in state
  useEffect(() => {
    const stored = sessionStorage.getItem("exquisite_roomCode");
    if (!game.roomCode && !stored) router.replace("/");
  }, [game.roomCode]);

  // When game:restarted fires, the roomState phase becomes "lobby"
  // — no extra routing needed; the phase switch below handles it.

  if (!game.connected)  return <Screen><Spinner lang="en" /></Screen>;
  if (!game.roomState)  return <Screen><Spinner lang="en" /></Screen>;

  const { roomState, isHost, playerId } = game;
  const lang = roomState.lang ?? "en";
  const t    = GAME_LABELS[lang] ?? GAME_LABELS.en;

  // ── LOBBY ────────────────────────────────────────────────────────────────
  if (roomState.phase === "lobby") {
    return (
      <Screen>
        <p style={st.langBadge}>{t.lang}</p>
        <div style={st.roomCode}>{roomState.code}</div>
        <p style={st.hint}>{t.shareCode}</p>

        <PlayerList players={roomState.players} hostId={roomState.hostId} />

        {isHost ? (
          <>
            <button
              style={roomState.players.length < 2 ? st.btnDisabled : st.btn}
              disabled={roomState.players.length < 2}
              onClick={() => game.startGame().catch(console.error)}
            >
              {roomState.players.length < 2
                ? t.waitingPlayers(roomState.players.length)
                : t.startGame}
            </button>
            {roomState.players.length < 2 && <p style={st.hint}>{t.needTwoPlayers}</p>}
          </>
        ) : (
          <p style={st.hint}>{t.waitingForHost}</p>
        )}
      </Screen>
    );
  }

  // ── INPUT PHASE ──────────────────────────────────────────────────────────
  if (roomState.phase === "input") {
    return (
      <InputPhaseScreen
        roomState={roomState}
        lang={lang}
        alreadyAnswered={game.alreadyAnswered}
        onSubmit={(a) => game.submitAnswer(a)}
      />
    );
  }

  // ── REVIEW / ROUND RESULTS ───────────────────────────────────────────────
  if (roomState.phase === "review" || roomState.phase === "roundResults") {
    return (
      <Screen>
        <ReviewPhase
          reviewSentence={game.reviewSentence}
          roundResults={game.roundResults}
          alreadyVoted={game.alreadyVoted}
          playerId={playerId}
          lang={lang}
          onVote={(stars) => game.submitVote(stars).catch(console.error)}
        />
      </Screen>
    );
  }

  // ── FINAL RESULTS ────────────────────────────────────────────────────────
  if (roomState.phase === "finalResults" && game.finalResults) {
    return (
      <FinalResultsScreen
        finalResults={game.finalResults}
        playerId={playerId}
        isHost={isHost}
        lang={lang}
        onRestart={() => game.restartGame().catch(console.error)}
        onHome={() => { sessionStorage.clear(); router.replace("/"); }}
      />
    );
  }

  return <Screen><Spinner lang={lang} /></Screen>;
}

// ─── Input Phase Screen ───────────────────────────────────────────────────────

function InputPhaseScreen({ roomState, lang, alreadyAnswered, onSubmit }) {
  const t = GAME_LABELS[lang] ?? GAME_LABELS.en;
  const [answer,    setAnswer]    = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [submitted, setSubmitted]  = useState(alreadyAnswered);
  const textRef = useRef(null);

  useEffect(() => {
    setAnswer("");
    setSubmitting(false);
    setSubmitted(alreadyAnswered);
    if (!alreadyAnswered) setTimeout(() => textRef.current?.focus(), 100);
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
  const activeCount   = roomState.players.filter((p) => !p.disconnected).length;
  const waitingFor    = activeCount - answeredCount;

  return (
    <Screen>
      {/* Progress dots */}
      <div style={st.progressDots}>
        {Array.from({ length: roomState.totalPhases }).map((_, i) => (
          <div key={i} style={{
            ...st.dot,
            background: i < roomState.currentPhaseIndex ? "#2ecc71"
              : i === roomState.currentPhaseIndex ? "#e74c3c" : "#333",
          }} />
        ))}
      </div>

      <p style={st.phaseCounter}>{t.question(roomState.currentPhaseIndex + 1, roomState.totalPhases)}</p>
      <div style={st.phaseLabel}>{roomState.phaseLabel}</div>
      <p style={st.hiddenHint}>{t.hiddenHint}</p>

      {!submitted ? (
        <>
          <textarea
            ref={textRef}
            style={st.textarea}
            placeholder={t.answerPlaceholder}
            value={answer}
            maxLength={280}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <p style={{ ...st.hint, alignSelf: "flex-end", marginRight: "0.25rem" }}>
            {answer.length}/280
          </p>
          <button
            style={!answer.trim() || submitting ? st.btnDisabled : st.btn}
            disabled={!answer.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? t.lockingIn : t.lockIn}
          </button>
        </>
      ) : (
        <div style={st.waitingCard}>
          <div style={{ fontSize: "3rem" }}>✅</div>
          <p style={{ margin: "0.5rem 0 0", fontWeight: "bold" }}>{t.answerLocked}</p>
          <p style={st.hint}>{t.waitingFor(waitingFor)}</p>
          <PlayerList players={roomState.players} showAnswered />
        </div>
      )}
    </Screen>
  );
}

// ─── Final Results Screen ─────────────────────────────────────────────────────

function FinalResultsScreen({ finalResults, playerId, isHost, lang, onRestart, onHome }) {
  const t = GAME_LABELS[lang] ?? GAME_LABELS.en;
  const { leaderboard, allSentences, phaseLabels } = finalResults;
  const [showStories, setShowStories] = useState(false);

  const winner   = leaderboard[0];
  const isWinner = winner?.id === playerId;
  const medals   = ["🥇","🥈","🥉"];

  return (
    <Screen>
      {/* Winner banner */}
      <div style={st.winnerBanner}>
        <div style={{ fontSize: "3.5rem" }}>🏆</div>
        <div style={st.winnerName}>{winner?.name}</div>
        <div style={{ color: "#f39c12", fontSize: "0.9rem" }}>
          {isWinner ? t.thatsYou : t.winner}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <div style={st.sectionLabel}>{t.finalLeaderboard}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {leaderboard.map((p, i) => {
            const isMe = p.id === playerId;
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: isMe ? "rgba(231,76,60,0.12)" : "rgba(255,255,255,0.04)",
                border: isMe ? "1px solid rgba(231,76,60,0.35)" : "1px solid #222",
                borderRadius: "10px", padding: "0.65rem 1rem",
              }}>
                <span style={{ fontSize: "1.4rem", width: "2rem", textAlign: "center" }}>{medals[i] ?? `${i+1}.`}</span>
                <span style={{ flex: 1, color: isMe ? "#e74c3c" : "#eee" }}>
                  {p.name}{isMe ? ` ${t.you}` : ""}
                </span>
                <span style={{ fontFamily: "'Bangers',cursive", fontSize: "1.3rem", color: "#f39c12" }}>
                  {p.score.toFixed(1)} ⭐
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show/hide all stories */}
      <button style={st.btnSecondary} onClick={() => setShowStories((v) => !v)}>
        {showStories ? t.hideStories : t.showStories}
      </button>

      {showStories && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%", maxWidth: "560px" }}>
          {allSentences.map((sentence, i) => (
            <RansomNote key={i} sentence={sentence} phaseLabels={phaseLabels} lang={lang} />
          ))}
        </div>
      )}

      {/* Next Round — host only */}
      {isHost && (
        <button style={st.btn} onClick={onRestart}>
          {t.playAgain}
        </button>
      )}
      {!isHost && (
        <p style={st.hint}>⏳ {lang === "cs" ? "Čekáme na hostitele…" : "Waiting for host to start next round…"}</p>
      )}

      <button style={st.btnSecondary} onClick={onHome}>
        {t.backHome}
      </button>
    </Screen>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Screen({ children }) {
  return (
    <main style={st.main}>{children}</main>
  );
}

function Spinner({ lang }) {
  const t = GAME_LABELS[lang] ?? GAME_LABELS.en;
  return (
    <div style={{ textAlign: "center", color: "#aaa" }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
      <p>{t.loadingRoom}</p>
    </div>
  );
}

function PlayerList({ players, hostId, showAnswered }) {
  return (
    <div style={st.playerList}>
      {players.map((p) => (
        <div key={p.id} style={st.playerChip}>
          {p.disconnected ? "👻"
            : showAnswered ? (p.answeredCurrentPhase ? "✅" : "⏳")
            : "🟢"}
          {" "}{p.name}
          {hostId && p.id === hostId ? " 👑" : ""}
        </div>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  main: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start",
    padding: "2rem 1rem 4rem", gap: "1.25rem",
  },
  langBadge: { margin: 0, color: "#aaa", fontSize: "0.8rem", background: "#16213e", padding: "0.3rem 0.75rem", borderRadius: "999px" },
  roomCode: { fontFamily: "'Bangers',cursive", fontSize: "clamp(3.5rem,16vw,5rem)", letterSpacing: "0.4em", color: "#e74c3c", lineHeight: 1 },
  hint: { color: "#aaa", fontSize: "0.82rem", margin: 0 },
  hiddenHint: { color: "#888", fontSize: "0.75rem", margin: 0, fontStyle: "italic" },
  phaseCounter: { color: "#aaa", fontSize: "0.82rem", margin: 0 },
  phaseLabel: { fontFamily: "'Bangers',cursive", fontSize: "clamp(2.2rem,10vw,3.2rem)", letterSpacing: "0.05em", color: "#f39c12", textAlign: "center", lineHeight: 1.1, maxWidth: "480px" },
  textarea: { width: "100%", maxWidth: "480px", minHeight: "110px", padding: "1rem", borderRadius: "10px", border: "2px solid #0f3460", background: "#16213e", color: "#eee", fontSize: "1rem", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 },
  btn: { background: "#e74c3c", color: "#fff", border: "none", borderRadius: "10px", padding: "0.9rem 2rem", fontSize: "1rem", fontWeight: "bold", cursor: "pointer", width: "100%", maxWidth: "480px" },
  btnSecondary: { background: "#16213e", color: "#eee", border: "1px solid #0f3460", borderRadius: "10px", padding: "0.75rem 2rem", fontSize: "0.95rem", cursor: "pointer", width: "100%", maxWidth: "480px" },
  btnDisabled: { background: "#2a2a2a", color: "#555", border: "none", borderRadius: "10px", padding: "0.9rem 2rem", fontSize: "1rem", cursor: "not-allowed", width: "100%", maxWidth: "480px" },
  playerList: { display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", width: "100%", maxWidth: "480px" },
  playerChip: { background: "#16213e", border: "1px solid #0f3460", borderRadius: "999px", padding: "0.35rem 0.9rem", fontSize: "0.85rem" },
  waitingCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", background: "#16213e", borderRadius: "12px", padding: "1.5rem", width: "100%", maxWidth: "480px" },
  progressDots: { display: "flex", gap: "0.4rem" },
  dot: { width: "10px", height: "10px", borderRadius: "50%", transition: "background 0.3s" },
  winnerBanner: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", background: "linear-gradient(135deg,#1a1a2e,#16213e)", border: "2px solid #f39c12", borderRadius: "16px", padding: "1.5rem 2rem", width: "100%", maxWidth: "480px" },
  winnerName: { fontFamily: "'Bangers',cursive", fontSize: "clamp(1.8rem,8vw,2.8rem)", color: "#f39c12", letterSpacing: "0.05em" },
  sectionLabel: { color: "#555", fontSize: "0.7rem", letterSpacing: "0.12em", marginBottom: "0.6rem" },
};
