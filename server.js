// server.js — Full game state machine with Review + Voting loop.
// Run with: node server.js
// Requires: npm install express socket.io

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { gameConfig, pickCommentary, pickTeaser } from "./gameConfig.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
const MAX_PLAYERS = 10;
const PHASE_TIMEOUT_MS = 90_000;   // 90s max per input phase
const REVIEW_DURATION_MS = 20_000; // 20s review window per sentence
const RESULTS_PAUSE_MS = 5_000;    // 5s to show round results before next sentence
const DRUMROLL_MS = 2_500;         // pause before revealing sentence text

// ─── In-Memory State ──────────────────────────────────────────────────────────
//
// Room shape:
// {
//   code: string,
//   lang: "cs" | "en",
//   hostId: string,
//   phase: "lobby" | "input" | "review" | "roundResults" | "finalResults",
//   currentPhaseIndex: number,       // during "input" — which question we're on
//   currentSentenceIndex: number,    // during "review" — which sentence is showing
//   players: Map<playerId, PlayerObj>,
//   phaseAnswers: Map<playerId, string>,  // current input phase answers
//   votes: Map<playerId, number>,         // 1-3 stars for current sentence
//   scores: Map<playerId, number>,        // accumulated stars across all sentences
//   finalSentences: string[][],           // assembled after input completes
//   activeTimer: NodeJS.Timeout | null,
// }
//
// PlayerObj shape:
// { id, name, socketId, answers: string[], disconnected: bool }

const rooms = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function pickFallback(lang, phaseIndex) {
  const list = gameConfig[lang].fallbacks[phaseIndex];
  return list[Math.floor(Math.random() * list.length)];
}

function clearRoomTimer(room) {
  if (room.activeTimer) {
    clearTimeout(room.activeTimer);
    room.activeTimer = null;
  }
}

// Serialise room state for broadcast — never expose raw Maps to clients.
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
    phaseLabel:
      room.phase === "input"
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

// ─── Exquisite Corpse Shuffle ─────────────────────────────────────────────────
// Sentence[i] uses phase[j] from player[(i+j) % N]
// → no sentence contains two fragments from the same player.

function assembleSentences(room) {
  const playerList = Array.from(room.players.values());
  const N = playerList.length;
  const phaseCount = gameConfig[room.lang].phases.length;

  return playerList.map((_, sentenceIndex) =>
    Array.from({ length: phaseCount }, (__, phaseIndex) => {
      const sourcePlayerIndex = (sentenceIndex + phaseIndex) % N;
      return playerList[sourcePlayerIndex].answers[phaseIndex];
    })
  );
}

// ─── Phase Progression (Input) ───────────────────────────────────────────────

function checkPhaseCompletion(io, room) {
  const activePlayers = Array.from(room.players.values()).filter(
    (p) => !p.disconnected
  );
  const allAnswered = activePlayers.every((p) => room.phaseAnswers.has(p.id));
  if (allAnswered) advanceInputPhase(io, room.code);
}

function advanceInputPhase(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== "input") return;

  clearRoomTimer(room);

  const config = gameConfig[room.lang];
  const phaseIndex = room.currentPhaseIndex;

  // Materialise answers — pull fallbacks for absent/disconnected players
  for (const [playerId, player] of room.players) {
    const answer = room.phaseAnswers.get(playerId);
    player.answers[phaseIndex] = answer ?? pickFallback(room.lang, phaseIndex);
  }
  room.phaseAnswers.clear();

  const nextPhase = phaseIndex + 1;

  if (nextPhase >= config.phases.length) {
    // All input phases done — assemble sentences, kick off review loop
    room.finalSentences = assembleSentences(room);
    startReviewPhase(io, roomCode, 0);
  } else {
    room.currentPhaseIndex = nextPhase;
    broadcastRoomState(io, room);

    room.activeTimer = setTimeout(
      () => advanceInputPhase(io, roomCode),
      PHASE_TIMEOUT_MS
    );
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

  const sentence = room.finalSentences[sentenceIndex];
  const lang = room.lang;
  const phaseLabels = gameConfig[lang].phases;
  const teaser = pickTeaser(lang, 0); // could vary by sentence index

  broadcastRoomState(io, room);

  // Brief drumroll pause, then reveal the sentence text
  setTimeout(() => {
    io.to(roomCode).emit("review:sentence", {
      sentenceIndex,
      sentence,
      phaseLabels,
      teaser,
      reviewDuration: REVIEW_DURATION_MS,
      totalSentences: room.finalSentences.length,
    });
  }, DRUMROLL_MS);

  // Auto-close voting after REVIEW_DURATION_MS + drumroll
  room.activeTimer = setTimeout(
    () => closeVoting(io, roomCode),
    REVIEW_DURATION_MS + DRUMROLL_MS
  );
}

// ─── Voting Completion ────────────────────────────────────────────────────────

