/**
 * REST API route handlers.
 *
 * POST /api/rooms            — create a room
 * POST /api/rooms/:id/join   — join a room
 * GET  /api/rooms/:id        — get public room info
 */
import { createRoom, joinRoom, getPublicRoom, rooms, RoomError } from "./game/room";
import { broadcast } from "./ws/broadcast";
import { SERVER_EVENTS } from "./ws/events";
import type { GameSettings } from "../lib/types";

// ── Rate limiting (max 5 rooms per IP per minute) ─────────────────────────────

const creationLog = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT     = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = creationLog.get(ip);
  if (!entry || now >= entry.resetAt) {
    creationLog.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

async function parseBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw { status: 400, code: "INVALID_PAYLOAD", message: "Invalid JSON body" };
  }
}

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
}

// ── Route handlers ─────────────────────────────────────────────────────────────

/** POST /api/rooms */
export async function handleCreateRoom(req: Request): Promise<Response> {
  const ip = getIp(req);
  if (!checkRateLimit(ip)) {
    return err("RATE_LIMITED", "Too many rooms created. Try again in a minute.", 429);
  }

  let body: { playerName?: string; settings?: Partial<GameSettings> };
  try {
    body = await parseBody(req);
  } catch (e: unknown) {
    const ex = e as { status: number; code: string; message: string };
    return err(ex.code, ex.message, ex.status);
  }

  if (!body.playerName?.trim()) {
    return err("INVALID_PAYLOAD", "playerName is required", 400);
  }

  const { room, host } = createRoom(body.playerName, body.settings ?? {});

  return json({
    roomId: room.id,
    token: host.token,
    playerId: host.id,
  }, 201);
}

/** POST /api/rooms/:id/join */
export async function handleJoinRoom(req: Request, roomId: string): Promise<Response> {
  let body: { playerName?: string; password?: string };
  try {
    body = await parseBody(req);
  } catch (e: unknown) {
    const ex = e as { status: number; code: string; message: string };
    return err(ex.code, ex.message, ex.status);
  }

  if (!body.playerName?.trim()) {
    return err("INVALID_PAYLOAD", "playerName is required", 400);
  }

  try {
    const { room, player } = joinRoom(roomId, body.playerName, body.password);

    // Notify existing players
    broadcast(room.id, SERVER_EVENTS.PLAYER_JOINED, {
      player: {
        id: player.id,
        name: player.name,
        isBot: player.isBot,
        isConnected: player.isConnected,
        isHost: player.isHost,
        points: player.points,
        hasSubmitted: false,
      },
    });

    return json({ roomId: room.id, token: player.token, playerId: player.id }, 200);
  } catch (e) {
    if (e instanceof RoomError) {
      const statusMap: Record<string, number> = {
        ROOM_NOT_FOUND: 404,
        WRONG_PASSWORD: 401,
        GAME_ALREADY_STARTED: 409,
        ROOM_FULL: 409,
      };
      return err(e.code, e.message, statusMap[e.code] ?? 400);
    }
    return err("INTERNAL", "Internal server error", 500);
  }
}

/** GET /api/rooms/:id */
export function handleGetRoom(roomId: string): Response {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return err("ROOM_NOT_FOUND", "Room not found", 404);

  return json({
    id: room.id,
    phase: room.phase,
    playerCount: room.players.length,
    hasPassword: room.settings.password !== null,
    maxRounds: room.settings.maxRounds,
  });
}

