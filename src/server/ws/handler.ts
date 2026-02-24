/**
 * WebSocket message dispatcher.
 *
 * Each connected socket has `WsData` attached at upgrade time.
 * On open  → subscribe to room + player topics, send initial ConnectPayload.
 * On msg   → touch inactivity timer, route to game functions.
 * On close → mark disconnected, start reconnect grace timer.
 */
import type { ServerWebSocket } from "bun";
import { CLIENT_EVENTS, SERVER_EVENTS } from "./events";
import { broadcast, sendToPlayer } from "./broadcast";
import {
  rooms,
  getPlayerByToken,
  getPublicRoom,
  getPublicPlayer,
  addBot,
  replaceWithBot,
  updateSettings,
  RoomError,
} from "../game/room";
import {
  startGame,
  dealRound,
  submitCard,
  selectWinner,
  broadcastRoomState,
  endGame,
} from "../game/engine";
import {
  scheduleBotActionsAfterDeal,
  scheduleBotHetmanTurn,
} from "../game/bot";
import {
  resetInactivityTimer,
  startReconnectTimer,
  cancelReconnectTimer,
} from "../game/timers";
import type { GameSettings } from "../../lib/types";

export interface WsData {
  roomId: string;
  playerId: string;
  token: string;
}

// ── WS lifecycle ───────────────────────────────────────────────────────────────

export function handleOpen(ws: ServerWebSocket<WsData>): void {
  const { roomId, token } = ws.data;
  const found = getPlayerByToken(token);

  if (!found || found.room.id !== roomId) {
    // Close with 4001 so the client distinguishes auth failure from network error
    ws.close(4001, "Invalid token or room");
    return;
  }

  const { room, player } = found;

  // Attach the now-validated playerId to the WS data and mark connected
  const wasDisconnected = !player.isConnected;
  player.isConnected = true;
  ws.data.playerId = player.id;

  // Cancel reconnect grace timer if running
  cancelReconnectTimer(room, player.id);

  // Subscribe to room-wide and player-private topics
  ws.subscribe(`room:${room.id}`);
  ws.subscribe(`player:${player.id}`);

  // Send private initial state
  ws.send(
    JSON.stringify({
      event: SERVER_EVENTS.ROOM_STATE,
      payload: {
        room: getPublicRoom(room),
        myPlayer: { ...player, token: undefined },
        myHand: player.hand,
      },
    }),
  );

  if (wasDisconnected) {
    broadcast(room.id, SERVER_EVENTS.PLAYER_RECONNECTED, { playerId: player.id });
  } else {
    // First connect: broadcast updated room state to everyone including the new joiner
    broadcastRoomState(room);
  }

  // Reset inactivity
  room.lastActivityAt = Date.now();
  resetInactivityTimer(room, () => endGame(room, "inactivity"));
}

export function handleClose(ws: ServerWebSocket<WsData>): void {
  const { roomId, playerId } = ws.data;
  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.find(p => p.id === playerId);
  if (!player || player.isBot) return;

  player.isConnected = false;
  broadcast(room.id, SERVER_EVENTS.PLAYER_DISCONNECTED, { playerId });
  broadcastRoomState(room);

  // Start reconnect grace timer — if they don't come back, replace with bot
  if (room.phase !== "lobby" && room.phase !== "gameOver") {
    startReconnectTimer(room, playerId, () => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom) return;
      const currentPlayer = currentRoom.players.find(p => p.id === playerId);
      if (!currentPlayer || currentPlayer.isConnected) return;

      try {
        const { bot } = replaceWithBot(currentRoom, playerId);
        broadcast(currentRoom.id, SERVER_EVENTS.PLAYER_REPLACED_BY_BOT, {
          playerId,
          botId: bot.id,
          botName: bot.name,
        });
        broadcastRoomState(currentRoom);
        // If the replaced player was supposed to submit, schedule bot
        if (currentRoom.phase === "submitting" && bot.id !== currentRoom.hetmanId) {
          scheduleBotActionsAfterDeal(currentRoom);
        }
      } catch {
        // Ignore if player was already replaced
      }
    });
  }
}

export function handleMessage(ws: ServerWebSocket<WsData>, raw: string | Buffer): void {
  const { roomId, playerId } = ws.data;
  const room = rooms.get(roomId);
  if (!room) return;

  // Touch inactivity
  room.lastActivityAt = Date.now();
  resetInactivityTimer(room, () => endGame(room, "inactivity"));

  let msg: { event: string; payload?: unknown };
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    sendError(ws, "INVALID_PAYLOAD", "Invalid JSON");
    return;
  }

  try {
    dispatch(ws, room, playerId, msg.event, msg.payload);
  } catch (err) {
    if (err instanceof RoomError) {
      sendError(ws, err.code, err.message);
    } else if (err instanceof Error) {
      sendError(ws, "INVALID_PAYLOAD", err.message);
    } else {
      sendError(ws, "INVALID_PAYLOAD", "Unknown error");
    }
  }
}

