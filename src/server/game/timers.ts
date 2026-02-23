/**
 * Game timers.
 *
 * All timer callbacks are passed in by the caller (engine.ts / handler.ts)
 * to avoid circular imports.
 */
import type { Room } from "../../lib/types";

const INACTIVITY_MS   = 15 * 60_000;  // 15 minutes
const SESSION_MS      = 60 * 60_000;  // 1 hour
const RECONNECT_MS    =  5 * 60_000;  // 5 minutes grace before replacing with bot

// ── Helpers ────────────────────────────────────────────────────────────────────

function clearTimer(room: Room, key: string): void {
  const id = room.timers[key];
  if (id !== undefined) {
    clearTimeout(id);
    delete room.timers[key];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Reset the 15-minute inactivity watchdog.
 * Must be called on every incoming WS message.
 */
export function resetInactivityTimer(room: Room, onExpire: () => void): void {
  clearTimer(room, "inactivity");
  room.timers["inactivity"] = setTimeout(() => {
    delete room.timers["inactivity"];
    onExpire();
  }, INACTIVITY_MS);
}

/** Start the 1-hour hard session limit. Call once when the game starts. */
export function startSessionTimer(room: Room, onExpire: () => void): void {
  clearTimer(room, "session");
  room.timers["session"] = setTimeout(() => {
    delete room.timers["session"];
    onExpire();
  }, SESSION_MS);
}

/**
 * Per-round submission countdown.
 * Only started when `settings.submissionTimeLimitSec` is set.
 * `onExpire` should force-submit any missing players.
 */
export function startSubmissionTimer(room: Room, onExpire: () => void): void {
  clearTimer(room, "submission");
  if (!room.settings.submissionTimeLimitSec) return;
  room.timers["submission"] = setTimeout(() => {
    delete room.timers["submission"];
    onExpire();
  }, room.settings.submissionTimeLimitSec * 1_000);
}

/** Cancel the submission timer (e.g. everyone submitted early). */
export function cancelSubmissionTimer(room: Room): void {
  clearTimer(room, "submission");
}

/**
 * Start the reconnect grace period for a disconnected player.
 * If they don't reconnect in time, `onExpire` should replace them with a bot.
 */
export function startReconnectTimer(
  room: Room,
  playerId: string,
  onExpire: () => void,
): void {
  const key = `reconnect:${playerId}`;
  clearTimer(room, key);
  room.timers[key] = setTimeout(() => {
    delete room.timers[key];
    onExpire();
  }, RECONNECT_MS);
}

/** Cancel the reconnect timer for a player who came back. */
export function cancelReconnectTimer(room: Room, playerId: string): void {
  clearTimer(room, `reconnect:${playerId}`);
}

/** Clear every active timer for a room. Call when the game ends / room is removed. */
export function clearAllTimers(room: Room): void {
  for (const id of Object.values(room.timers)) {
    clearTimeout(id);
  }
  room.timers = {};
}

