// Core game state machine — implemented in task 2.3
import type { Room } from "../../lib/types";

export function startGame(_room: Room): void {
  // TODO: implement in task 2.3
}

export function dealRound(_room: Room): void {
  // TODO: implement in task 2.3
}

export function submitCard(
  _room: Room,
  _playerId: string,
  _card: string,
): void {
  // TODO: implement in task 2.3
}

export function selectWinner(
  _room: Room,
  _hetmanId: string,
  _submissionId: string,
): void {
  // TODO: implement in task 2.3
}

export function advanceRound(_room: Room): void {
  // TODO: implement in task 2.3
}

export function endGame(_room: Room, _reason: "rounds_complete" | "time_limit" | "inactivity"): void {
  // TODO: implement in task 2.3
}
