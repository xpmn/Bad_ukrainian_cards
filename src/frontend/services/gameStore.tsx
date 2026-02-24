/**
 * Game state store — React context backed by useReducer.
 * Wires wsService events to state. Persists session to localStorage.
 */
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { wsService } from "./wsService";
import { t } from "@lib/i18n";
import type {
  PublicRoom,
  Player,
  ConnectionState,
  AnonymousSubmission,
  Submission,
  Score,
  PublicPlayer,
  GameSettings,
} from "@lib/types";

// ── Storage keys ───────────────────────────────────────────────────────────────

const LS_ROOM_ID  = "bac_roomId";
const LS_TOKEN    = "bac_token";
const LS_PLAYER_ID = "bac_playerId";

export function saveSession(roomId: string, token: string, playerId: string): void {
  localStorage.setItem(LS_ROOM_ID,   roomId);
  localStorage.setItem(LS_TOKEN,     token);
  localStorage.setItem(LS_PLAYER_ID, playerId);
}

export function loadSession(): { roomId: string; token: string; playerId: string } | null {
  const roomId   = localStorage.getItem(LS_ROOM_ID);
  const token    = localStorage.getItem(LS_TOKEN);
  const playerId = localStorage.getItem(LS_PLAYER_ID);
  if (roomId && token && playerId) return { roomId, token, playerId };
  return null;
}

export function clearSession(): void {
  localStorage.removeItem(LS_ROOM_ID);
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_PLAYER_ID);
}

// ── Toast ──────────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

function toastId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── State & actions ────────────────────────────────────────────────────────────

export interface GameState {
  room:             PublicRoom | null;
  myPlayer:         Omit<Player, "token"> | null;
  myHand:           string[];
  connectionState:  ConnectionState;
  toasts:           Toast[];
  selectedCard:     string | null;
}

type Action =
  | { type: "SET_STATE"; room: PublicRoom; myPlayer: Omit<Player, "token">; myHand: string[] }
  | { type: "CARDS_DEALT"; hand: string[] }
  | { type: "UPDATE_ROOM"; room: PublicRoom }
  | { type: "ROUND_START"; blackCard: string; hetmanId: string; round: number }
  | { type: "ALL_SUBMITTED"; submissions: AnonymousSubmission[] }
  | { type: "WINNER_SELECTED"; submission: Submission; playerName: string }
  | { type: "ROUND_END"; scores: Score[] }
  | { type: "GAME_OVER"; winner: PublicPlayer; scores: Score[] }
  | { type: "PLAYER_JOINED"; player: PublicPlayer }
  | { type: "PLAYER_RECONNECTED"; playerId: string }
  | { type: "PLAYER_DISCONNECTED"; playerId: string }
  | { type: "PLAYER_REPLACED_BY_BOT"; playerId: string; botId: string; botName: string }
  | { type: "SETTINGS_UPDATED"; settings: GameSettings }
  | { type: "SET_CONNECTION"; state: ConnectionState }
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; id: string }
  | { type: "SET_SELECTED_CARD"; card: string | null }
  | { type: "RESET" };

