// hooks/useGameSocket.js
"use client";

import { useEffect, useRef, useCallback, useReducer } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

// ─── State ────────────────────────────────────────────────────────────────────

const initialState = {
  connected: false,
  error: null,

  // Identity
  playerId: null,
  roomCode: null,
  isHost: false,

  // Room
  roomState: null,

  // Input phase
  currentPhaseLabel: null,
  currentPhaseIndex: null,
  totalPhases: null,
  alreadyAnswered: false,

  // Review phase
  reviewSentence: null,        // { sentenceIndex, sentence, phaseLabels, reviewDuration, totalSentences }
  alreadyVoted: false,

  // Round results (shown briefly after each sentence's voting closes)
  roundResults: null,          // { voteBreakdown, avgScore, commentary, scores, isLastSentence }

  // Final results
  finalResults: null,          // { leaderboard, allSentences, phaseLabels, lang }
};

function reducer(state, action) {
  switch (action.type) {
    case "CONNECTED":
      return { ...state, connected: true, error: null };
    case "DISCONNECTED":
      return { ...state, connected: false };
    case "ERROR":
      return { ...state, error: action.payload };

    case "JOINED":
      return {
        ...state,
        playerId: action.payload.playerId,
        roomCode: action.payload.roomCode,
        error: null,
      };

    case "ROOM_STATE": {
      const rs = action.payload;
      return {
        ...state,
        roomState: rs,
        isHost: rs.hostId === state.playerId,
        currentPhaseIndex: rs.currentPhaseIndex ?? state.currentPhaseIndex,
        currentPhaseLabel: rs.phaseLabel ?? state.currentPhaseLabel,
        totalPhases: rs.totalPhases ?? state.totalPhases,
      };
    }

    case "PHASE_PROMPT":
      return {
        ...state,
        currentPhaseIndex: action.payload.phaseIndex,
        currentPhaseLabel: action.payload.phaseLabel,
        alreadyAnswered: action.payload.alreadyAnswered ?? false,
      };

    case "ANSWER_SUBMITTED":
      return { ...state, alreadyAnswered: true };

    case "REVIEW_SENTENCE":
      return {
        ...state,
        reviewSentence: action.payload,
        alreadyVoted: action.payload.alreadyVoted ?? false,
        roundResults: null, // clear previous round result
      };

    case "VOTE_SUBMITTED":
      return { ...state, alreadyVoted: true };

    case "ROUND_RESULTS":
      return { ...state, roundResults: action.payload };

    case "FINAL_RESULTS":
      return { ...state, finalResults: action.payload };

    case "RESET_FOR_NEW_PHASE":
      return { ...state, alreadyAnswered: false };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameSocket() {
  const socketRef = useRef(null);
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      dispatch({ type: "CONNECTED" });

      // Silent reconnection via sessionStorage
      const storedPlayerId = sessionStorage.getItem("exquisite_playerId");
      const storedRoomCode = sessionStorage.getItem("exquisite_roomCode");
      const storedName = sessionStorage.getItem("exquisite_name");

      if (storedPlayerId && storedRoomCode && storedName) {
        socket.emit(
          "room:join",
          { name: storedName, code: storedRoomCode, existingPlayerId: storedPlayerId },
          (res) => {
            if (res.error) {
              sessionStorage.removeItem("exquisite_playerId");
              sessionStorage.removeItem("exquisite_roomCode");
              sessionStorage.removeItem("exquisite_name");
            } else {
              dispatch({
                type: "JOINED",
                payload: { playerId: storedPlayerId, roomCode: storedRoomCode },
              });
            }
          }
        );
      }
    });

    socket.on("disconnect", () => dispatch({ type: "DISCONNECTED" }));

    socket.on("room:state", (data) => {
      dispatch({ type: "ROOM_STATE", payload: data });
    });

    socket.on("phase:prompt", (data) => {
      dispatch({ type: "PHASE_PROMPT", payload: data });
      dispatch({ type: "RESET_FOR_NEW_PHASE" });
    });

    socket.on("review:sentence", (data) => {
      dispatch({ type: "REVIEW_SENTENCE", payload: data });
    });

    socket.on("round:results", (data) => {
      dispatch({ type: "ROUND_RESULTS", payload: data });
    });

    socket.on("game:finalResults", (data) => {
      dispatch({ type: "FINAL_RESULTS", payload: data });
    });

    socket.connect();

    return () => socket.disconnect();
  }, []);

  // ─── Public API ──────────────────────────────────────────────────────────

  const createRoom = useCallback((name, lang) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit("room:create", { name, lang }, (res) => {
        if (res.error) return reject(new Error(res.error));
        sessionStorage.setItem("exquisite_playerId", res.playerId);
        sessionStorage.setItem("exquisite_roomCode", res.code);
        sessionStorage.setItem("exquisite_name", name);
        dispatch({ type: "JOINED", payload: { playerId: res.playerId, roomCode: res.code } });
        resolve(res);
      });
    });
  }, []);

  const joinRoom = useCallback((name, code) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit("room:join", { name, code }, (res) => {
        if (res.error) return reject(new Error(res.error));
        sessionStorage.setItem("exquisite_playerId", res.playerId);
        sessionStorage.setItem("exquisite_roomCode", code.toUpperCase());
        sessionStorage.setItem("exquisite_name", name);
        dispatch({ type: "JOINED", payload: { playerId: res.playerId, roomCode: code.toUpperCase() } });
        resolve(res);
      });
    });
  }, []);

  const startGame = useCallback(() => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit("game:start", null, (res) => {
        if (res?.error) return reject(new Error(res.error));
        resolve(res);
      });
    });
  }, []);

  const submitAnswer = useCallback((answer) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit("phase:submit", { answer }, (res) => {
        if (res?.error) return reject(new Error(res.error));
        dispatch({ type: "ANSWER_SUBMITTED" });
        resolve(res);
      });
    });
  }, []);

  const submitVote = useCallback((stars) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit("review:vote", { stars }, (res) => {
        if (res?.error) return reject(new Error(res.error));
        dispatch({ type: "VOTE_SUBMITTED" });
        resolve(res);
      });
    });
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    submitAnswer,
    submitVote,
  };
}
