/**
 * Core game state machine.
 *
 * All public functions mutate the `room` object in place and broadcast WS
 * events. Callers (handler.ts) are responsible for scheduling bot actions
 * after state transitions so that this module has no circular dependencies.
 */
import { randomUUID } from "crypto";
import type { Room, Score } from "../../lib/types";
import { blackCards as allBlackCards, whiteCards as allWhiteCards, shuffleDeck } from "../../lib/cards";
import { broadcast, sendToPlayer } from "../ws/broadcast";
import { SERVER_EVENTS } from "../ws/events";
import {
  getPublicRoom,
  getPublicPlayer,
  rooms,
} from "./room";
import {
  startSessionTimer,
  resetInactivityTimer,
  startSubmissionTimer,
  cancelSubmissionTimer,
  clearAllTimers,
} from "./timers";

const HAND_SIZE         = 10;
const MIN_PLAYERS       = 3;
const BLACK_CARD_CHOICES = 4;     // how many black cards the hetman picks from
const REVEAL_DELAY_MS   = 5_000;   // seconds before round_end is sent after winner
const ADVANCE_DELAY_MS  = 3_000;   // seconds after round_end before next deal
const ROOM_LINGER_MS    = 60_000;  // clean up finished rooms after 1 minute

// ── Internal helpers ───────────────────────────────────────────────────────────

function computeScores(room: Room): Score[] {
  return room.players
    .map(p => ({ playerId: p.id, playerName: p.name, points: p.points }))
    .sort((a, b) => b.points - a.points);
}

function getSubmitters(room: Room): string[] {
  return room.players
    .filter(p => p.id !== room.hetmanId)
    .map(p => p.id);
}

function refillDeck<T>(deck: T[], source: T[]): T[] {
  if (deck.length === 0) return shuffleDeck([...source]);
  return deck;
}

function broadcastRoomState(room: Room): void {
  broadcast(room.id, SERVER_EVENTS.ROOM_STATE, { room: getPublicRoom(room) });
}

// ── Public API ─────────────────────────────────────────────────────────────────

export { broadcastRoomState };

/**
 * Prepare the game from the lobby state.
 * Does NOT deal the first round — call `dealRound` afterwards so that the
 * caller can also schedule bot actions.
 */
export function startGame(room: Room): void {
  if (room.players.length < MIN_PLAYERS) {
    throw new Error("NOT_ENOUGH_PLAYERS");
  }
  if (room.phase !== "lobby") {
    throw new Error("GAME_ALREADY_STARTED");
  }

  // Shuffle fresh decks
  room.blackDeck = shuffleDeck([...allBlackCards]);
  room.whiteDeck = shuffleDeck([...allWhiteCards]);
  room.currentRound = 0;

  // First hetman = host
  room.hetmanId = room.hostId;

  // Session timers
  startSessionTimer(room, () => endGame(room, "time_limit"));
  resetInactivityTimer(room, () => endGame(room, "inactivity"));
}

/**
 * Deal a new round:
 * - Refill every player's hand to HAND_SIZE
 * - Draw 4 black cards for the Hetman to choose from
 * - Phase → "hetmanPicking"
 * - Broadcast round_start + private cards_dealt to each player
 * - Send black card choices privately to the Hetman
 * After this, caller should schedule bot black card pick if hetman is a bot.
 */
