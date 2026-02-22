// hooks/useGameSocket.js
"use client";

import { useEffect, useRef, useCallback, useReducer } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

const initialState = {
  connected:          false,
  error:              null,
  playerId:           null,
  roomCode:           null,
  isHost:             false,
  roomState:          null,
  currentPhaseLabel:  null,
  currentPhaseIndex:  null,
  totalPhases:        null,
  alreadyAnswered:    false,
  reviewSentence:     null,
  alreadyVoted:       false,
  roundResults:       null,
  finalResults:       null,
};

function reducer(state, action) {
  switch (action.type) {

    case "CONNECTED":    return { ...state, connected: true, error: null };
    case "DISCONNECTED": return { ...state, connected: false };
    case "ERROR":        return { ...state, error: action.payload };

    case "JOINED":
      return { ...state, playerId: action.payload.playerId, roomCode: action.payload.roomCode, error: null };

    case "ROOM_STATE": {
      const rs = action.payload;
      // Clear stale review data when entering a fresh review phase
      const enteringReview = rs.phase === "review" && state.roomState?.phase !== "review";
      return {
        ...state,
        roomState:         rs,
        isHost:            rs.hostId === state.playerId,
        currentPhaseIndex: rs.currentPhaseIndex ?? state.currentPhaseIndex,
        currentPhaseLabel: rs.phaseLabel         ?? state.currentPhaseLabel,
        totalPhases:       rs.totalPhases         ?? state.totalPhases,
        roundResults:      enteringReview ? null  : state.roundResults,
        alreadyVoted:      enteringReview ? false : state.alreadyVoted,
      };
    }

    case "PHASE_PROMPT":
      return {
        ...state,
        currentPhaseIndex: action.payload.phaseIndex,
        currentPhaseLabel: action.payload.phaseLabel,
        alreadyAnswered:   action.payload.alreadyAnswered ?? false,
      };

    case "ANSWER_SUBMITTED": return { ...state, alreadyAnswered: true };

    case "REVIEW_SENTENCE":
      return {
        ...state,
        reviewSentence: action.payload,
        alreadyVoted:   action.payload.alreadyVoted ?? false,
        roundResults:   null,
      };

    case "VOTE_SUBMITTED": return { ...state, alreadyVoted: true };

    case "ROUND_RESULTS":  return { ...state, roundResults: action.payload };

    case "FINAL_RESULTS":  return { ...state, finalResults: action.payload };

    case "RESET_ANSWER":   return { ...state, alreadyAnswered: false };

    // Game restarted — wipe all game-specific state, keep identity + connection
    case "GAME_RESTARTED":
      return {
        ...state,
        currentPhaseLabel:  null,
        currentPhaseIndex:  null,
        totalPhases:        null,
        alreadyAnswered:    false,
        reviewSentence:     null,
        alreadyVoted:       false,
        roundResults:       null,
        finalResults:       null,
      };

    default: return state;
  }
}

export function useGameSocket() {
  const socketRef = useRef(null);
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 15,
      reconnectionDelay: 1500,
      transports: ["websocket"],
      upgrade: false,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      dispatch({ type: "CONNECTED" });

      // Silent reconnection
      const pid  = sessionStorage.getItem("exquisite_playerId");
      const code = sessionStorage.getItem("exquisite_roomCode");
      const name = sessionStorage.getItem("exquisite_name");
      if (pid && code && name) {
        socket.emit("room:join", { name, code, existingPlayerId: pid }, (res) => {
          if (res.error) {
            sessionStorage.removeItem("exquisite_playerId");
            sessionStorage.removeItem("exquisite_roomCode");
            sessionStorage.removeItem("exquisite_name");
          } else {
            dispatch({ type: "JOINED", payload: { playerId: pid, roomCode: code } });
          }
        });
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error", err.message);
      dispatch({ type: "ERROR", payload: "Connection failed — retrying…" });
    });

    socket.on("disconnect", (reason) => {
      console.warn("[socket] disconnect", reason);
      dispatch({ type: "DISCONNECTED" });
    });

    socket.on("room:state",        (d) => dispatch({ type: "ROOM_STATE",      payload: d }));
    socket.on("phase:prompt",      (d) => { dispatch({ type: "PHASE_PROMPT",  payload: d }); dispatch({ type: "RESET_ANSWER" }); });
    socket.on("review:sentence",   (d) => dispatch({ type: "REVIEW_SENTENCE", payload: d }));
    socket.on("round:results",     (d) => dispatch({ type: "ROUND_RESULTS",   payload: d }));
    socket.on("game:finalResults", (d) => dispatch({ type: "FINAL_RESULTS",  payload: d }));
    socket.on("game:restarted",    ()  => dispatch({ type: "GAME_RESTARTED" }));

    socket.connect();
    return () => socket.disconnect();
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const createRoom = useCallback((name, lang) =>
    new Promise((resolve, reject) => {
      socketRef.current.emit("room:create", { name, lang }, (res) => {
        if (res.error) return reject(new Error(res.error));
        sessionStorage.setItem("exquisite_playerId", res.playerId);
        sessionStorage.setItem("exquisite_roomCode", res.code);
        sessionStorage.setItem("exquisite_name", name);
        dispatch({ type: "JOINED", payload: { playerId: res.playerId, roomCode: res.code } });
        resolve(res);
      });
    }), []);

  const joinRoom = useCallback((name, code) =>
    new Promise((resolve, reject) => {
      socketRef.current.emit("room:join", { name, code }, (res) => {
        if (res.error) return reject(new Error(res.error));
        sessionStorage.setItem("exquisite_playerId", res.playerId);
        sessionStorage.setItem("exquisite_roomCode", code.toUpperCase());
        sessionStorage.setItem("exquisite_name", name);
        dispatch({ type: "JOINED", payload: { playerId: res.playerId, roomCode: code.toUpperCase() } });
        resolve(res);
      });
    }), []);

  const startGame = useCallback(() =>
    new Promise((resolve, reject) => {
      socketRef.current.emit("game:start", null, (res) => {
        if (res?.error) return reject(new Error(res.error));
        resolve(res);
      });
    }), []);

  const restartGame = useCallback(() =>
    new Promise((resolve, reject) => {
      socketRef.current.emit("game:restart", null, (res) => {
        if (res?.error) return reject(new Error(res.error));
        resolve(res);
      });
    }), []);

  const submitAnswer = useCallback((answer) =>
    new Promise((resolve, reject) => {
      socketRef.current.emit("phase:submit", { answer }, (res) => {
        if (res?.error) return reject(new Error(res.error));
        dispatch({ type: "ANSWER_SUBMITTED" });
        resolve(res);
      });
    }), []);

  const submitVote = useCallback((stars) =>
    new Promise((resolve, reject) => {
      socketRef.current.emit("review:vote", { stars }, (res) => {
        if (res?.error) return reject(new Error(res.error));
        dispatch({ type: "VOTE_SUBMITTED" });
        resolve(res);
      });
    }), []);

  return { ...state, createRoom, joinRoom, startGame, restartGame, submitAnswer, submitVote };
}