// ── Event dispatcher ───────────────────────────────────────────────────────────

function dispatch(
  ws: ServerWebSocket<WsData>,
  room: ReturnType<typeof rooms.get> & object,
  playerId: string,
  event: string,
  payload: unknown,
): void {
  switch (event) {
    case CLIENT_EVENTS.PING:
      ws.send(JSON.stringify({ event: SERVER_EVENTS.PONG, payload: {} }));
      break;

    case CLIENT_EVENTS.START_GAME: {
      assertHost(room, playerId);
      startGame(room);
      dealRound(room);
      scheduleBotActionsAfterDeal(room);
      broadcastRoomState(room);
      break;
    }

    case CLIENT_EVENTS.ADD_BOT: {
      assertHost(room, playerId);
      if (room.phase !== "lobby") throw new RoomError("GAME_ALREADY_STARTED", "Game already started");
      addBot(room);
      broadcastRoomState(room);
      break;
    }

    case CLIENT_EVENTS.REMOVE_PLAYER: {
      assertHost(room, playerId);
      const { targetPlayerId } = assertPayload<{ targetPlayerId: string }>(payload, ["targetPlayerId"]);
      if (targetPlayerId === playerId) throw new RoomError("NOT_HOST", "Cannot remove yourself");
      const { bot } = replaceWithBot(room, targetPlayerId);
      broadcast(room.id, SERVER_EVENTS.PLAYER_REPLACED_BY_BOT, {
        playerId: targetPlayerId,
        botId: bot.id,
        botName: bot.name,
      });
      broadcastRoomState(room);
      // Schedule bot for current phase
      if (room.phase === "submitting" && bot.id !== room.hetmanId) {
        scheduleBotActionsAfterDeal(room);
      }
      if (room.phase === "judging" && room.hetmanId === bot.id) {
        scheduleBotHetmanTurn(room, bot.id);
      }
      break;
    }

    case CLIENT_EVENTS.UPDATE_SETTINGS: {
      assertHost(room, playerId);
      if (room.phase !== "lobby") throw new RoomError("GAME_ALREADY_STARTED", "Game already started");
      const { settings } = assertPayload<{ settings: Partial<GameSettings> }>(payload, ["settings"]);
      updateSettings(room, settings);
      broadcast(room.id, SERVER_EVENTS.SETTINGS_UPDATED, { settings: room.settings });
      broadcastRoomState(room);
      break;
    }

    case CLIENT_EVENTS.SUBMIT_CARD: {
      const { card } = assertPayload<{ card: string }>(payload, ["card"]);
      submitCard(room, playerId, card);
      // If transition to judging and hetman is a bot, schedule judging
      if (room.phase === "judging") {
        const hetman = room.players.find(p => p.id === room.hetmanId);
        if (hetman?.isBot) scheduleBotHetmanTurn(room, hetman.id);
      }
      // Confirm privately to submitter
      sendToPlayer(playerId, SERVER_EVENTS.CARDS_DEALT, { hand: room.players.find(p => p.id === playerId)?.hand ?? [] });
      break;
    }

    case CLIENT_EVENTS.SELECT_WINNER: {
      const { submissionId } = assertPayload<{ submissionId: string }>(payload, ["submissionId"]);
      selectWinner(room, playerId, submissionId);
      break;
    }

    case CLIENT_EVENTS.CHAT_MESSAGE: {
      const { text } = assertPayload<{ text: string }>(payload, ["text"]);
      const player = room.players.find(p => p.id === playerId);
      if (!player || player.isBot) break;
      broadcast(room.id, "chat_message" as typeof SERVER_EVENTS.PONG, {
        playerId,
        playerName: player.name,
        text: String(text).slice(0, 200),
      });
      break;
    }

    default:
      sendError(ws, "INVALID_PAYLOAD", `Unknown event: ${event}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sendError(ws: ServerWebSocket<WsData>, code: string, message: string): void {
  ws.send(JSON.stringify({ event: SERVER_EVENTS.ERROR, payload: { code, message } }));
}

function assertHost(room: NonNullable<ReturnType<typeof rooms.get>>, playerId: string): void {
  if (room.hostId !== playerId) throw new RoomError("NOT_HOST", "Only the host can do that");
}

function assertPayload<T extends Record<string, unknown>>(
  payload: unknown,
  requiredKeys: (keyof T)[],
): T {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("INVALID_PAYLOAD");
  }
  for (const key of requiredKeys) {
    if (!(key as string in payload)) {
      throw new Error(`Missing field: ${String(key)}`);
    }
  }
  return payload as T;
}