const initialState: GameState = {
  room:            null,
  myPlayer:        null,
  myHand:          [],
  connectionState: "disconnected",
  toasts:          [],
  selectedCard:    null,
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_STATE":
      return {
        ...state,
        room:      action.room,
        myPlayer:  action.myPlayer,
        myHand:    action.myHand,
        selectedCard: null,
      };

    case "CARDS_DEALT":
      return { ...state, myHand: action.hand, selectedCard: null };

    case "UPDATE_ROOM":
      return { ...state, room: action.room };

    case "ROUND_START": {
      if (!state.room) return state;
      return {
        ...state,
        selectedCard: null,
        room: {
          ...state.room,
          currentBlackCard: action.blackCard,
          hetmanId:         action.hetmanId,
          currentRound:     action.round,
          submissions:      [],
          revealedSubmissions: [],
          phase:            "submitting",
        },
      };
    }

    case "ALL_SUBMITTED": {
      if (!state.room) return state;
      return {
        ...state,
        room: { ...state.room, phase: "judging", submissions: action.submissions },
      };
    }

    case "WINNER_SELECTED": {
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          phase: "reveal",
          revealedSubmissions: [action.submission],
        },
      };
    }

    case "ROUND_END": {
      if (!state.room) return state;
      const updatedPlayers = state.room.players.map(p => {
        const score = action.scores.find(s => s.playerId === p.id);
        return score ? { ...p, points: score.points } : p;
      });
      return {
        ...state,
        room: { ...state.room, phase: "roundEnd", players: updatedPlayers },
      };
    }

    case "GAME_OVER": {
      if (!state.room) return state;
      const updatedPlayers = state.room.players.map(p => {
        const score = action.scores.find(s => s.playerId === p.id);
        return score ? { ...p, points: score.points } : p;
      });
      return {
        ...state,
        room: { ...state.room, phase: "gameOver", players: updatedPlayers },
      };
    }

    case "PLAYER_JOINED": {
      if (!state.room) return state;
      const exists = state.room.players.some(p => p.id === action.player.id);
      return {
        ...state,
        room: {
          ...state.room,
          players: exists
            ? state.room.players.map(p => p.id === action.player.id ? action.player : p)
            : [...state.room.players, action.player],
        },
      };
    }

    case "PLAYER_RECONNECTED": {
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.map(p =>
            p.id === action.playerId ? { ...p, isConnected: true } : p
          ),
        },
      };
    }

    case "PLAYER_DISCONNECTED": {
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.map(p =>
            p.id === action.playerId ? { ...p, isConnected: false } : p
          ),
        },
      };
    }

    case "PLAYER_REPLACED_BY_BOT": {
      if (!state.room) return state;
      // Server will send a room_state to update the full list; keep local update minimal
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.map(p =>
            p.id === action.playerId
              ? { ...p, isBot: true, name: `${action.botName}`, id: action.botId }
              : p
          ),
        },
      };
    }

    case "SETTINGS_UPDATED": {
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          settings: {
            ...action.settings,
            hasPassword: action.settings.password !== null,
          },
        },
      };
    }

    case "SET_CONNECTION":
      return { ...state, connectionState: action.state };

    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] };

    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };

    case "SET_SELECTED_CARD":
      return { ...state, selectedCard: action.card };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  connect: (roomId: string, token: string) => void;
  disconnect: () => void;
  sendEvent: (event: string, payload?: unknown) => void;
  selectCard: (card: string | null) => void;
  submitSelectedCard: () => void;
  selectWinner: (submissionId: string) => void;
  addToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

