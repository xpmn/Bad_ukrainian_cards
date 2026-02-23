// Session timers — implemented in task 2.6
import type { Room } from "../../lib/types";

/** Start (or restart) the inactivity timer for a room. Reset on every WS message. */
export function resetInactivityTimer(_room: Room): void {
  // TODO: implement in task 2.6
}

/** Start the 1-hour hard session limit when the game begins. */
export function startSessionTimer(_room: Room): void {
  // TODO: implement in task 2.6
}

/** Start per-round submission countdown (only if settings.submissionTimeLimitSec is set). */
export function startSubmissionTimer(_room: Room): void {
  // TODO: implement in task 2.6
}

/** Start grace period before replacing a disconnected player with a bot. */
export function startReconnectTimer(_room: Room, _playerId: string): void {
  // TODO: implement in task 2.6
}

/** Clear all timers for a room (call on game end / room cleanup). */
export function clearAllTimers(_room: Room): void {
  for (const id of Object.values(_room.timers)) {
    clearTimeout(id);
  }
  _room.timers = {};
}
