// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { gameConfig, pickCommentary, pickTeaser } from "./gameConfig.js";

const PORT               = process.env.PORT || 3001;
const MAX_PLAYERS        = 10;
const PHASE_TIMEOUT_MS   = 90_000;
const REVIEW_DURATION_MS = 20_000;
const RESULTS_PAUSE_MS   = 5_000;
const DRUMROLL_MS        = 2_500;

const rooms = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function pickFallback(lang, phaseIndex) {
  const list = gameConfig[lang].fallbacks[phaseIndex];
  return list[Math.floor(Math.random() * list.length)];
}

function clearRoomTimer(room) {
  if (room.activeTimer) { clearTimeout(room.activeTimer); room.activeTimer = null; }
}

function getRoomPayload(room) {
  const players = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    disconnected: p.disconnected,
    answeredCurrentPhase: room.phaseAnswers.has(p.id),
    votedCurrentSentence: room.votes.has(p.id),
    score: room.scores.get(p.id) ?? 0,
  }));
  return {
    code: room.code,
    lang: room.lang,
    phase: room.phase,
    currentPhaseIndex: room.currentPhaseIndex,
    currentSentenceIndex: room.currentSentenceIndex,
    phaseLabel: room.phase === "input"
      ? gameConfig[room.lang].phases[room.currentPhaseIndex]
      : null,
    totalPhases: gameConfig[room.lang].phases.length,
    totalSentences: room.finalSentences.length,
    hostId: room.hostId,
    players,
  };
}

function broadcastRoomState(io, room) {
  io.to(room.code).emit("room:state", getRoomPayload(room));
}

function assembleSentences(room) {
  const playerList = Array.from(room.players.values());
  const N = playerList.length;
  const phaseCount = gameConfig[room.lang].phases.length;
  return playerList.map((_, si) =>
    Array.from({ length: phaseCount }, (__, pi) => playerList[(si + pi) % N].answers[pi])
  );
}

// ─── Input Phase ─────────────────────────────────────────────────────────────

function checkPhaseCompletion(io, room) {
  const active = Array.from(room.players.values()).filter((p) => !p.disconnected);
  if (active.length > 0 && active.every((p) => room.phaseAnswers.has(p.id))) {
    advanceInputPhase(io, room.code);
  }
}

function advanceInputPhase(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== "input") return;
  clearRoomTimer(room);

  const pi = room.currentPhaseIndex;
  for (const [, player] of room.players) {
    player.answers[pi] = room.phaseAnswers.get(player.id) ?? pickFallback(room.lang, pi);
  }
  room.phaseAnswers.clear();

  const next = pi + 1;
  if (next >= gameConfig[room.lang].phases.length) {
    room.finalSentences = assembleSentences(room);
    startReviewPhase(io, roomCode, 0);
  } else {
    room.currentPhaseIndex = next;
    broadcastRoomState(io, room);
    room.activeTimer = setTimeout(() => advanceInputPhase(io, roomCode), PHASE_TIMEOUT_MS);
  }
}

// ─── Review Phase ─────────────────────────────────────────────────────────────

function startReviewPhase(io, roomCode, sentenceIndex) {
  const room = rooms.get(roomCode);
  if (!room) return;
  clearRoomTimer(room);

  room.phase = "review";
  room.currentSentenceIndex = sentenceIndex;
  room.votes.clear();

  // Broadcast state change FIRST so clients know to switch screens
  broadcastRoomState(io, room);

  // Then send the sentence content after drumroll pause
  setTimeout(() => {
    const r = rooms.get(roomCode);
    if (!r || r.phase !== "review") return; // guard — room may have gone away
    io.to(roomCode).emit("review:sentence", {
      sentenceIndex,
      sentence: r.finalSentences[sentenceIndex],
      phaseLabels: gameConfig[r.lang].phases,
      reviewDuration: REVIEW_DURATION_MS,
      totalSentences: r.finalSentences.length,
    });
  }, DRUMROLL_MS);

  room.activeTimer = setTimeout(() => closeVoting(io, roomCode), REVIEW_DURATION_MS + DRUMROLL_MS);
}

function checkVotingCompletion(io, room) {
  const active = Array.from(room.players.values()).filter((p) => !p.disconnected);
  if (active.length > 0 && active.every((p) => room.votes.has(p.id))) {
    closeVoting(io, room.code);
  }
}