const EVENTS = {
  ROOM_STATE:             "room_state",
  ROUND_START:            "round_start",
  CARDS_DEALT:            "cards_dealt",
  SUBMISSION_RECEIVED:    "submission_received",
  ALL_SUBMITTED:          "all_submitted",
  WINNER_SELECTED:        "winner_selected",
  ROUND_END:              "round_end",
  GAME_OVER:              "game_over",
  PLAYER_JOINED:          "player_joined",
  PLAYER_RECONNECTED:     "player_reconnected",
  PLAYER_DISCONNECTED:    "player_disconnected",
  PLAYER_REPLACED_BY_BOT: "player_replaced_by_bot",
  SETTINGS_UPDATED:       "settings_updated",
  ERROR:                  "error",
  PONG:                   "pong",
} as const;

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Subscribe to WS events once ─────────────────────────────────────────────
  useEffect(() => {
    // connection state
    const unsubConn = wsService.onConnectionStateChange(s =>
      dispatch({ type: "SET_CONNECTION", state: s })
    );

    // auth error: server closed with 4001 (stale session) or reconnects exhausted
    const unsubAuth = wsService.onAuthError(() => {
      clearSession();
      dispatch({ type: "RESET" });
      window.location.hash = "#/";
    });

    // game events
    const unsubs = [
      wsService.on(EVENTS.ROOM_STATE, raw => {
        const p = raw as { room?: PublicRoom; myPlayer?: Omit<Player, "token">; myHand?: string[] } & PublicRoom;
        // Two variants:
        // 1. Initial/reconnect (sent directly to socket): { room, myPlayer, myHand }
        // 2. Broadcast room update (add_bot, settings, etc.):  { room }
        const roomData = p.room ?? (p as unknown as PublicRoom);
        if (p.myPlayer !== undefined) {
          dispatch({ type: "SET_STATE", room: roomData, myPlayer: p.myPlayer, myHand: p.myHand ?? [] });
        } else {
          dispatch({ type: "UPDATE_ROOM", room: roomData });
        }
      }),
      wsService.on(EVENTS.ROUND_START, raw => {
        const p = raw as { blackCard: string; hetmanId: string; round: number };
        dispatch({ type: "ROUND_START", ...p });
        dispatch({ type: "ADD_TOAST", toast: { id: toastId(), message: t("toast.round_start", undefined, { round: String(p.round) }), type: "info" } });
      }),
      wsService.on(EVENTS.CARDS_DEALT, raw => {
        const p = raw as { hand: string[] };
        dispatch({ type: "CARDS_DEALT", hand: p.hand });
      }),
      wsService.on(EVENTS.ALL_SUBMITTED, raw => {
        const p = raw as { submissions: AnonymousSubmission[] };
        dispatch({ type: "ALL_SUBMITTED", submissions: p.submissions });
      }),
      wsService.on(EVENTS.WINNER_SELECTED, raw => {
        const p = raw as { submission: Submission; playerName: string };
        dispatch({ type: "WINNER_SELECTED", submission: p.submission, playerName: p.playerName });
        dispatch({ type: "ADD_TOAST", toast: { id: toastId(), message: t("toast.winner_announced", undefined, { name: p.playerName }), type: "success" } });
      }),
      wsService.on(EVENTS.ROUND_END, raw => {
        const p = raw as { scores: Score[] };
        dispatch({ type: "ROUND_END", scores: p.scores });
      }),
      wsService.on(EVENTS.GAME_OVER, raw => {
        const p = raw as { winner: PublicPlayer; scores: Score[] };
        dispatch({ type: "GAME_OVER", winner: p.winner, scores: p.scores });
      }),
      wsService.on(EVENTS.PLAYER_JOINED, raw => {
        const p = raw as { player: PublicPlayer };
        dispatch({ type: "PLAYER_JOINED", player: p.player });
        dispatch({ type: "ADD_TOAST", toast: { id: toastId(), message: t("toast.player_joined", undefined, { name: p.player.name }), type: "info" } });
      }),
      wsService.on(EVENTS.PLAYER_RECONNECTED, raw => {
        const p = raw as { playerId: string };
        dispatch({ type: "PLAYER_RECONNECTED", playerId: p.playerId });
        // We don't have the name here; the room state update will follow
      }),
      wsService.on(EVENTS.PLAYER_DISCONNECTED, raw => {
        const p = raw as { playerId: string };
        dispatch({ type: "PLAYER_DISCONNECTED", playerId: p.playerId });
      }),
      wsService.on(EVENTS.PLAYER_REPLACED_BY_BOT, raw => {
        const p = raw as { playerId: string; botId: string; botName: string };
        dispatch({ type: "PLAYER_REPLACED_BY_BOT", playerId: p.playerId, botId: p.botId, botName: p.botName });
        dispatch({ type: "ADD_TOAST", toast: { id: toastId(), message: t("toast.replaced_by_bot", undefined, { name: p.botName }), type: "warning" } });
      }),
      wsService.on(EVENTS.SETTINGS_UPDATED, raw => {
        const p = raw as { settings: GameSettings };
        dispatch({ type: "SETTINGS_UPDATED", settings: p.settings });
        dispatch({ type: "ADD_TOAST", toast: { id: toastId(), message: t("toast.settings_updated"), type: "info" } });
      }),
    ];

    return () => {
      unsubConn();
      unsubAuth();
      unsubs.forEach(fn => fn());
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = toastId();
    dispatch({ type: "ADD_TOAST", toast: { id, message, type } });
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", id });
  }, []);

  const connect = useCallback((roomId: string, token: string) => {
    wsService.connect(roomId, token);
  }, []);

  const disconnect = useCallback(() => {
    wsService.disconnect();
    dispatch({ type: "RESET" });
    clearSession();
  }, []);

  const sendEvent = useCallback((event: string, payload?: unknown) => {
    wsService.send(event, payload);
  }, []);

  const selectCard = useCallback((card: string | null) => {
    dispatch({ type: "SET_SELECTED_CARD", card });
  }, []);

  const submitSelectedCard = useCallback(() => {
    const card = state.selectedCard;
    if (!card) return;
    wsService.send("submit_card", { card });
    dispatch({ type: "SET_SELECTED_CARD", card: null });
  }, [state.selectedCard]);

  const selectWinner = useCallback((submissionId: string) => {
    wsService.send("select_winner", { submissionId });
  }, []);

  return (
    <GameContext.Provider value={{
      state,
      connect,
      disconnect,
      sendEvent,
      selectCard,
      submitSelectedCard,
      selectWinner,
      addToast,
      dismissToast,
    }}>
      {children}
    </GameContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}

/** Backwards-compatible alias for the state slice only. */
export function useGameState(): GameState {
  return useGame().state;
}