export function dealRound(room: Room): void {
  room.currentRound++;
  room.phase = "hetmanPicking";
  room.submissions = [];
  room.currentBlackCard = null;
  room.blackCardChoices = [];

  // Refill white deck if empty
  room.whiteDeck = refillDeck(room.whiteDeck, allWhiteCards);

  // Refill each player's hand
  for (const player of room.players) {
    const needed = HAND_SIZE - player.hand.length;
    if (needed > 0) {
      const drawn = room.whiteDeck.splice(0, needed);
      player.hand.push(...drawn);
    }
  }

  // Draw black cards for hetman to choose from
  room.blackDeck = refillDeck(room.blackDeck, allBlackCards);
  const drawCount = Math.min(BLACK_CARD_CHOICES, room.blackDeck.length);
  room.blackCardChoices = room.blackDeck.splice(0, drawCount);

  // Broadcast round start to room (no black card yet — hetman is picking)
  broadcast(room.id, SERVER_EVENTS.ROUND_START, {
    blackCard: null,
    hetmanId: room.hetmanId,
    round: room.currentRound,
  });

  // Send private hand updates to each player
  for (const player of room.players) {
    sendToPlayer(player.id, SERVER_EVENTS.CARDS_DEALT, { hand: player.hand });
  }

  // Send black card choices privately to the Hetman
  if (room.hetmanId) {
    sendToPlayer(room.hetmanId, SERVER_EVENTS.BLACK_CARD_CHOICES, {
      choices: room.blackCardChoices,
    });
  }

  broadcastRoomState(room);

  // Notify listeners that hetman needs to pick (bot scheduling etc.)
  room.onHetmanPick?.(room);
}

/**
 * Hetman picks one of the offered black cards.
 * Unused cards are returned to the bottom of the deck.
 * Then the round transitions to "submitting".
 */
export function pickBlackCard(room: Room, hetmanId: string, card: string): void {
  if (room.phase !== "hetmanPicking") throw new Error("NOT_HETMAN_PICKING_PHASE");
  if (hetmanId !== room.hetmanId) throw new Error("NOT_HETMAN");

  const idx = room.blackCardChoices.indexOf(card);
  if (idx === -1) throw new Error("CARD_NOT_IN_CHOICES");

  // Set the chosen black card
  room.currentBlackCard = card;

  // Return un-chosen cards to the bottom of the deck
  const unused = room.blackCardChoices.filter((_, i) => i !== idx);
  room.blackDeck.push(...unused);
  room.blackCardChoices = [];

  // Transition to submitting
  room.phase = "submitting";

  // Start submission timer if configured
  room.submissionDeadline = room.settings.submissionTimeLimitSec
    ? Date.now() + room.settings.submissionTimeLimitSec * 1_000
    : null;

  startSubmissionTimer(room, () => {
    room.submissionDeadline = null;
    // Force-submit a random card for every player who hasn't submitted
    for (const playerId of getSubmitters(room)) {
      const player = room.players.find(p => p.id === playerId);
      if (!player || room.submissions.some(s => s.playerId === playerId)) continue;
      if (player.hand.length > 0) {
        const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)]!;
        submitCard(room, playerId, randomCard);
      }
    }
  });

  // Broadcast the picked black card to all
  broadcast(room.id, SERVER_EVENTS.BLACK_CARD_PICKED, {
    blackCard: room.currentBlackCard,
  });

  broadcastRoomState(room);

  // Notify listeners that the round is ready for submissions (bot scheduling)
  room.onDealComplete?.(room);
}

/** Submit a white card on behalf of a player. */
export function submitCard(room: Room, playerId: string, card: string): void {
  if (room.phase !== "submitting") throw new Error("NOT_SUBMITTING_PHASE");

  const player = room.players.find(p => p.id === playerId);
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  if (playerId === room.hetmanId) throw new Error("HETMAN_CANNOT_SUBMIT");

  if (room.submissions.some(s => s.playerId === playerId)) {
    throw new Error("ALREADY_SUBMITTED");
  }

  // Security: server-side validation that the submitted card is actually in the player's hand
  const cardIdx = player.hand.indexOf(card);
  if (cardIdx === -1) throw new Error("CARD_NOT_IN_HAND");

  // Remove card from hand
  player.hand.splice(cardIdx, 1);

  // Record submission
  room.submissions.push({
    anonymousId: randomUUID(),
    playerId,
    card,
    isWinner: false,
  });

  const count = room.submissions.length;
  broadcast(room.id, SERVER_EVENTS.SUBMISSION_RECEIVED, { count });

  // Check if all eligible players have submitted
  const submitters = getSubmitters(room);
  const allSubmitted = submitters.every(id => room.submissions.some(s => s.playerId === id));

  if (allSubmitted) {
    cancelSubmissionTimer(room);
    room.phase = "judging";
    room.submissionDeadline = null;

    // Shuffle anonymous submissions so submission order doesn't reveal anything
    const shuffled = shuffleDeck(
      room.submissions.map(s => ({ id: s.anonymousId, card: s.card })),
    );

    broadcast(room.id, SERVER_EVENTS.ALL_SUBMITTED, { submissions: shuffled });
    broadcastRoomState(room);

    // Notify listeners that judging has started (bot hetman scheduling etc.)
    room.onJudgingStart?.(room);
  } else {
    broadcastRoomState(room);
  }
}