function closeVoting(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== "review") return;
  clearRoomTimer(room);

  const lang   = room.lang;
  const votes  = Array.from(room.votes.values());
  const total  = votes.length || 1;
  const avg    = votes.reduce((a, b) => a + b, 0) / total;
  const allSame = new Set(votes).size === 1 && votes.length > 1;

  // Award proportional score per player contribution
  const playerList = Array.from(room.players.values());
  const N = playerList.length;
  const phaseCount = gameConfig[lang].phases.length;
  const si = room.currentSentenceIndex;

  const contrib = new Map();
  for (let pi = 0; pi < phaseCount; pi++) {
    const pid = playerList[(si + pi) % N].id;
    contrib.set(pid, (contrib.get(pid) ?? 0) + 1);
  }
  for (const [pid, count] of contrib) {
    const share = (avg * count) / phaseCount;
    room.scores.set(pid, (room.scores.get(pid) ?? 0) + share);
  }

  const breakdown = { 1: 0, 2: 0, 3: 0 };
  for (const v of votes) breakdown[v] = (breakdown[v] ?? 0) + 1;

  room.phase = "roundResults";
  broadcastRoomState(io, room);

  io.to(roomCode).emit("round:results", {
    sentenceIndex: si,
    sentence: room.finalSentences[si],
    phaseLabels: gameConfig[lang].phases,
    voteBreakdown: breakdown,
    avgScore: Math.round(avg * 10) / 10,
    commentary: pickCommentary(lang, avg, allSame),
    scores: Object.fromEntries(
      Array.from(room.players.values()).map((p) => [
        p.id,
        { name: p.name, score: Math.round((room.scores.get(p.id) ?? 0) * 10) / 10 },
      ])
    ),
    isLastSentence: si >= room.finalSentences.length - 1,
  });

  room.activeTimer = setTimeout(() => {
    const next = si + 1;
    if (next < room.finalSentences.length) startReviewPhase(io, roomCode, next);
    else startFinalResults(io, roomCode);
  }, RESULTS_PAUSE_MS);
}

// ─── Final Results ────────────────────────────────────────────────────────────

