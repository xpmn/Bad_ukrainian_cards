import { randomUUID } from "crypto";
import type { Room, Player, GameSettings, PublicRoom, PublicPlayer } from "../../lib/types";
import { DEFAULT_GAME_SETTINGS } from "../../lib/types";
import { blackCards, whiteCards } from "../../lib/cards";

// ── In-memory store ────────────────────────────────────────────────────────────

export const rooms = new Map<string, Room>();

// ── Errors ─────────────────────────────────────────────────────────────────────

export class RoomError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomId(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return rooms.has(code) ? generateRoomId() : code;
}

function makePlayer(name: string, isHost: boolean, isBot = false): Player {
  return {
    id: randomUUID(),
    token: randomUUID(),
    name,
    isBot,
    isConnected: isBot, // bots are always "connected"
    isHost,
    points: 0,
    hand: [],
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Find the player in any room by their reconnect token. */
export function getPlayerByToken(token: string): { room: Room; player: Player } | undefined {
  for (const room of rooms.values()) {
    const player = room.players.find(p => p.token === token);
    if (player) return { room, player };
  }
  return undefined;
}

/** Create a new room and return the room + host player. */
export function createRoom(
  hostName: string,
  settings: Partial<GameSettings> = {},
): { room: Room; host: Player } {
  const host = makePlayer(hostName.trim() || "Host", true);
  const mergedSettings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settings };

  const room: Room = {
    id: generateRoomId(),
    hostId: host.id,
    players: [host],
    phase: "lobby",
    settings: mergedSettings,
    currentRound: 0,
    hetmanId: null,
    currentBlackCard: null,
    submissions: [],
    blackDeck: [...blackCards],
    whiteDeck: [...whiteCards],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    timers: {},
  };

  rooms.set(room.id, room);
  return { room, host };
}

/** Join an existing lobby room. */
export function joinRoom(
  roomId: string,
  playerName: string,
  password?: string,
): { room: Room; player: Player } {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) throw new RoomError("ROOM_NOT_FOUND", "Room not found");
  if (room.phase !== "lobby") throw new RoomError("GAME_ALREADY_STARTED", "Game already started");
  if (room.players.length >= 10) throw new RoomError("ROOM_FULL", "Room is full");
  if (room.settings.password && room.settings.password !== password) {
    throw new RoomError("WRONG_PASSWORD", "Wrong password");
  }
  const player = makePlayer(playerName.trim() || "Player", false);
  room.players.push(player);
  room.lastActivityAt = Date.now();
  return { room, player };
}

/** Add an AI bot to the lobby. */
export function addBot(room: Room): Player {
  if (room.players.length >= 10) throw new RoomError("ROOM_FULL", "Room is full");
  const botNum = room.players.filter(p => p.isBot).length + 1;
  const bot = makePlayer(`Бот #${botNum} (ШІ)`, false, true);
  room.players.push(bot);
  return bot;
}

/**
 * Replace a human player with an AI bot, preserving points and hand.
 * Also transfers host role if needed.
 */
export function replaceWithBot(
  room: Room,
  playerId: string,
): { oldPlayer: Player; bot: Player } {
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) throw new RoomError("ROOM_NOT_FOUND", "Player not found");

  const oldPlayer = room.players[idx]!;
  const botNum = room.players.filter(p => p.isBot).length + 1;
  const bot: Player = {
    ...oldPlayer,
    id: randomUUID(),
    token: randomUUID(),
    name: `${oldPlayer.name.replace(/ \(ШІ\)$/, "")} (ШІ)`,
    isBot: true,
    isConnected: true,
    isHost: false,
  };

  if (oldPlayer.isHost) {
    const nextHuman = room.players.find(p => !p.isBot && p.id !== playerId);
    if (nextHuman) {
      nextHuman.isHost = true;
      room.hostId = nextHuman.id;
    }
  }
  // Keep hetmanId pointing to bot if this player was hetman
  if (room.hetmanId === playerId) {
    room.hetmanId = bot.id;
  }

  room.players[idx] = bot;
  void botNum; // suppress unused var warning — used in name above
  return { oldPlayer, bot };
}

/** Update game settings (lobby only). */
export function updateSettings(room: Room, patch: Partial<GameSettings>): void {
  room.settings = { ...room.settings, ...patch };
}

// ── Serialisation helpers ──────────────────────────────────────────────────────

export function getPublicPlayer(player: Player, submittedIds: Set<string>): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    isConnected: player.isConnected,
    isHost: player.isHost,
    points: player.points,
    hasSubmitted: submittedIds.has(player.id),
  };
}

export function getPublicRoom(room: Room): PublicRoom {
  const submittedIds = new Set(room.submissions.map(s => s.playerId));

  // During reveal / roundEnd expose full submissions; otherwise anonymous only
  const showFull = room.phase === "reveal" || room.phase === "roundEnd" || room.phase === "gameOver";

  return {
    id: room.id,
    hostId: room.hostId,
    players: room.players.map(p => getPublicPlayer(p, submittedIds)),
    phase: room.phase,
    settings: {
      maxRounds: room.settings.maxRounds,
      submissionTimeLimitSec: room.settings.submissionTimeLimitSec,
      allowCustomCards: room.settings.allowCustomCards,
      rotateHetman: room.settings.rotateHetman,
      hasPassword: room.settings.password !== null,
    },
    currentRound: room.currentRound,
    hetmanId: room.hetmanId,
    currentBlackCard: room.currentBlackCard,
    submissions: room.submissions.map(s => ({ id: s.anonymousId, card: s.card })),
    revealedSubmissions: showFull ? room.submissions : [],
  };
}