function checkVotingCompletion(io, room) {
  const activePlayers = Array.from(room.players.values()).filter(
    (p) => !p.disconnected
  );
  const allVoted = activePlayers.every((p) => room.votes.has(p.id));
  if (allVoted) closeVoting(io, room.code);
}

function closeVoting(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== "review") return;

  clearRoomTimer(room);

  const lang = room.lang;
  const votes = Array.from(room.votes.values());
  const totalVoters = votes.length || 1;
  const avgScore = votes.reduce((a, b) => a + b, 0) / totalVoters;
  const allVotesSame = new Set(votes).size === 1 && votes.length > 1;

  // Determine sentence "winner" — we credit the player whose answers
  // contributed most fragments (always 1+ regardless of N, but
  // for >3 players some sentences have more from one player).
  // Simple approach: tally accumulated star totals per player contribution.
  // For POC, just add avgScore to each contributing player's score.
  const sentence = room.finalSentences[room.currentSentenceIndex];
  const playerList = Array.from(room.players.values());
  const N = playerList.length;
  const phaseCount = gameConfig[lang].phases.length;
  const si = room.currentSentenceIndex;

  // Award points to each player proportional to how many fragments they
  // contributed to this sentence (they each contributed at least 1).
  const contributionMap = new Map(); // playerId → fragment count
  for (let phaseIndex = 0; phaseIndex < phaseCount; phaseIndex++) {
    const sourcePlayerIndex = (si + phaseIndex) % N;
    const pid = playerList[sourcePlayerIndex].id;
    contributionMap.set(pid, (contributionMap.get(pid) ?? 0) + 1);
  }

  for (const [pid, count] of contributionMap) {
    const share = (avgScore * count) / phaseCount;
    room.scores.set(pid, (room.scores.get(pid) ?? 0) + share);
  }

  // Build vote breakdown for broadcast
  const voteBreakdown = { 1: 0, 2: 0, 3: 0 };
  for (const v of votes) voteBreakdown[v] = (voteBreakdown[v] ?? 0) + 1;

  const commentary = pickCommentary(lang, avgScore, allVotesSame);

  room.phase = "roundResults";
  broadcastRoomState(io, room);

  // Broadcast the round result payload
  io.to(roomCode).emit("round:results", {
    sentenceIndex: room.currentSentenceIndex,
    sentence,
    phaseLabels: gameConfig[lang].phases,
    voteBreakdown,
    avgScore: Math.round(avgScore * 10) / 10,
    commentary,
    scores: Object.fromEntries(
      Array.from(room.players.values()).map((p) => [
        p.id,
        { name: p.name, score: Math.round((room.scores.get(p.id) ?? 0) * 10) / 10 },
      ])
    ),
    isLastSentence:
      room.currentSentenceIndex >= room.finalSentences.length - 1,
  });

  // Pause, then advance to next sentence or final results
  room.activeTimer = setTimeout(() => {
    const nextIndex = room.currentSentenceIndex + 1;
    if (nextIndex < room.finalSentences.length) {
      startReviewPhase(io, roomCode, nextIndex);
    } else {
      startFinalResults(io, roomCode);
    }
  }, RESULTS_PAUSE_MS);
}

// ─── Final Results ────────────────────────────────────────────────────────────