function startFinalResults(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  clearRoomTimer(room);
  room.phase = "finalResults";

  const leaderboard = Array.from(room.players.values())
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: Math.round((room.scores.get(p.id) ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score);

  broadcastRoomState(io, room);
  io.to(roomCode).emit("game:finalResults", {
    leaderboard,
    allSentences: room.finalSentences,
    phaseLabels: gameConfig[room.lang].phases,
    lang: room.lang,
  });
}

// ─── Game Restart (Next Round) ────────────────────────────────────────────────
// Resets all game state but keeps players connected in the same room.
// Host calls this. Emits room:state with phase="lobby" to all clients.

function resetRoomForNextRound(room) {
  clearRoomTimer(room);

  room.phase               = "lobby";
  room.currentPhaseIndex   = 0;
  room.currentSentenceIndex = 0;
  room.finalSentences      = [];
  room.phaseAnswers.clear();
  room.votes.clear();
  room.scores.clear();

  // Reset each player's answers and reconnect any dropped players
  for (const player of room.players.values()) {
    player.answers = [];
    // Keep disconnected flag as-is — they'll reconnect or not
  }
}

// ─── Express + Socket.io ──────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

app.get("/",       (_, res) => res.send("OK"));
app.get("/health", (_, res) => res.send("OK"));

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://exquisite-corpse-theta.vercel.app",
      /\.vercel\.app$/,
      /^http:\/\/192\.168\.\d+\.\d+/,
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on("room:create", ({ name, lang }, cb) => {
    if (!name?.trim() || !["cs", "en"].includes(lang)) {
      return cb({ error: "Invalid name or language." });
    }
    const code     = generateRoomCode();
    const playerId = socket.id;

    rooms.set(code, {
      code, lang, hostId: playerId,
      phase: "lobby", currentPhaseIndex: 0, currentSentenceIndex: 0,
      players: new Map([[playerId, {
        id: playerId, name: name.trim(),
        socketId: socket.id, answers: [], disconnected: false,
      }]]),
      phaseAnswers: new Map(), votes: new Map(), scores: new Map(),
      finalSentences: [], activeTimer: null,
    });

    socket.join(code);
    socket.data.playerId = playerId;
    socket.data.roomCode = code;
    cb({ code, playerId });
    broadcastRoomState(io, rooms.get(code));
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on("room:join", ({ name, code, existingPlayerId }, cb) => {
    const upper = code?.toUpperCase();
    const room  = rooms.get(upper);
    if (!room) return cb({ error: "Room not found." });

    // Reconnection
    if (existingPlayerId && room.players.has(existingPlayerId)) {
      const player = room.players.get(existingPlayerId);
      player.socketId    = socket.id;
      player.disconnected = false;
      socket.join(upper);
      socket.data.playerId = existingPlayerId;
      socket.data.roomCode = upper;
      cb({ playerId: existingPlayerId, reconnected: true });
      broadcastRoomState(io, room);

      if (room.phase === "input") {
        socket.emit("phase:prompt", {
          phaseIndex: room.currentPhaseIndex,
          phaseLabel: gameConfig[room.lang].phases[room.currentPhaseIndex],
          alreadyAnswered: room.phaseAnswers.has(existingPlayerId),
        });
      }
      if (room.phase === "review") {
        socket.emit("review:sentence", {
          sentenceIndex: room.currentSentenceIndex,
          sentence: room.finalSentences[room.currentSentenceIndex],
          phaseLabels: gameConfig[room.lang].phases,
          reviewDuration: REVIEW_DURATION_MS,
          totalSentences: room.finalSentences.length,
          alreadyVoted: room.votes.has(existingPlayerId),
        });
      }
      if (room.phase === "finalResults") {
        socket.emit("game:finalResults", {
          leaderboard: Array.from(room.players.values())
            .map((p) => ({ id: p.id, name: p.name, score: Math.round((room.scores.get(p.id) ?? 0) * 10) / 10 }))
            .sort((a, b) => b.score - a.score),
          allSentences: room.finalSentences,
          phaseLabels: gameConfig[room.lang].phases,
          lang: room.lang,
        });
      }
      if (room.phase === "review") checkVotingCompletion(io, room);
      return;
    }

    // New player
    if (room.phase !== "lobby") return cb({ error: "Game already in progress." });
    if (!name?.trim())          return cb({ error: "Name required." });
    if (room.players.size >= MAX_PLAYERS) return cb({ error: "Room is full (max 10)." });

    const playerId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    room.players.set(playerId, {
      id: playerId, name: name.trim(),
      socketId: socket.id, answers: [], disconnected: false,
    });
    socket.join(upper);
    socket.data.playerId = playerId;
    socket.data.roomCode = upper;
    cb({ playerId });
    broadcastRoomState(io, room);
  });

  // ── Start Game ───────────────────────────────────────────────────────────
  socket.on("game:start", (_, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);
    if (!room)                    return cb?.({ error: "Room not found." });
    if (room.hostId !== playerId) return cb?.({ error: "Only host can start." });
    if (room.players.size < 2)    return cb?.({ error: "Need at least 2 players." });
    if (room.phase !== "lobby")   return cb?.({ error: "Already started." });

    room.phase = "input";
    room.currentPhaseIndex = 0;
    for (const player of room.players.values()) {
      player.answers = new Array(gameConfig[room.lang].phases.length).fill(null);
      room.scores.set(player.id, 0);
    }
    broadcastRoomState(io, room);
    room.activeTimer = setTimeout(() => advanceInputPhase(io, roomCode), PHASE_TIMEOUT_MS);
    cb?.({ ok: true });
  });

  // ── Next Round ───────────────────────────────────────────────────────────
  // Resets game state, keeps all players. Host-only.
  socket.on("game:restart", (_, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);
    if (!room)                    return cb?.({ error: "Room not found." });
    if (room.hostId !== playerId) return cb?.({ error: "Only host can start a new round." });
    if (room.phase !== "finalResults") return cb?.({ error: "Can only restart after final results." });

    resetRoomForNextRound(room);
    broadcastRoomState(io, room);
    // Emit a dedicated event so non-host clients know to go to lobby
    io.to(roomCode).emit("game:restarted");
    cb?.({ ok: true });
  });

  // ── Submit Answer ────────────────────────────────────────────────────────
  socket.on("phase:submit", ({ answer }, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);
    if (!room || room.phase !== "input")          return cb?.({ error: "Not in input phase." });
    if (!playerId || !room.players.has(playerId)) return cb?.({ error: "Unknown player." });
    if (room.phaseAnswers.has(playerId))          return cb?.({ error: "Already submitted." });
    if (!answer?.trim())                          return cb?.({ error: "Answer cannot be empty." });

    room.phaseAnswers.set(playerId, answer.trim().slice(0, 280));
    cb?.({ ok: true });
    broadcastRoomState(io, room);
    checkPhaseCompletion(io, room);
  });

  // ── Submit Vote ──────────────────────────────────────────────────────────
  socket.on("review:vote", ({ stars }, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);
    if (!room || room.phase !== "review")         return cb?.({ error: "Not in review phase." });
    if (!playerId || !room.players.has(playerId)) return cb?.({ error: "Unknown player." });
    if (room.votes.has(playerId))                 return cb?.({ error: "Already voted." });

    const s = Math.min(3, Math.max(1, Math.round(Number(stars))));
    if (isNaN(s)) return cb?.({ error: "Invalid vote." });

    room.votes.set(playerId, s);
    cb?.({ ok: true });
    broadcastRoomState(io, room);
    checkVotingCompletion(io, room);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { playerId, roomCode } = socket.data;
    if (!playerId || !roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;

    player.disconnected = true;
    console.log(`[disconnect] ${player.name} from ${roomCode}`);
    broadcastRoomState(io, room);

    if (room.phase === "input")  checkPhaseCompletion(io, room);
    if (room.phase === "review") checkVotingCompletion(io, room);

    const anyOnline = Array.from(room.players.values()).some((p) => !p.disconnected);
    if (!anyOnline) {
      setTimeout(() => {
        const r = rooms.get(roomCode);
        if (r && Array.from(r.players.values()).every((p) => p.disconnected)) {
          clearRoomTimer(r);
          rooms.delete(roomCode);
          console.log(`[cleanup] Room ${roomCode} deleted.`);
        }
      }, 5 * 60 * 1000);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🎲 Game server running on port ${PORT}`);
});

// Keep-alive: prevents Render free tier from sleeping mid-game
setInterval(() => console.log("[keepalive]"), 14 * 60 * 1000);
