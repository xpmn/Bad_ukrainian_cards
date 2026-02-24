// ─────────────────────────────────────────────
//  Shared types used by both server and frontend
// ─────────────────────────────────────────────

// --------------- Game phase ------------------

export type GamePhase =
  | "lobby"
  | "dealing"
  | "submitting"
  | "judging"
  | "reveal"
  | "roundEnd"
  | "gameOver";

// --------------- Player ----------------------

/** Full player record — kept server-side; `token` is never broadcast to other clients. */
export interface Player {
  id: string;          // UUID
  token: string;       // reconnect secret (server → owning client only)
  name: string;
  isBot: boolean;
  isConnected: boolean;
  isHost: boolean;
  points: number;
  hand: string[];      // white card texts (private, not broadcast to others)
}

/** Safe player shape sent to other clients — no token, no hand. */
export interface PublicPlayer {
  id: string;
  name: string;
  isBot: boolean;
  isConnected: boolean;
  isHost: boolean;
  points: number;
  /** True when this player has already submitted a card this round. */
  hasSubmitted: boolean;
}

// --------------- Game settings ---------------

export interface GameSettings {
  maxRounds: number;                    // default: 10
  submissionTimeLimitSec: number | null; // null = no limit
  allowCustomCards: boolean;            // reserved for future
  rotateHetman: boolean;                // default: true
  password: string | null;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  maxRounds: 10,
  submissionTimeLimitSec: null,
  allowCustomCards: false,
  rotateHetman: true,
  password: null,
};

// --------------- Submission ------------------

export interface Submission {
  /** Opaque id shown to the Hetman during judging — does not reveal playerId. */
  anonymousId: string;
  playerId: string;
  card: string;
  isWinner: boolean;
}

/** Submission shape visible to all players during judging (no playerId). */
export interface AnonymousSubmission {
  id: string;   // opaque round-scoped id used by Hetman to pick winner
  card: string;
}

// --------------- Score -----------------------

export interface Score {
  playerId: string;
  playerName: string;
  points: number;
}

// --------------- Room ------------------------

export interface Room {
  id: string;           // 6-char uppercase code, e.g. "ABCD12"
  hostId: string;
  players: Player[];
  phase: GamePhase;
  settings: GameSettings;
  currentRound: number;
  hetmanId: string | null;
  currentBlackCard: string | null;
  submissions: Submission[];
  blackDeck: string[];   // remaining cards
  whiteDeck: string[];   // remaining cards
  createdAt: number;     // Unix ms
  lastActivityAt: number;
  /** Unix ms timestamp when the submission phase ends (null if no time limit). */
  submissionDeadline: number | null;
  /** Active timer ids keyed by purpose, e.g. "submission" | "inactivity" | "session" | "reconnect:{playerId}" */
  timers: Record<string, ReturnType<typeof setTimeout>>;
  /**
   * Called by engine.ts at the end of dealRound (every round, including auto-advance).
   * Handler.ts sets this once to schedule bot submission turns.
   */
  onDealComplete?: (room: Room) => void;
  /**
   * Called by engine.ts whenever the phase transitions to "judging".
   * Handler.ts sets this once to schedule the bot hetman turn.
   */
  onJudgingStart?: (room: Room) => void;
}

/** Sanitised room data broadcast to all clients. */
export interface PublicRoom {
  id: string;
  hostId: string;
  players: PublicPlayer[];
  phase: GamePhase;
  settings: Omit<GameSettings, "password"> & { hasPassword: boolean };
  currentRound: number;
  hetmanId: string | null;
  currentBlackCard: string | null;
  /** Anonymous submissions visible during judging/reveal. */
  submissions: AnonymousSubmission[];
  /** Full submissions (with playerId) visible after Hetman picks winner. */
  revealedSubmissions: Submission[];
  /** Unix ms timestamp when the submission phase ends (null if no time limit). */
  submissionDeadline: number | null;
}

// --------------- WebSocket payloads ----------

/** Sent to the connecting client only on WS open. Contains private data. */
export interface ConnectPayload {
  room: PublicRoom;
  myPlayer: Omit<Player, "token">;
  myHand: string[];
}

export interface RoundStartPayload {
  blackCard: string;
  hetmanId: string;
  round: number;
}

export interface CardsDealtPayload {
  hand: string[];
}

export interface SubmissionReceivedPayload {
  count: number;
}

export interface AllSubmittedPayload {
  submissions: AnonymousSubmission[];
}

export interface WinnerSelectedPayload {
  submission: Submission;
  playerName: string;
}

export interface RoundEndPayload {
  scores: Score[];
}

export interface GameOverPayload {
  winner: PublicPlayer;
  scores: Score[];
}

export interface PlayerJoinedPayload {
  player: PublicPlayer;
}

export interface PlayerReconnectedPayload {
  playerId: string;
}

export interface PlayerDisconnectedPayload {
  playerId: string;
}

export interface PlayerReplacedByBotPayload {
  playerId: string;
  botId: string;
  botName: string;
}

export interface SettingsUpdatedPayload {
  settings: GameSettings;
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

// --------------- Error codes -----------------

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "WRONG_PASSWORD"
  | "GAME_ALREADY_STARTED"
  | "ROOM_FULL"
  | "INVALID_TOKEN"
  | "NOT_HOST"
  | "NOT_HETMAN"
  | "CARD_NOT_IN_HAND"
  | "ALREADY_SUBMITTED"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_PAYLOAD";

// --------------- Connection state ------------

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";