function startFinalResults(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  clearRoomTimer(room);
  room.phase = "finalResults";

  // Sort players by score descending
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

// ─── Socket.io Server ─────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      /\.vercel\.app$/,
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Create Room ────────────────────────────────────────────────────────────
  socket.on("room:create", ({ name, lang }, cb) => {
    if (!name?.trim() || !["cs", "en"].includes(lang)) {
      return cb({ error: "Invalid name or language." });
    }

    const code = generateRoomCode();
    const playerId = socket.id;

    const room = {
      code,
      lang,
      hostId: playerId,
      phase: "lobby",
      currentPhaseIndex: 0,
      currentSentenceIndex: 0,
      players: new Map([
        [playerId, { id: playerId, name: name.trim(), socketId: socket.id, answers: [], disconnected: false }],
      ]),
      phaseAnswers: new Map(),
      votes: new Map(),
      scores: new Map(),
      finalSentences: [],
      activeTimer: null,
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.playerId = playerId;
    socket.data.roomCode = code;

    cb({ code, playerId });
    broadcastRoomState(io, room);
  });

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on("room:join", ({ name, code, existingPlayerId }, cb) => {
    const upperCode = code?.toUpperCase();
    const room = rooms.get(upperCode);

    if (!room) return cb({ error: "Room not found." });

    // ── Reconnection ─────────────────────────────────────────────────────
    if (existingPlayerId && room.players.has(existingPlayerId)) {
      const player = room.players.get(existingPlayerId);
      player.socketId = socket.id;
      player.disconnected = false;

      socket.join(upperCode);
      socket.data.playerId = existingPlayerId;
      socket.data.roomCode = upperCode;

      cb({ playerId: existingPlayerId, reconnected: true });
      broadcastRoomState(io, room);

      // Re-send phase-specific state
      if (room.phase === "input") {
        socket.emit("phase:prompt", {
          phaseIndex: room.currentPhaseIndex,
          phaseLabel: gameConfig[room.lang].phases[room.currentPhaseIndex],
          alreadyAnswered: room.phaseAnswers.has(existingPlayerId),
        });
      }

      if (room.phase === "review") {
        const si = room.currentSentenceIndex;
        socket.emit("review:sentence", {
          sentenceIndex: si,
          sentence: room.finalSentences[si],
          phaseLabels: gameConfig[room.lang].phases,
          reviewDuration: REVIEW_DURATION_MS,
          totalSentences: room.finalSentences.length,
          alreadyVoted: room.votes.has(existingPlayerId),
        });
      }

      if (room.phase === "finalResults") {
        const leaderboard = Array.from(room.players.values())
          .map((p) => ({
            id: p.id,
            name: p.name,
            score: Math.round((room.scores.get(p.id) ?? 0) * 10) / 10,
          }))
          .sort((a, b) => b.score - a.score);

        socket.emit("game:finalResults", {
          leaderboard,
          allSentences: room.finalSentences,
          phaseLabels: gameConfig[room.lang].phases,
          lang: room.lang,
        });
      }

      // Re-check if we were waiting on this player to complete voting
      if (room.phase === "review") {
        checkVotingCompletion(io, room);
      }

      return;
    }

    // ── New player ───────────────────────────────────────────────────────
    if (room.phase !== "lobby") return cb({ error: "Game already in progress." });
    if (!name?.trim()) return cb({ error: "Name required." });
    if (room.players.size >= MAX_PLAYERS) return cb({ error: "Room is full (max 10)." });

    const playerId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    room.players.set(playerId, {
      id: playerId,
      name: name.trim(),
      socketId: socket.id,
      answers: [],
      disconnected: false,
    });

    socket.join(upperCode);
    socket.data.playerId = playerId;
    socket.data.roomCode = upperCode;

    cb({ playerId });
    broadcastRoomState(io, room);
  });

  // ── Start Game ─────────────────────────────────────────────────────────────
  socket.on("game:start", (_, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);

    if (!room) return cb?.({ error: "Room not found." });
    if (room.hostId !== playerId) return cb?.({ error: "Only host can start." });
    if (room.players.size < 2) return cb?.({ error: "Need at least 2 players." });
    if (room.phase !== "lobby") return cb?.({ error: "Already started." });

    room.phase = "input";
    room.currentPhaseIndex = 0;

    for (const player of room.players.values()) {
      player.answers = new Array(gameConfig[room.lang].phases.length).fill(null);
      room.scores.set(player.id, 0);
    }

    broadcastRoomState(io, room);

    room.activeTimer = setTimeout(
      () => advanceInputPhase(io, roomCode),
      PHASE_TIMEOUT_MS
    );

    cb?.({ ok: true });
  });

  // ── Submit Answer ──────────────────────────────────────────────────────────
  socket.on("phase:submit", ({ answer }, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);

    if (!room || room.phase !== "input") return cb?.({ error: "Not in input phase." });
    if (!playerId || !room.players.has(playerId)) return cb?.({ error: "Unknown player." });
    if (room.phaseAnswers.has(playerId)) return cb?.({ error: "Already submitted." });
    if (!answer?.trim()) return cb?.({ error: "Answer cannot be empty." });

    room.phaseAnswers.set(playerId, answer.trim().slice(0, 280));
    cb?.({ ok: true });

    broadcastRoomState(io, room);
    checkPhaseCompletion(io, room);
  });

  // ── Submit Vote ────────────────────────────────────────────────────────────
  socket.on("review:vote", ({ stars }, cb) => {
    const { playerId, roomCode } = socket.data;
    const room = rooms.get(roomCode);

    if (!room || room.phase !== "review") return cb?.({ error: "Not in review phase." });
    if (!playerId || !room.players.has(playerId)) return cb?.({ error: "Unknown player." });
    if (room.votes.has(playerId)) return cb?.({ error: "Already voted." });

    const sanitisedStars = Math.min(3, Math.max(1, Math.round(Number(stars))));
    if (isNaN(sanitisedStars)) return cb?.({ error: "Invalid vote." });

    room.votes.set(playerId, sanitisedStars);
    cb?.({ ok: true });

    broadcastRoomState(io, room); // updates votedCurrentSentence for all clients
    checkVotingCompletion(io, room);
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { playerId, roomCode } = socket.data;
    if (!playerId || !roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.disconnected = true;
    console.log(`[disconnect] ${player.name} (${playerId}) from room ${roomCode}`);

    broadcastRoomState(io, room);

    // Don't let a dropout freeze the game at any phase
    if (room.phase === "input") checkPhaseCompletion(io, room);
    if (room.phase === "review") checkVotingCompletion(io, room);

    // Clean up empty rooms after 5 minutes
    const anyoneOnline = Array.from(room.players.values()).some((p) => !p.disconnected);
    if (!anyoneOnline) {
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
  console.log(`🎲 Game server running on http://localhost:${PORT}`);
});