/** Hetman picks the winning submission by anonymous id. */
export function selectWinner(room: Room, hetmanId: string, submissionAnonymousId: string): void {
  if (room.phase !== "judging") throw new Error("NOT_JUDGING_PHASE");
  // Security: only the current Hetman (Card Czar) can select the winner
  if (hetmanId !== room.hetmanId) throw new Error("NOT_HETMAN");

  const submission = room.submissions.find(s => s.anonymousId === submissionAnonymousId);
  if (!submission) throw new Error("SUBMISSION_NOT_FOUND");

  // Award point
  const winner = room.players.find(p => p.id === submission.playerId);
  if (winner) winner.points++;
  submission.isWinner = true;

  room.phase = "reveal";

  const winnerPlayer = winner
    ? getPublicPlayer(winner, new Set(room.submissions.map(s => s.playerId)))
    : null;

  broadcast(room.id, SERVER_EVENTS.WINNER_SELECTED, {
    submission,
    playerName: winner?.name ?? "Unknown",
  });
  broadcastRoomState(room);

  // After REVEAL_DELAY: broadcast round_end
  room.timers["reveal"] = setTimeout(() => {
    delete room.timers["reveal"];
    room.phase = "roundEnd";
    broadcast(room.id, SERVER_EVENTS.ROUND_END, { scores: computeScores(room) });
    broadcastRoomState(room);

    // After ADVANCE_DELAY: advance to next round
    room.timers["advance"] = setTimeout(() => {
      delete room.timers["advance"];
      advanceRound(room);
    }, ADVANCE_DELAY_MS);
  }, REVEAL_DELAY_MS);

  void winnerPlayer; // referenced in payload above
}

/**
 * Rotate hetman (if enabled) and start the next round or end the game.
 * Bot scheduling is handled automatically via room.onDealComplete / room.onJudgingStart.
 */
export function advanceRound(room: Room): void {
  if (room.currentRound >= room.settings.maxRounds) {
    endGame(room, "rounds_complete");
    return;
  }

  // Rotate hetman
  if (room.settings.rotateHetman) {
    const currentIdx = room.players.findIndex(p => p.id === room.hetmanId);
    const nextIdx = (currentIdx + 1) % room.players.length;
    room.hetmanId = room.players[nextIdx]!.id;
  }

  dealRound(room);
}

/** End the game, broadcast final scores, and schedule room cleanup. */
export function endGame(
  room: Room,
  _reason: "rounds_complete" | "time_limit" | "inactivity",
): void {
  if (room.phase === "gameOver") return; // already ended

  clearAllTimers(room);
  room.phase = "gameOver";

  const scores = computeScores(room);
  const topScore = scores[0]?.points ?? 0;
  const winners = room.players.filter(p => p.points === topScore);
  const winnerPlayer = winners[0] ?? room.players[0];

  if (!winnerPlayer) {
    rooms.delete(room.id);
    return;
  }

  const publicWinner = getPublicPlayer(
    winnerPlayer,
    new Set(room.submissions.map(s => s.playerId)),
  );

  broadcast(room.id, SERVER_EVENTS.GAME_OVER, { winner: publicWinner, scores });
  broadcastRoomState(room);

  // Remove room after linger period
  room.timers["cleanup"] = setTimeout(() => {
    rooms.delete(room.id);
  }, ROOM_LINGER_MS);
}
